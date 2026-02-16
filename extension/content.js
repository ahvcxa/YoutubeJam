// 1. Başlangıç Ayarları
let roomId = "vibe-room-1"; 
const socket = io("http://localhost:3000");
let isRemoteAction = false; 
let video = null; // Video elementini saklayacağımız değişken

// 2. Odaya Bağlan
socket.emit('joinRoom', roomId);

socket.on('connect', () => {
    console.log("✅ Sunucuya bağlandım! Oda:", roomId);
});

// 3. Videoyu Bulma Fonksiyonu (Best Practice: Sürekli Kontrol)
// YouTube'da sayfa değişmeden video değiştiği için bu yapı şarttır.
function findAndAttachVideo() {
    const newVideo = document.querySelector('video');

    // Eğer video bulunduysa ve daha önce tanımladığımız video değilse
    if (newVideo && newVideo !== video) {
        console.log("🎥 Video elementi bulundu ve olaylar eklendi!");
        video = newVideo;
        attachEvents(video);
    }
}

// 4. Olayları Ekleme Fonksiyonu
function attachEvents(videoElement) {
    // Kullanıcı Oynattığında
    videoElement.addEventListener('play', () => {
        if (!isRemoteAction) {
            console.log("📤 Play gönderiliyor...");
            socket.emit('videoAction', { type: 'PLAY', roomId: roomId });
        }
    });

    // Kullanıcı Durdurduğunda
    videoElement.addEventListener('pause', () => {
        if (!isRemoteAction) {
            console.log("📤 Pause gönderiliyor...");
            socket.emit('videoAction', { type: 'PAUSE', roomId: roomId });
        }
    });

    // Kullanıcı İleri/Geri Sardığında
    videoElement.addEventListener('seeking', () => {
        if (!isRemoteAction) {
            console.log("📤 Seek gönderiliyor:", videoElement.currentTime);
            socket.emit('videoAction', { 
                type: 'SEEK', 
                time: videoElement.currentTime, 
                roomId: roomId 
            });
        }
    });
}

// Her 1 saniyede bir "Video var mı?" diye kontrol et
setInterval(findAndAttachVideo, 1000);


// 5. SUNUCUDAN GELEN MESAJLARI DİNLE
socket.on('videoActionFromServer', (data) => {
    if (!video) return; // Video yoksa işlem yapma

    console.log("📥 Sunucudan emir geldi:", data.type);
    isRemoteAction = true; // Kilit Tak

    if (data.type === 'PLAY') {
        video.play();
    } else if (data.type === 'PAUSE') {
        video.pause();
    } else if (data.type === 'SEEK') {
        video.currentTime = data.time;
    }

    // Kilidi birazdan aç
    setTimeout(() => { isRemoteAction = false; }, 500);
});

// 6. Popup İletişimi
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "JOIN_NEW_ROOM") {
        console.log("Yeni odaya geçiş:", message.roomId);
        socket.emit('joinRoom', message.roomId);
        roomId = message.roomId; 
    }
});