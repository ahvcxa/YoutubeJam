const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    
    // 1. Odaya Katılma
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Cihaz bağlandı: ${socket.id} -> Oda: ${roomId}`);
        
        // YENİ: Odaya giren kişi "Hey, durum nedir?" diye sorar.
        // Biz de odadaki diğer herkese "Yeni biri geldi, ona durumu bildirin" deriz.
        socket.to(roomId).emit('getSyncData', socket.id); 
    });

    // 2. Video Aksiyonları (Play/Pause/Seek/URL)
    socket.on('videoAction', (data) => {
        socket.to(data.roomId).emit('videoActionFromServer', data);
    });

    // 3. YENİ: Durum Raporu İletme (Eskilerden Yeniye)
    socket.on('sendSyncData', (data) => {
        // data.targetId: Bilgiyi isteyen yeni kişinin kimliği
        io.to(data.targetId).emit('videoActionFromServer', data.action);
    });
});

server.listen(3000, () => {
    console.log('Haberci 3000 portunda aktif! (Otomatik Senkron Özellikli)');
});