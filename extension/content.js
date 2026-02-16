// --- AYARLAR ---
let roomId = "vibe-room-1"; 
const socket = io("http://localhost:3000");
let isPartyActive = sessionStorage.getItem('jamActive') === 'true';
let isRemoteAction = false; 
let video = null; 
let currentUrl = location.href;

// --- BAŞLANGIÇ ---
if (isPartyActive) {
    socket.emit('joinRoom', roomId);
    console.log("🟢 Jam Modu Aktif! Oda:", roomId);
}

// --- ANA DÖNGÜ ---
function checkPageStatus() {
    if (!isPartyActive) return;

    // 1. URL Değişim Kontrolü
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        
        // Sadece gerçek videolarda ve manuel değişimlerde haber ver
        if (!isRemoteAction && currentUrl.includes("watch?v=")) {
            console.log("🔗 Link değişti, gönderiliyor...");
            socket.emit('videoAction', { 
                type: 'URL_CHANGE', 
                newUrl: currentUrl, 
                roomId: roomId 
            });
        }
    }

    // 2. Video Element Kontrolü
    const newVideo = document.querySelector('video');
    if (newVideo && newVideo !== video) {
        video = newVideo;
        attachEvents(video);
    }
}

// --- VİDEO DİNLEYİCİLERİ ---
function attachEvents(videoElement) {
    const canSend = () => isPartyActive && !isRemoteAction && location.href.includes("watch?v=");

    videoElement.onplay = () => {
        if (canSend()) socket.emit('videoAction', { type: 'PLAY', roomId });
    };

    videoElement.onpause = () => {
        if (canSend()) socket.emit('videoAction', { type: 'PAUSE', roomId });
    };

    videoElement.onseeking = () => {
        if (canSend()) socket.emit('videoAction', { type: 'SEEK', time: videoElement.currentTime, roomId });
    };
}

setInterval(checkPageStatus, 500);

// --- SERVER'DAN GELEN KOMUTLAR ---
socket.on('videoActionFromServer', (data) => {
    if (!isPartyActive) return;

    isRemoteAction = true; 
    console.log("📥 Gelen Emir:", data.type);

    // 1. URL DEĞİŞİMİ veya SENKRONİZASYONDA URL FARKI
    // Eğer gelen komut bir URL içeriyorsa ve ben o URL'de değilsem -> IŞINLAN
    if ((data.type === 'URL_CHANGE' || data.type === 'SYNC') && data.newUrl && location.href !== data.newUrl) {
        console.log("🚀 Hedef videoya gidiliyor:", data.newUrl);
        window.location.href = data.newUrl;
        return; // Sayfa yenileneceği için diğer işlemleri yapma
    }

    // 2. VİDEO KOMUTLARI
    if (video) { 
        if (data.type === 'PLAY') video.play();
        else if (data.type === 'PAUSE') video.pause();
        else if (data.type === 'SEEK') video.currentTime = data.time;
        
        // SYNC (HOŞ GELDİN PAKETİ)
        else if (data.type === 'SYNC') {
            console.log("🔄 Senkronize olunuyor...");
            // Önce zamana git, sonra oynatma durumunu ayarla
            video.currentTime = data.time; 
            if (data.isPlaying) video.play();
            else video.pause();
        }
    }

    setTimeout(() => { isRemoteAction = false; }, 800);
});

// --- HOŞ GELDİN (SYNC) SİSTEMİ ---
// Yeni gelen kişi için rapor hazırla
socket.on('getSyncData', (requesterId) => {
    if (!isPartyActive || !video) return;

    console.log("👋 Yeni üyeye durum raporu gönderiliyor...");
    
    const syncPayload = {
        targetId: requesterId,
        action: {
            type: 'SYNC',
            time: video.currentTime,
            isPlaying: !video.paused,
            newUrl: location.href, // <--- KRİTİK EKLEME: Şu anki URL'yi de gönder!
            roomId: roomId
        }
    };
    socket.emit('sendSyncData', syncPayload);
});

// --- POPUP İLETİŞİMİ ---
chrome.runtime.onMessage.addListener((message) => {
    // KATILMA
    if (message.type === "JOIN_NEW_ROOM") {
        isPartyActive = true;
        sessionStorage.setItem('jamActive', 'true');
        socket.emit('joinRoom', message.roomId);
        roomId = message.roomId; 
        alert("Odaya katıldın! Senkronizasyon bekleniyor...");
        location.reload(); // Sayfayı yenile ki temiz başlasın
    }
    // AYRILMA (ÇIKIŞ)
    else if (message.type === "LEAVE_ROOM") {
        isPartyActive = false;
        sessionStorage.removeItem('jamActive');
        socket.emit('leaveRoom', roomId);
        alert("Odadan ayrıldın. Özgürsün!");
        location.reload(); // Bağlantıyı koparmak için en temiz yol
    }
});