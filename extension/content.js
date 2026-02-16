// 1. BAŞLANGIÇ AYARLARI
let roomId = "vibe-room-1"; 
const socket = io("http://localhost:3000");

// "Bu sekme Jam'e dahil mi?" kontrolü
let isPartyActive = sessionStorage.getItem('jamActive') === 'true';

let isRemoteAction = false; 
let video = null; 
let currentUrl = location.href;

// Eğer bu sekme aktifse odaya gir
if (isPartyActive) {
    socket.emit('joinRoom', roomId);
    console.log("🟢 Bu sekme Jam modunda ve aktif!");
}

// 2. SÜREKLİ KONTROL MERKEZİ
function checkPageStatus() {
    if (!isPartyActive) return;

    // A) URL DEĞİŞİM KONTROLÜ
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        const isValidVideo = currentUrl.includes("watch?v=");

        if (!isRemoteAction && isValidVideo) {
            console.log("🔗 Yeni video açıldı, paylaşılıyor...");
            socket.emit('videoAction', { 
                type: 'URL_CHANGE', 
                newUrl: currentUrl, 
                roomId: roomId 
            });
        }
    }

    // B) VİDEO ELEMENT KONTROLÜ
    const newVideo = document.querySelector('video');
    if (newVideo && newVideo !== video) {
        video = newVideo;
        attachEvents(video);
    }
}

// 3. VİDEO OLAYLARINI DİNLEME
function attachEvents(videoElement) {
    const canSend = () => isPartyActive && !isRemoteAction && location.href.includes("watch?v=");

    videoElement.onplay = () => {
        if (canSend()) socket.emit('videoAction', { type: 'PLAY', roomId });
    };

    videoElement.onpause = () => {
        if (canSend()) socket.emit('videoAction', { type: 'PAUSE', roomId });
    };

    videoElement.onseeking = () => {
        if (canSend()) {
            socket.emit('videoAction', { type: 'SEEK', time: videoElement.currentTime, roomId });
        }
    };
}

setInterval(checkPageStatus, 500);

// 4. SUNUCUDAN GELEN MESAJLARI UYGULA
socket.on('videoActionFromServer', (data) => {
    if (!isPartyActive) return;

    isRemoteAction = true; 
    console.log("📥 Sunucudan emir:", data.type);

    if (data.type === 'URL_CHANGE') {
        if (location.href !== data.newUrl) {
            console.log("🚀 Işınlanılıyor...");
            window.location.href = data.newUrl; 
        }
    } 
    else if (video) { 
        if (data.type === 'PLAY') video.play();
        else if (data.type === 'PAUSE') video.pause();
        else if (data.type === 'SEEK') video.currentTime = data.time;
        
        // YENİ: SYNC komutu gelirse hem zamanı hem oynatma durumunu ayarla
        else if (data.type === 'SYNC') {
            console.log("🔄 Senkronizasyon paketi işleniyor...");
            video.currentTime = data.time;
            if (data.isPlaying) video.play();
            else video.pause();
        }
    }

    setTimeout(() => { isRemoteAction = false; }, 1000);
});

// 5. YENİ: "HOŞ GELDİN" SİSTEMİ (Yeni gelen kişiye durum raporu ver)
socket.on('getSyncData', (requesterId) => {
    if (!isPartyActive || !video) return;

    console.log("👋 Yeni biri geldi! Ona durumu bildiriyorum.");
    
    // Mevcut durumu paketle ve sadece o kişiye gönderilmesi için sunucuya at
    const syncPayload = {
        targetId: requesterId,
        action: {
            type: 'SYNC', // Özel senkronizasyon tipi
            time: video.currentTime,
            isPlaying: !video.paused,
            roomId: roomId
        }
    };
    socket.emit('sendSyncData', syncPayload);
});


// 6. POPUP İLETİŞİMİ
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "JOIN_NEW_ROOM") {
        console.log("✅ Jam Aktifleştirildi:", message.roomId);
        isPartyActive = true;
        sessionStorage.setItem('jamActive', 'true');
        socket.emit('joinRoom', message.roomId);
        roomId = message.roomId; 
        alert("Odaya katıldın! Video durumu eşitleniyor...");
    }
});