// KATIL
document.getElementById('joinBtn').addEventListener('click', () => {
    const roomId = document.getElementById('roomInput').value;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: "JOIN", roomId: roomId });
    });

    chrome.storage.local.set({ savedRoomId: roomId });
});

// AYRIL
document.getElementById('leaveBtn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: "LEAVE" });
    });
});

// Oda ismini hatırla
chrome.storage.local.get(['savedRoomId'], (res) => {
    if (res.savedRoomId) document.getElementById('roomInput').value = res.savedRoomId;
});