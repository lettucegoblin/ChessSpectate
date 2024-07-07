<script lang="ts">
  import { onMount } from 'svelte';
  import io, { Socket } from 'socket.io-client';
  import { Chessground } from 'svelte-chessground'; // https://github.com/lichess-org/chessground/blob/master/src/config.ts

  type Orientation = 'white' | 'black';
  interface Room {
    id: string;
    name: string;
  }

  let socket: Socket;
  let rooms: Room[] = [];
  let selectedRoom: string = '';
  let inputRoomName: string = '';
  let currentRoom: string = '';

  // Chess
  let orientation: Orientation = 'white';
  let fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  onMount(() => {
    // Initialize socket connection
    socket = io('http://localhost:3000');

    // Fetch available rooms from the relay server
    socket.on('connect', () => {
      socket.emit('requestRooms');
    });

    socket.on('roomsList', (availableRooms: Room[]) => {
      console.log("availableRooms: ", availableRooms);
      rooms = availableRooms;
    });

    // Handle incoming FEN data
    socket.on('fenData', (incomingFen: string) => {
      // Update your chessboard with the FEN data
      console.log(`FEN Data: ${incomingFen}`);
      fen = incomingFen;
    });

    // Clean up the socket connection when the component is destroyed
    return () => {
      socket.disconnect();
    };
  });

  // Join the selected room
  function joinRoom(room: string) {
    if (currentRoom) {
      socket.emit('leaveRoom', currentRoom);
    }
    selectedRoom = room;
    socket.emit('joinRoom', room);
    currentRoom = room;
  }

  function createRoom() {
    socket.emit('createRoom', inputRoomName);
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
<Chessground {fen} {orientation} />
</div>

<style>
  .chessboard {
    width: 400px;
    height: 400px;
  }
</style>