const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`➕ Odaya giriş: ${socket.id} -> ${roomId}`);
        
        // Odaya yeni giren kişi için diğerlerinden durum raporu iste
        socket.to(roomId).emit('getSyncData', socket.id); 
    });

    socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);
        console.log(`➖ Odadan çıkış: ${socket.id}`);
    });

    socket.on('videoAction', (data) => {
        socket.to(data.roomId).emit('videoActionFromServer', data);
    });

    socket.on('sendSyncData', (data) => {
        // Raporu sadece isteyen kişiye ilet
        io.to(data.targetId).emit('videoActionFromServer', data.action);
    });
});

server.listen(3000, () => {
    console.log('🚀 Haberci V2 hazır!');
});