// 1. BAŞLANGIÇ AYARLARI
let roomId = "vibe-room-1"; 
const socket = io("http://localhost:3000");
let isRemoteAction = false; 
let video = null; 
let currentUrl = location.href; // Şu anki linki hafızaya al

// 2. ODAYA BAĞLAN
socket.emit('joinRoom', roomId);

socket.on('connect', () => {
    console.log("✅ Sunucuya bağlandım! Oda:", roomId);
});

// 3. SÜREKLİ KONTROL MERKEZİ (Hem Video Hem Link İçin)
function checkPageStatus() {
    // --- A) LİNK DEĞİŞİM KONTROLÜ (Işınlanma Özelliği) ---
    if (location.href !== currentUrl) {
        // Link değişmiş!
        currentUrl = location.href;
        
        // Eğer bu değişimi sunucu yapmadıysa (ben tıkladıysam)
        if (!isRemoteAction) {
            console.log("🔗 Yeni bir videoya geçildi:", currentUrl);
            socket.emit('videoAction', { 
                type: 'URL_CHANGE', 
                newUrl: currentUrl, 
                roomId: roomId 
            });
        }
    }

    // --- B) VİDEO ELEMENT KONTROLÜ ---
    const newVideo = document.querySelector('video');
    // Video varsa VE (daha önce video yoksa VEYA video değiştiyse)
    if (newVideo && newVideo !== video) {
        console.log("🎥 Yeni video elementi tanımlandı.");
        video = newVideo;
        attachEvents(video);
    }
}

// 4. VİDEO OLAYLARINI DİNLEME (Play/Pause/Seek)
function attachEvents(videoElement) {
    videoElement.onplay = () => {
        if (!isRemoteAction) socket.emit('videoAction', { type: 'PLAY', roomId });
    };

    videoElement.onpause = () => {
        if (!isRemoteAction) socket.emit('videoAction', { type: 'PAUSE', roomId });
    };

    videoElement.onseeking = () => {
        if (!isRemoteAction) {
            socket.emit('videoAction', { type: 'SEEK', time: videoElement.currentTime, roomId });
        }
    };
}

// Her yarım saniyede bir sayfayı kontrol et
setInterval(checkPageStatus, 500);


// 5. SUNUCUDAN GELEN MESAJLARI UYGULA
socket.on('videoActionFromServer', (data) => {
    isRemoteAction = true; // Kilit tak (Sonsuz döngü olmasın)
    console.log("📥 Sunucudan emir:", data.type);

    if (data.type === 'URL_CHANGE') {
        // Eğer bende o video açık değilse, o sayfaya git
        if (location.href !== data.newUrl) {
            console.log("🚀 Arkadaşın videosuna ışınlanılıyor...");
            window.location.href = data.newUrl; 
        }
    } 
    else if (video) { 
        // Video komutları
        if (data.type === 'PLAY') video.play();
        else if (data.type === 'PAUSE') video.pause();
        else if (data.type === 'SEEK') video.currentTime = data.time;
    }

    // URL değişimi sayfayı yenileyeceği için timeout önemli değil ama
    // Play/Pause için kilidi 1 saniye sonra açıyoruz.
    setTimeout(() => { isRemoteAction = false; }, 1000);
});

// 6. POPUP İLETİŞİMİ
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "JOIN_NEW_ROOM") {
        socket.emit('joinRoom', message.roomId);
        roomId = message.roomId; 
    }
});