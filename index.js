const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
// cors
// Use the cors middleware
app.use(cors());
const server = http.createServer(app);
// Configure Socket.io to use CORS
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173', // Replace with your Svelte client origin
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

let rooms = {};

function getRoomsList() {
  return Object.values(rooms);
}

function emitRoomsList() {
  io.emit('roomsList', getRoomsList());
}

function getRoomNames() {
  return Object.values(rooms).map((room) => room.name);
}

io.on('connection', (socket) => {
  console.log('New client connected');
  // Send available rooms to the client
  socket.on('requestRooms', emitRoomsList);

  socket.on('requestRoomNames', () => {
    io.emit('roomNames', getRoomNames);
  });

  // Join a specific room
  socket.on('joinRoom', (room) => {
    console.log('joinRoom', room);
    socket.join(room);
  });

  // Leave a specific room
  socket.on('leaveRoom', (room) => {
    console.log('leaveRoom', room);
    socket.leave(room);
  });

  // Relay FEN data to the appropriate room
  socket.on('fenData', ({ room, fen }) => {
    io.to(room).emit('fenData', fen);
  });

  // Handle creating new rooms
  socket.on('createRoom', (tabId) => {
    rooms[tabId] = {
      id: tabId,
      name: `Room ${tabId}`,
    }
    emitRoomsList()
    console.log('createRoom', tabId, rooms);
  });

  // Handle disconnecting from a room
  socket.on('disconnecting', () => {
    const rooms = socket.rooms;
    rooms.forEach((room) => {
      if (rooms[room]) {
        delete rooms[room];
        io.emit('roomsList', Object.keys(rooms));
      }
    });
  });
});

server.listen(3000, () => {
  console.log('Relay server listening on port 3000');
});


function simulateSetup() {

  // simulate fen data interval
  setInterval(() => {
    io.to('room1').emit('fenData', 'rnbqkbnr/pppp1ppp/8/4p3/5P2/5N2/PPPPP1PP/RNBQKB1R b KQkq - 1 2');
    io.to('room2').emit('fenData', '4rk2/2pp1p2/7p/4r3/8/6P1/P3b1BP/R1R4K w - - 0 31');
  }, 1000);
}

//simulateSetup()