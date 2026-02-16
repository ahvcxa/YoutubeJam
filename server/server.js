const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    
    // ODAYA GİRİŞ
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`➕ Giriş: ${socket.id} -> ${roomId}`);
        
        // Odaya girer girmez "Bana güncel durumu atın" diye bağır
        socket.to(roomId).emit('requestSync', socket.id); 
    });

    // ODADAN ÇIKIŞ
    socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);
        console.log(`➖ Çıkış: ${socket.id}`);
    });

    // VİDEO EYLEMLERİ (Play/Pause/Seek/Url)
    socket.on('videoAction', (data) => {
        // Mesajı gönderen hariç odadaki herkese ilet
        socket.to(data.roomId).emit('applyAction', data);
    });

    // SYNC VERİSİ (Eskiden Yeniye)
    socket.on('sendSyncData', (data) => {
        io.to(data.targetId).emit('applyAction', data.action);
    });
});

server.listen(3000, () => {
    console.log('🚀 Jam Server V3 (Stabil) Yayında!');
});