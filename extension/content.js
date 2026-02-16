// --- AYARLAR ---
let roomId = "vibe-room-1"; 
const socket = io("http://localhost:3000");

// Sadece bu değişken 'true' ise çalışırız.
let isPartyActive = sessionStorage.getItem('jamActive') === 'true';

let isRemoteAction = false; // "Ben mi bastım, sunucu mu bastı?" kilidi
let video = null; 
let currentUrl = location.href;

// --- BAŞLANGIÇ ---
// Sayfa yüklendiğinde eğer Jam modu açıksa hemen bağlan
if (isPartyActive) {
    connectToRoom();
}

function connectToRoom() {
    socket.emit('joinRoom', roomId);
    console.log("🟢 Jam Modu: AKTİF. Oda:", roomId);
}

// --- ANA DÖNGÜ (Her 1 saniyede bir ortamı kolla) ---
setInterval(() => {
    if (!isPartyActive) return; // Pasifsek işlemci yorma

    // 1. VİDEO KONTROLÜ
    const newVideo = document.querySelector('video');
    if (newVideo && newVideo !== video) {
        console.log("🎥 Video elementi yakalandı.");
        video = newVideo;
        attachEvents(video); // Kulakları tak
    }

    // 2. URL KONTROLÜ
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        
        // Eğer bu değişimi sunucu yapmadıysa ve geçerli bir videoysa
        if (!isRemoteAction && currentUrl.includes("watch?v=")) {
            console.log("🔗 URL değişti, arkadaşlara haber veriliyor...");
            socket.emit('videoAction', { 
                type: 'URL', 
                newUrl: currentUrl, 
                roomId: roomId 
            });
        }
    }
}, 1000);

// --- VİDEO DİNLEYİCİLERİ (Kulaklar) ---
function attachEvents(vid) {
    // Yardımcı fonksiyon: Sadece aktifsek ve kilit yoksa gönder
    const shouldSend = () => isPartyActive && !isRemoteAction;

    vid.onplay = () => {
        if (shouldSend()) {
            console.log("📤 Play gönderildi");
            socket.emit('videoAction', { type: 'PLAY', roomId });
        }
    };

    vid.onpause = () => {
        if (shouldSend()) {
            console.log("📤 Pause gönderildi");
            socket.emit('videoAction', { type: 'PAUSE', roomId });
        }
    };

    vid.onseeking = () => {
        if (shouldSend()) {
            console.log("📤 Seek gönderildi");
            socket.emit('videoAction', { type: 'SEEK', time: vid.currentTime, roomId });
        }
    };
}

// --- SUNUCUDAN GELENLERİ UYGULA (Eller) ---
socket.on('applyAction', (data) => {
    if (!isPartyActive) return; // Pasifsek duymazdan gel

    console.log("📥 Gelen Komut:", data.type);
    isRemoteAction = true; // Kilit tak (Kendi kendimize loop'a girmeyelim)

    // 1. URL DEĞİŞİMİ
    if (data.type === 'URL') {
        if (location.href !== data.newUrl) {
            console.log("🚀 Işınlanılıyor:", data.newUrl);
            window.location.href = data.newUrl;
            // Sayfa yenileneceği için return, kilit açmaya gerek yok
            return; 
        }
    }
    // 2. SYNC (Hoş Geldin Paketi)
    else if (data.type === 'SYNC') {
        if (location.href !== data.newUrl && data.newUrl.includes("watch?v=")) {
            window.location.href = data.newUrl;
            return;
        }
        if (video) {
            video.currentTime = data.time;
            if (data.isPlaying) video.play(); else video.pause();
        }
    }
    // 3. NORMAL VİDEO EYLEMLERİ
    else if (video) {
        if (data.type === 'PLAY') video.play();
        else if (data.type === 'PAUSE') video.pause();
        else if (data.type === 'SEEK') video.currentTime = data.time;
    }

    // Kilidi 1 saniye sonra aç (Ağ gecikmesi için güvenli pay)
    setTimeout(() => { isRemoteAction = false; }, 1000);
});

// --- YENİ GELENLERE DURUM RAPORU VER ---
socket.on('requestSync', (requesterId) => {
    if (!isPartyActive || !video) return;
    
    console.log("👋 Yeni gelene rapor veriliyor...");
    socket.emit('sendSyncData', {
        targetId: requesterId,
        action: {
            type: 'SYNC',
            time: video.currentTime,
            isPlaying: !video.paused,
            newUrl: location.href,
            roomId: roomId
        }
    });
});

// --- POPUP İLETİŞİMİ ---
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "JOIN") {
        isPartyActive = true;
        sessionStorage.setItem('jamActive', 'true');
        roomId = msg.roomId;
        connectToRoom();
        alert("Odaya Bağlandın! (Sayfa yenilenmeyecek)");
        
        // Bağlanır bağlanmaz elimizde video varsa durumunu bildir (Opsiyonel tetik)
        if(video) attachEvents(video);
    }
    else if (msg.type === "LEAVE") {
        isPartyActive = false;
        sessionStorage.removeItem('jamActive');
        socket.emit('leaveRoom', roomId);
        alert("Odadan Ayrıldın.");
        // Sayfayı temizlemek için yenilemek en garantisi
        location.reload(); 
    }
});