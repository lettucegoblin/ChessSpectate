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
    id: string;
  }

  let socket: Socket;
  let rooms: Room[] = [];
  let selectedRoom: string = "";
  let inputRoomName: string = "";
  let currentRoom: string = "";

  // Chess
  let orientation: Orientation = "white";
  let fen: string = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  onMount(() => {
    // Initialize socket connection
    socket = io("http://localhost:3000");

    // Fetch available rooms from the relay server
    socket.on("connect", () => {
      socket.emit("requestRooms");
    });

    socket.on("roomsList", (availableRooms: Room[]) => {
      console.log("availableRooms: ", availableRooms);
      rooms = availableRooms;
    });

    // Handle incoming FEN data
    socket.on("fenData", (incomingFen: string) => {
      // Update your chessboard with the FEN data
      console.log(`FEN Data: ${incomingFen}`);
      fen = incomingFen;
    });

    // Handle incoming marking data
    socket.on("markingsData", (markingsData: Marking[]) => {

      let userShapes = allShapesThatArentPurple(chessground.getState());
      clearShapes();
      for (const marking of markingsData) {
        console.log(`Marking: ${marking.from} -> ${marking.to}`);
        addArrow(marking.from, marking.to, "purple");
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

  function allShapesThatArentPurple(state: any) {
    return state.drawable.shapes.filter((shape: any) => shape.brush !== "purple");
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
  function addArrow(from: any, to: any, color: string) {
    const arrow: DrawShape = {
      orig: from,
      dest: to,
      brush: color,
    };
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

<select bind:value={selectedRoom} on:change={() => joinRoom(selectedRoom)}>
  {#each rooms as room}
    <option value={room.id}>{room.name}</option>
  {/each}
</select>

<input type="text" bind:value={inputRoomName} placeholder="Enter room name" />

<button on:click={createRoom}>Create Room</button>

<div class="chessboard">
  <!-- Chessground component -->
  <Chessground bind:this={chessground} {fen} />
</div>

<style>
  .chessboard {
    width: 400px;
    height: 400px;
  }
</style>
