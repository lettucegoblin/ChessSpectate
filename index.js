const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
require('dotenv').config();

const app = express();
// cors
// Use the cors middleware
app.use(cors());
const server = http.createServer(app);
// Configure Socket.io to use CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Replace with your Svelte client origin
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

let rooms = {};

function getRoomsList() {
  return Object.values(rooms);
}

function emitRoomsList() {
  io.emit("roomsList", getRoomsList());
}

function getRoomNames() {
  return Object.values(rooms).map((room) => room.name);
}

function sendMarkingsData(room, socketid = "") {
  const markingData = [];

  for (const [from_id, markings] of Object.entries(rooms[room].markings)) {
    markingData.push(...markings); // merge all markings
    console.log("markings", markings, from_id, room);
  }

  io.to(room).emit("markingsData", markingData, room);
}

io.on("connection", (socket) => {
  console.log("New client connected");

  // Send available rooms to the client
  socket.on("requestRooms", emitRoomsList);

  socket.on("requestRoomNames", () => {
    io.emit("roomNames", getRoomNames);
  });

  // Join a specific room
  socket.on("joinRoom", (room) => {
    console.log("joinRoom", room);
    if (!rooms[room]) {
      console.log("Room not found", room);
      return;
    }
    socket.join(room);
    // send fen data to the client
    socket.emit("fenData", rooms[room].fen, rooms[room].state);

    sendMarkingsData(room, socket.id);
  });

  // Leave a specific room
  socket.on("leaveRoom", (room) => {
    console.log("leaveRoom", room);
    socket.leave(room);
  });

  // Relay FEN data to the appropriate room
  socket.on("fenData", ({ room, fen, state }) => {
    if (rooms[room]) {
      rooms[room].fen = fen;
      rooms[room].state = state;
      io.to(room).emit("fenData", rooms[room].fen, rooms[room].state);
    }
  });

  // Relay markings data to the appropriate room
  socket.on("markingsData", ({ room, markings }) => {
    if (!rooms[room]) {
      console.log("Room not found", room);
      return;
    }
    markings.from_id = socket.id;
    rooms[room].markings[socket.id] = markings;
    sendMarkingsData(room, socket.id);
    //io.to(room).emit("markingsData", markings, socket.id, room);
    console.log("all markings", rooms[room].markings);
  });

  // Handle creating new rooms
  socket.on("createRoom", (tabId) => {
    rooms[tabId] = {
      id: tabId,
      name: `Room ${tabId}`,
      roomCreator: socket.id,
      markings: {},
    };
    emitRoomsList();
    console.log("createRoom", tabId, rooms);
  });

  // Handle disconnecting from a room
  socket.on("disconnecting", () => {
    const rooms = socket.rooms;
    // remove markings
    for (const room of Object.keys(rooms)) {
      if (rooms[room]) {
        delete rooms[room].markings[socket.id];
        sendMarkingsData(room);
      }
    }
    /*
    const rooms = socket.rooms;
    rooms.forEach((room) => {
      if (rooms[room]) {
        delete rooms[room];
        io.emit("roomsList", Object.keys(rooms));
      }
    });
    */
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Relay server listening on port ${process.env.PORT || 3000}`);
});

function simulateSetup() {
  // simulate fen data interval
  setInterval(() => {
    io.to("room1").emit(
      "fenData",
      "rnbqkbnr/pppp1ppp/8/4p3/5P2/5N2/PPPPP1PP/RNBQKB1R b KQkq - 1 2"
    );
    io.to("room2").emit(
      "fenData",
      "4rk2/2pp1p2/7p/4r3/8/6P1/P3b1BP/R1R4K w - - 0 31"
    );
  }, 1000);
}

//simulateSetup()
