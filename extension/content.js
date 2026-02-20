// 1. Başlangıç Ayarları
let roomId = "vibe-room-1"; 
const socket = io("http://localhost:3000");
let isRemoteAction = false; 
let video = null; 
let currentUrl = location.href; // Şu anki linki hafızaya al

// 2. Odaya Bağlan
socket.emit('joinRoom', roomId);

socket.on('connect', () => {
    console.log("✅ Sunucuya bağlandım! Oda:", roomId);
});

// 3. Videoyu Bulma ve URL Takip Fonksiyonu
function checkPageStatus() {
    // A) URL DEĞİŞİM KONTROLÜ (YENİ ÖZELLİK)
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        
        // Eğer bu değişimi kullanıcı yaptıysa (sunucudan gelmediyse)
        if (!isRemoteAction) {
            console.log("🔗 Yeni video açıldı, diğerlerine haber veriliyor...");
            socket.emit('videoAction', { 
                type: 'URL_CHANGE', 
                newUrl: currentUrl, 
                roomId: roomId 
            });
        }
    }

    // B) VIDEO ELEMENT KONTROLÜ
    const newVideo = document.querySelector('video');
    if (newVideo && newVideo !== video) {
        console.log("🎥 Video elementi bulundu/yenilendi.");
        video = newVideo;
        attachEvents(video);
    }
}

// 4. Olayları Ekleme Fonksiyonu
function attachEvents(videoElement) {
    videoElement.addEventListener('play', () => {
        if (!isRemoteAction) socket.emit('videoAction', { type: 'PLAY', roomId });
    });

    videoElement.addEventListener('pause', () => {
        if (!isRemoteAction) socket.emit('videoAction', { type: 'PAUSE', roomId });
    });

    videoElement.addEventListener('seeking', () => {
        if (!isRemoteAction) {
            socket.emit('videoAction', { type: 'SEEK', time: videoElement.currentTime, roomId });
        }
    });
}

// Her yarım saniyede bir hem videoyu hem linki kontrol et
setInterval(checkPageStatus, 500);

// 5. SUNUCUDAN GELEN MESAJLARI DİNLE
socket.on('videoActionFromServer', (data) => {
    console.log("📥 Sunucudan emir geldi:", data.type);
    isRemoteAction = true; 

    if (data.type === 'URL_CHANGE') {
        // Gelen link bendekiyle aynı değilse oraya git
        if (location.href !== data.newUrl) {
            console.log("🚀 Arkadaşın gittiği videoya ışınlanılıyor...");
            window.location.href = data.newUrl;
        }
    } 
    else if (video) { 
        // Video komutları (Play/Pause/Seek)
        if (data.type === 'PLAY') video.play();
        else if (data.type === 'PAUSE') video.pause();
        else if (data.type === 'SEEK') video.currentTime = data.time;
    }

    // URL değişiminde sayfa yenilendiği için bu timeout sıfırlanır, sorun olmaz.
    // Video işlemlerinde kilidi açmak için bekleriz.
    setTimeout(() => { isRemoteAction = false; }, 1000);
});

// 6. Popup İletişimi
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "JOIN_NEW_ROOM") {
        socket.emit('joinRoom', message.roomId);
        roomId = message.roomId; 
    }
});