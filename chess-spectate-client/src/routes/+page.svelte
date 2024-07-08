<script lang="ts">
  import { onMount } from "svelte";
  import io, { Socket } from "socket.io-client";
  import { Chessground } from "svelte-chessground"; // https://github.com/lichess-org/chessground/blob/master/src/config.ts
  import type { DrawShape } from "chessground/draw";

  let chessground: Chessground;
  let shapes: DrawShape[] = [];

  type Orientation = "white" | "black";
  interface Room {
    id: string;
    name: string;
  }

  interface Marking {
    from: string;
    to: string;
    type: string;
    from_id: string;
  }

  let socket: Socket;
  let rooms: Room[] = [];
  let selectedRoom: string = "";
  let inputRoomName: string = "";
  let currentRoom: string = "";
  let playingAs: 0 | 1 = 0;

  // Chess
  let orientation: Orientation = "white";
  let fen: string = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  onMount(() => {
    // Chess Events
    chessground.getState().drawable.onChange = (shapes: DrawShape[]) => {
      console.log("Chessground state changed", shapes);
      let userShapes = allShapesThatAreMe(chessground.getState());
      let markingsData = chessgroundShapesToMarkings(userShapes);
      socket.emit("markingsData", { room: selectedRoom, markings: markingsData });
    }

    chessground.getState().events.change = () => {
      console.log("Chessground state changed", chessground.getState());
      let oldfen = fen;
      fen = chessground.getFen();
      setTimeout(() => {
        fen = oldfen;
      }, 0);
    }

    // Initialize socket connection, infinite reconnect
    socket = io("http://localhost:3000", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0
    });

    // Fetch available rooms from the relay server
    socket.on("connect", () => {
      console.log("Connected to server", socket.id);
      socket.emit("requestRooms");
    });

    socket.on("roomsList", (availableRooms: Room[]) => {
      console.log("availableRooms: ", availableRooms);
      rooms = availableRooms;
    });

    // Handle incoming FEN data
    socket.on("fenData", (incomingFen: string, state: any) => {
      // Update your chessboard with the FEN data
      console.log(`FEN Data: ${incomingFen} ${state.isFlipped} ${state.playingAs}`);
      fen = incomingFen;

      // update orientation with state.isFlipped
      orientation = state.isFlipped ? "black" : "white";

      // update playingAs with state.playingAs
      playingAs = state.playingAs;
    });

    // Handle incoming marking data
    socket.on("markingsData", (markingsData: Marking[], from_id: string) => {
      if (from_id == socket.id) {
        return;
      }
      let userShapes = allShapesThatAreMe(chessground.getState());
      clearShapes();
      for (const marking of markingsData) {
        if (marking.from_id == socket.id) {
          continue;
        }
        console.log(`Marking: ${marking.from} -> ${marking.to}`);
        addArrow(marking.from, marking.to, "purple", marking.from_id);
      }
      for (const shape of userShapes) {
        addArrow(shape.orig, shape.dest, shape.brush);
      }
      console.log("state", chessground.getState());
    });

    // Clean up the socket connection when the component is destroyed
    return () => {
      socket.disconnect();
    };
  });

  // Ideally this would be a selector function in a store because it's a pure function
  function allShapesThatAreMe(state: any) {
    return state.drawable.shapes.filter((shape: any) => shape.label == undefined);
  }

  function chessgroundShapesToMarkings(shapes: DrawShape[]) {
    return shapes.map((shape) => {
      return {
        from: shape.orig,
        to: shape.dest,
        type: "arrow",
        from_id: socket.id
      };
    });
  }

  // Join the selected room
  function joinRoom(room: string) {
    if (currentRoom) {
      socket.emit("leaveRoom", currentRoom);
    }
    selectedRoom = room;
    socket.emit("joinRoom", room);
    currentRoom = room;
  }

  function createRoom() {
    socket.emit("createRoom", inputRoomName);
  }

  // Example function to add an arrow
  function addArrow(from: any, to: any, color: string, from_id: string = "") {
    let arrow: DrawShape = {
      orig: from,
      dest: to,
      brush: color
    };

    if (from_id) {
      arrow.label = {
        text: from_id
      }
    }
    shapes.push(arrow);
    if (chessground) {
      chessground.setShapes(shapes);
    }
  }

  // Example function to clear all shapes
  function clearShapes() {
    shapes = [];
    if (chessground) {
      chessground.setShapes(shapes);
    }
  }
</script>

<div class="min-h-screen bg-gray-900 text-white">
  <div class="container mx-auto p-4">
    <label for="rooms" class="block text-sm font-medium text-gray-300">Select a room:</label>
    <select id="rooms" bind:value={selectedRoom} on:change={() => joinRoom(selectedRoom)} class="block w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-sm focus:ring focus:ring-indigo-200 focus:border-indigo-300">
      {#each rooms as room}
        <option value={room.id} class="bg-gray-800 text-gray-300">{room.name}</option>
      {/each}
    </select>

    <div class="mt-4 chessboard flex justify-center items-center bg-gray-800 border border-gray-700 rounded-md p-4">
      <div class="text-center mb-4">Playing as {playingAs ? "White" : "Black"}</div>
      <!-- Chessground component -->
      <Chessground bind:this={chessground} {fen} {orientation}/>
    </div>
  </div>
</div>

<style>

  .container {
    height: 100vh;
  }
  .chessboard {
    align-items: flex-start;
  }
</style>
