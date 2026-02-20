/* extension/popup.js */
"use strict";

const STORAGE_KEYS = Object.freeze({
  SERVER_URL: "ytj_server_url",
  ROOM_ID: "ytj_room_id",
});

const els = {
  serverUrl: document.getElementById("serverUrl"),
  roomId: document.getElementById("roomId"),
  btnJoin: document.getElementById("btnJoin"),
  btnLeave: document.getElementById("btnLeave"),

  statusBox: document.getElementById("statusBox"),
  connPill: document.getElementById("connPill"),
  roomText: document.getElementById("roomText"),
  usersText: document.getElementById("usersText"),
  videoText: document.getElementById("videoText"),
};

function setConnPill(connected) {
  els.connPill.textContent = connected ? "online" : "offline";
  els.connPill.classList.toggle("ok", !!connected);
  els.connPill.classList.toggle("bad", !connected);
}

function setStatus({ connected, roomId, usersCount, hasVideo }) {
  setConnPill(connected);
  els.roomText.textContent = roomId || "-";
  els.usersText.textContent = Number.isFinite(usersCount) ? String(usersCount) : "-";
  els.videoText.textContent = hasVideo ? "found ✅" : "not found ❌";
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function sendToActiveTab(message) {
  return new Promise(async (resolve) => {
    const tabId = await getActiveTabId();
    if (!tabId) return resolve({ ok: false, error: "No active tab" });

    chrome.tabs.sendMessage(tabId, message, (resp) => {
      // content script yoksa lastError olur (örn. youtube değil)
      const err = chrome.runtime.lastError;
      if (err) return resolve({ ok: false, error: err.message });
      resolve(resp || { ok: true });
    });
  });
}

function saveInputs() {
  const serverUrl = (els.serverUrl.value || "").trim() || "http://localhost:3000";
  const roomId = (els.roomId.value || "").trim();

  chrome.storage.local.set({
    [STORAGE_KEYS.SERVER_URL]: serverUrl,
    [STORAGE_KEYS.ROOM_ID]: roomId,
  });

  return { serverUrl, roomId };
}

async function loadInputs() {
  const saved = await chrome.storage.local.get([STORAGE_KEYS.SERVER_URL, STORAGE_KEYS.ROOM_ID]);

  els.serverUrl.value = saved[STORAGE_KEYS.SERVER_URL] || "http://localhost:3000";
  els.roomId.value = saved[STORAGE_KEYS.ROOM_ID] || "";
}

async function refreshStatus() {
  const resp = await sendToActiveTab({ type: "YTJ_PING" });

  if (!resp?.ok) {
    // YouTube tab değilse, ya da content script yüklenmediyse
    setStatus({ connected: false, roomId: "-", usersCount: NaN, hasVideo: false });
    return;
  }

  setStatus({
    connected: !!resp.connected,
    roomId: resp.roomId || "-",
    usersCount: window.__ytjUsersCount ?? NaN, // room users event'i gelirse güncelleriz
    hasVideo: !!resp.hasVideo,
  });
}

/**
 * Room users eventleri background üzerinden değil direkt popup'a gelir mi?
 * Popup sadece açıkken runtime mesajlarını dinleyebilir.
 * content.js, ROOM_USERS yakalayınca runtime.sendMessage atıyordu.
 */
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "YTJ_ROOM_USERS") {
    const payload = msg.payload || {};
    const count = Number(payload.count);
    if (Number.isFinite(count)) {
      window.__ytjUsersCount = count;
      els.usersText.textContent = String(count);
    }
  }

  if (msg.type === "YTJ_JOINED") {
    // join ack sonrası hızlı güncelle
    setConnPill(true);
    els.roomText.textContent = msg.roomId || "-";
  }
});

els.btnJoin.addEventListener("click", async () => {
  const { serverUrl, roomId } = saveInputs();

  if (!roomId) {
    els.roomText.textContent = "roomId boş ❗";
    return;
  }

  const resp = await sendToActiveTab({
    type: "YTJ_JOIN",
    serverUrl,
    roomId,
  });

  if (!resp?.ok) {
    setStatus({ connected: false, roomId: "-", usersCount: NaN, hasVideo: false });
    els.roomText.textContent = `Hata: ${resp?.error || "join failed"}`;
    return;
  }

  // ping ile gerçek durum al
  await refreshStatus();
});

els.btnLeave.addEventListener("click", async () => {
  saveInputs();
  await sendToActiveTab({ type: "YTJ_LEAVE" });

  // local UI reset
  window.__ytjUsersCount = NaN;
  setStatus({ connected: false, roomId: "-", usersCount: NaN, hasVideo: !!document.querySelector("video") });
});

(async function init() {
  await loadInputs();
  await refreshStatus();
})();