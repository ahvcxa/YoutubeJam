// server/server.js
// YouTubeJam MVP Socket.io Server
// Features: room join/leave + command relay (+ optional direct sync)
// Clean goals: minimal state, strict payload validation, no queue logic.

"use strict";

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3000);

// In MVP, keep CORS permissive to avoid extension headaches.
// If you want to lock it down later, set CORS_ORIGIN to your extension id origin.
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

app.get("/", (_req, res) => {
  res.json({ ok: true, name: "YoutubeJam MVP Server" });
});

// ---------- helpers ----------
const ROOM_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidRoomId(roomId) {
  return typeof roomId === "string" && ROOM_ID_RE.test(roomId);
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

const COMMAND_TYPES = new Set(["PLAY", "PAUSE", "SEEK"]);

function validateCommandPayload(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "payload_not_object" };

  const { roomId, type, time } = data;

  if (!isValidRoomId(roomId)) return { ok: false, error: "invalid_roomId" };
  if (typeof type !== "string" || !COMMAND_TYPES.has(type)) return { ok: false, error: "invalid_type" };

  if (type === "SEEK") {
    if (!isFiniteNumber(time) || time < 0) return { ok: false, error: "invalid_time" };
  } else {
    // PLAY/PAUSE: time is optional; if provided, it must be valid
    if (time !== undefined && (!isFiniteNumber(time) || time < 0)) {
      return { ok: false, error: "invalid_time" };
    }
  }

  return { ok: true };
}

function safeSocketId(targetId) {
  return typeof targetId === "string" && targetId.length > 0;
}

// ---------- socket logic ----------
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Client -> Server: join a room
  // payload: { roomId }
  socket.on("room:join", (data, ack) => {
    const roomId = data?.roomId;

    if (!isValidRoomId(roomId)) {
      if (typeof ack === "function") ack({ ok: false, error: "invalid_roomId" });
      return;
    }

    socket.join(roomId);

    // Useful for debugging / UI
    const response = { ok: true, roomId, socketId: socket.id, at: Date.now() };
    if (typeof ack === "function") ack(response);

    // Optional: tell others someone joined (not required for sync)
    socket.to(roomId).emit("room:peer_joined", { socketId: socket.id, at: Date.now() });

    console.log(`[room:join] ${socket.id} -> ${roomId}`);
  });

  // Client -> Server: leave a room
  // payload: { roomId }
  socket.on("room:leave", (data, ack) => {
    const roomId = data?.roomId;

    if (!isValidRoomId(roomId)) {
      if (typeof ack === "function") ack({ ok: false, error: "invalid_roomId" });
      return;
    }

    socket.leave(roomId);

    const response = { ok: true, roomId, socketId: socket.id, at: Date.now() };
    if (typeof ack === "function") ack(response);

    socket.to(roomId).emit("room:peer_left", { socketId: socket.id, at: Date.now() });

    console.log(`[room:leave] ${socket.id} -> ${roomId}`);
  });

  // Client -> Server: relay a sync command to everyone else in the room
  // payload: { roomId, type: "PLAY"|"PAUSE"|"SEEK", time?: number }
  socket.on("sync:command", (data, ack) => {
    const v = validateCommandPayload(data);
    if (!v.ok) {
      if (typeof ack === "function") ack({ ok: false, error: v.error });
      return;
    }

    const { roomId, type, time } = data;

    const outgoing = {
      roomId,
      type,
      // only include time if present (or required)
      ...(time !== undefined ? { time } : {}),
      by: socket.id,
      at: Date.now(),
    };

    // IMPORTANT: socket.to(...) excludes the sender, preventing easy feedback loops.
    socket.to(roomId).emit("sync:command", outgoing);

    if (typeof ack === "function") ack({ ok: true });

    // Light log (avoid noisy logs if you spam seek)
    // console.log(`[sync:command] ${socket.id} -> ${roomId} ${type}${time !== undefined ? ` @${time}` : ""}`);
  });

  // Optional: direct sync to a specific socket id (useful for "late joiner" handshake)
  // payload: { targetId, action: { roomId, type, time? } }
  socket.on("sync:direct", (data, ack) => {
    const targetId = data?.targetId;
    const action = data?.action;

    if (!safeSocketId(targetId)) {
      if (typeof ack === "function") ack({ ok: false, error: "invalid_targetId" });
      return;
    }

    const v = validateCommandPayload(action);
    if (!v.ok) {
      if (typeof ack === "function") ack({ ok: false, error: v.error });
      return;
    }

    const outgoing = {
      ...action,
      by: socket.id,
      at: Date.now(),
      direct: true,
    };

    io.to(targetId).emit("sync:command", outgoing);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[disconnect] ${socket.id} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`YoutubeJam MVP Server listening on http://localhost:${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});