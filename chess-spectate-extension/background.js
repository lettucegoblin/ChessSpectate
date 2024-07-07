// Load the Socket.io client library
importScripts('libs/socket.io.min.js');

console.log('Background script started');

// Establish WebSocket connection
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnectionAttempts: 5,
});

socket.on('connect', () => {
  console.log('Connected to relay server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('disconnect', () => {
  console.log('Disconnected from relay server');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'sendFen') {
    const { tabId, fen } = request.payload;
    console.log('Sending FEN data to the relay server', tabId, fen);

    // Send FEN data to the relay server
    socket.emit('fenData', { room: tabId, fen });
  } else if (request.message === 'sendMarkings') {
    const { tabId, markings } = request.payload;
    console.log('Sending markings data to the relay server', tabId, markings);

    // Send markings data to the relay server
    socket.emit('markingsData', { room: tabId, markings });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('chess.com')) {
    console.log(`Tab updated: ${tabId} - ${tab.url}`);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['contentScript.js'],
    }, () => {
      console.log('Content script injected');
      // Create a room for this tab ID
      socket.emit('createRoom', tabId);
      chrome.tabs.sendMessage(tabId, { message: 'getFen', tabId: tabId }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to content script:', chrome.runtime.lastError);
        } else {
          console.log('Message sent to content script, response:', response);
        }
      });
    });
  }
});

console.log('Background script loaded');
