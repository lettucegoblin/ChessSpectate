const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const app = express();
// cors
// Use the cors middleware
app.use(cors());
const server = http.createServer(app);
// Configure Socket.io to use CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
  path: "/chessSpectate/socket.io",
});

let rooms = {};

function getRoomsList() {
  return Object.values(rooms);
}

function emitRoomsList() {
  let roomsList = getRoomsList();
  console.log("roomsList", roomsList);
  io.emit("roomsList", roomsList);
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

function handleRoomLeave(socket) {
  // remove markings
  for (const room of Object.keys(rooms)) {
    if (rooms[room].roomCreator === socket.id) {
      // disconnect all users from the room and delete the room
      //io.to(room).emit("roomDeleted", room);
      // loop through all sockets in the room and remove them
      console.log("roomCreator", room, rooms[room].roomCreator, socket.id);
      for (const [id, socket] of io.of("/").sockets) {
        if (socket.rooms[room]) {
          socket.leave(room);
        }
      }
      rooms[room] = undefined
      delete rooms[room];
      
      emitRoomsList();
      
    } else {
      delete rooms[room].markings[socket.id];
      sendMarkingsData(room);
    }
  }
}

io.on("connection", (socket) => {
  console.log("New client connected");

  // Handle disconnecting clients
  socket.on("disconnect", (socket) => {
    console.log("Client disconnected");
    handleRoomLeave(socket);
  });

  socket.on("getMarkings", (room) => {
    sendMarkingsData(room);
  });

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
    handleRoomLeave(socket);
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
});

// Serve static files from the dist directory
const distPath = path.join(__dirname, "chess-spectate-client", "build");
app.use(express.static(distPath));

// Catch-all route to serve the Svelte app for any route not handled by your API
app.get("/chessSpectate/", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.use("/chessSpectate", express.static(distPath));

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
