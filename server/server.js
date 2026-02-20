const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Trafik Polisi (Socket.io) Ayarları
const io = new Server(server, {
    cors: {
        origin: "*", // YouTube'dan gelen bağlantılara izin ver
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Biri odaya bağlandı! ID:', socket.id);

    // Bir odaya katılma (Jam başlatma)
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`${socket.id} şu odaya girdi: ${roomId}`);
    });

    // Hareketleri diğerlerine yayma (Play/Pause)
    socket.on('videoAction', (data) => {
        // Mesajı gönderen hariç odadaki herkese gönder
        socket.to(data.roomId).emit('videoActionFromServer', data);
    });
});

server.listen(3000, () => {
    console.log('Haberci 3000 portunda dinlemede... Terminali kapatma!');
});