import { WebSocketServer } from 'ws'; // Correct import for ESM

const wss = new WebSocketServer({ port: 3001 }); // Use WebSocketServer instead of WebSocket.Server

const rooms = {};

wss.on('connection', ws => {
  let roomId = null;
  let isInitiator = false;

  ws.on('message', message => {
    const data = JSON.parse(message);
    if (data.type === 'join') {
      roomId = data.roomId;
      if (!rooms[roomId]) {
        rooms[roomId] = { initiator: ws, other: null };
        isInitiator = true;
      } else {
        rooms[roomId].other = ws;
        isInitiator = false;
      }
      ws.send(JSON.stringify({ type: 'joined', isInitiator }));
    }

    if (data.type === 'offer' && isInitiator) {
      rooms[roomId].other?.send(JSON.stringify(data));
    }

    if (data.type === 'answer' && !isInitiator) {
      rooms[roomId].initiator?.send(JSON.stringify(data));
    }

    if (data.type === 'candidate') {
      const room = rooms[roomId];
      if (room) {
        if (isInitiator) {
          room.other?.send(JSON.stringify(data));
        } else {
          room.initiator?.send(JSON.stringify(data));
        }
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
});

console.log('Server listening on port 3001');
