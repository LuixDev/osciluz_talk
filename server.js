import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

const rooms = {};

wss.on('connection', (ws) => {
  let roomId = null;
  let isInitiator = false;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', e);
      return;
    }

    if (data.type === 'join') {
      roomId = data.roomId;
      if (!rooms[roomId]) {
        // First person in the room
        rooms[roomId] = { initiator: ws, other: null };
        isInitiator = true;
        ws.send(JSON.stringify({ type: 'joined', isInitiator: true }));
      } else if (!rooms[roomId].other) {
        // Second person joins
        rooms[roomId].other = ws;
        isInitiator = false;
        ws.send(JSON.stringify({ type: 'joined', isInitiator: false }));
        // Notify the initiator that a peer has joined
        rooms[roomId].initiator?.send(JSON.stringify({ type: 'peer-joined' }));
        // Also notify the joiner to trigger the offer from initiator side
        // The initiator will create and send the offer
      } else {
        // Room is full
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }
    }

    // Relay offer from initiator to the other peer
    if (data.type === 'offer' && roomId && rooms[roomId]) {
      rooms[roomId].other?.send(JSON.stringify(data));
    }

    // Relay answer from other peer to initiator
    if (data.type === 'answer' && roomId && rooms[roomId]) {
      rooms[roomId].initiator?.send(JSON.stringify(data));
    }

    // Relay ICE candidates to the other peer
    if (data.type === 'candidate' && roomId && rooms[roomId]) {
      const room = rooms[roomId];
      if (ws === room.initiator) {
        room.other?.send(JSON.stringify(data));
      } else if (ws === room.other) {
        room.initiator?.send(JSON.stringify(data));
      }
    }
  });

  ws.on('close', () => {
    if (roomId && rooms[roomId]) {
      if (rooms[roomId].initiator === ws) {
        rooms[roomId].other?.send(JSON.stringify({ type: 'peer-disconnected' }));
        delete rooms[roomId];
      } else if (rooms[roomId].other === ws) {
        rooms[roomId].initiator?.send(JSON.stringify({ type: 'peer-disconnected' }));
        rooms[roomId].other = null;
      }
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

console.log(`Osciluz Talk signaling server running on port ${PORT}`);
