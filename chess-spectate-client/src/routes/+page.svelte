<script lang="ts">
  import { onMount } from "svelte";
  import io, { Socket } from "socket.io-client";
  import { Chessground } from "svelte-chessground"; // https://github.com/lichess-org/chessground/blob/master/src/config.ts
  import type { DrawShape, DrawCurrent } from "chessground/draw";
  const apiUrl = import.meta.env.VITE_API_URL;
  console.log("API URL:", apiUrl);
  import type { Key } from "chessground/types";
  let chessground: Chessground;
  let shapes: DrawShape[] = [];

  type Orientation = "white" | "black";
  interface Room {
    id: string;
    name: string;
  }

  type Marking = ArrowMarking | HighlightMarking;

  // Type guard to check if a marking is of type HighlightMarking
  function isHighlightMarking(marking: Marking): marking is HighlightMarking {
    return (marking as HighlightMarking).highlight !== undefined;
  }

  // Type guard to check if a marking is of type ArrowMarking
  function isArrowMarking(marking: Marking): marking is ArrowMarking {
    return (
      (marking as ArrowMarking).from !== undefined &&
      (marking as ArrowMarking).to !== undefined
    );
  }

  interface ArrowMarking {
    from: string;
    to: string;
    type: string;
    from_id: string;
  }

  interface HighlightMarking {
    highlight: string;
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
  let lastMove: Key[];

  function refreshMarkings() {
    let userShapes = allShapesThatAreMe(chessground.getState());
    let markingsData = chessgroundShapesToMarkings(userShapes);
    socket.emit("markingsData", {
      room: selectedRoom,
      markings: markingsData,
    });
  }

  onMount(() => {
    // Chess Events
    chessground.getState().drawable.onChange = (shapes: DrawShape[]) => {
      console.log("Chessground drawable changed", shapes);
      refreshMarkings();
    };

    chessground.getState().events.change = () => {
      console.log("Chessground state changed", chessground.getState());
      let oldfen = fen;
      fen = chessground.getFen();
      setTimeout(() => {
        fen = oldfen;
        refreshMarkings();
      }, 0);
    };

    // Initialize socket connection, infinite reconnect
    socket = io(apiUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0,
      path: "/chessSpectate/socket.io",
    });

    // Fetch available rooms from the relay server
    socket.on("connect", () => {
      console.log("Connected to server", socket.id);
      socket.emit("requestRooms");
    });

    socket.on("roomsList", (availableRooms: Room[]) => {
      console.log("availableRooms: ", availableRooms);
      rooms = availableRooms;
      if (rooms.length > 0) {
        selectedRoom = rooms[0].id;
        joinRoom(selectedRoom);
      } else {
        selectedRoom = "";
        currentRoom = "";
      }
    });

    socket.on("roomDeleted", (room: string) => {
      rooms = rooms.filter((r) => r.id != room);
      if (room == selectedRoom) {
        selectedRoom = "";
        currentRoom = "";
      }

      socket.emit("leaveRoom", room);
    });

    // Handle incoming FEN data
    socket.on("fenData", (incomingFen: string, state: any) => {
      // Update your chessboard with the FEN data
      console.log(
        `FEN Data: ${incomingFen} ${state.isFlipped} ${state.playingAs}`
      );

      if (fen != incomingFen) {
        clearShapes();
        refreshMarkings()
      }
      fen = incomingFen;

      // update orientation with state.isFlipped
      orientation = state.isFlipped ? "black" : "white";

      // update playingAs with state.playingAs
      playingAs = state.playingAs;
      console.log(state.selectedNode.san);
      lastMove = [state.selectedNode.from, state.selectedNode.to];
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
        if (isHighlightMarking(marking)) {
          addHighlight(marking.highlight, "red", marking.from_id);
        } else if (isArrowMarking(marking)) {
          addArrow(marking.from, marking.to, "red", marking.from_id);
        }
      }
      for (const shape of userShapes) {
        if (shape.dest == undefined) addHighlight(shape.orig, "purple");
        else addArrow(shape.orig, shape.dest, shape.brush);
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
    return state.drawable.shapes.filter(
      (shape: any) => shape.label == undefined
    );
  }

  function chessgroundShapesToMarkings(shapes: DrawShape[]) {
    return shapes.map((shape) => {
      if (shape.dest != undefined) {
        return {
          from: shape.orig,
          to: shape.dest,
          type: "arrow",
          from_id: socket.id,
        };
      } else {
        return {
          highlight: shape.orig,
          type: "highlight",
          from_id: socket.id,
        };
      }
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

  function addHighlight(highlight: any, color: string, from_id: string = "") {
    let highlightMarking: DrawShape = {
      orig: highlight,
      brush: "green",
    };

    if (from_id) {
      highlightMarking.label = {
        text: from_id,
      };
    }
    shapes.push(highlightMarking);
    if (chessground) {
      chessground.setShapes(shapes);
    }
  }

  // Example function to add an arrow
  function addArrow(from: any, to: any, color: string, from_id: string = "") {
    let arrow: DrawShape = {
      orig: from,
      dest: to,
      brush: color,
    };

    if (from_id) {
      arrow.label = {
        text: from_id,
      };
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
    <div class={rooms.length == 0 ? "hidden" : "block"}>
      <label for="rooms" class="block text-sm font-medium text-gray-300">
        Select a public room to spectate({rooms.length}):
      </label>
      <select
        id="rooms"
        bind:value={selectedRoom}
        on:change={() => joinRoom(selectedRoom)}
        class="block w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-sm focus:ring focus:ring-indigo-200 focus:border-indigo-300"
      >
        {#each rooms as room}
          <option value={room.id} class="bg-gray-800 text-gray-300"
            >{room.name}</option
          >
        {/each}
      </select>
    </div>
    <div
      class="mt-4 chessboard flex justify-center items-center bg-gray-800 border border-gray-700 rounded-md p-4 {currentRoom ==
      ''
        ? 'hidden'
        : 'block'}"
    >
      <div
        class="text-center mb-4 {playingAs == 1
          ? 'text-black bg-white'
          : 'text-white bg-black'} p-2 rounded-md mr-5"
      >
        Playing as {playingAs == 1 ? "White" : "Black"}
        <!-- 1 is white, 2 is black -->
      </div>
      <!-- Chessground component -->
      <Chessground bind:this={chessground} {fen} {orientation} {lastMove} />
    </div>
    <div class="text-center {rooms.length > 0 ? 'hidden' : 'block'}">
      <h2>No public rooms available.</h2>
      <br />
      Host a game instructions: <br />
      1. Get the extension from
      <a
        href="https://chrome.google.com/webstore/detail/chess-spectate/"
        class="text-blue-400">here</a
      > <br />
      2. Visit <a href="https://chess.com" class="text-blue-400">chess.com</a>
      to play a game. <br />
      3. Click on the extension icon and click on "Host Game" <br />
      4. Decide on public or private game. <br />
      5. Share the room code with your friends. <br />
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
