// KATIL BUTONU
document.getElementById('joinBtn').addEventListener('click', () => {
    const roomId = document.getElementById('roomInput').value;
    sendMessageToContent("JOIN_NEW_ROOM", roomId);
});

// AYRIL BUTONU
document.getElementById('leaveBtn').addEventListener('click', () => {
    sendMessageToContent("LEAVE_ROOM", null);
});

// Yardımcı Fonksiyon
function sendMessageToContent(type, data) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: type,
                roomId: data
            });
        }
    });
    
    // Odayı kaydet
    if(data) chrome.storage.local.set({ savedRoomId: data });
}

// Kayıtlı odayı geri getir
chrome.storage.local.get(['savedRoomId'], (result) => {
    if (result.savedRoomId) {
        document.getElementById('roomInput').value = result.savedRoomId;
    }
});