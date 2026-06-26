import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);

/** @type {Map<string, { host: import('ws').WebSocket | null, guests: Set<import('ws').WebSocket>, targetId: string | null, shareMode: 'off' | 'target' | 'pointer', pointer: { azimuthDeg: number, altitudeDeg: number } | null, hostDisconnectTimer: NodeJS.Timeout | null }>} */
const rooms = new Map();

function createSessionId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let index = 0; index < 6; index += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return rooms.has(id) ? createSessionId() : id;
}

function sendJson(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function participantCount(room) {
  return (room.host ? 1 : 0) + room.guests.size;
}

function broadcastState(sessionId, room) {
  const message = {
    type: 'session:state',
    sessionId,
    targetId: room.targetId,
    shareMode: room.shareMode,
    pointer: room.pointer,
    participantCount: participantCount(room),
  };

  if (room.host) sendJson(room.host, message);
  room.guests.forEach((guest) => sendJson(guest, message));
}

function broadcastTarget(sessionId, room, targetId) {
  const message = { type: 'target:update', targetId, shareMode: room.shareMode };
  room.guests.forEach((guest) => sendJson(guest, message));
  if (room.host) sendJson(room.host, message);
  broadcastState(sessionId, room);
}

function resolveTargetShareMode(message) {
  if (message.shareMode === 'off' || message.shareMode === 'target') {
    return message.shareMode;
  }
  return message.targetId ? 'target' : 'off';
}

function broadcastPointer(sessionId, room, azimuthDeg, altitudeDeg) {
  const message = { type: 'pointer:update', azimuth: azimuthDeg, altitude: altitudeDeg };
  room.guests.forEach((guest) => sendJson(guest, message));
  if (room.host) sendJson(room.host, message);
  broadcastState(sessionId, room);
}

function clearHostDisconnectTimer(room) {
  if (room.hostDisconnectTimer) {
    clearTimeout(room.hostDisconnectTimer);
    room.hostDisconnectTimer = null;
  }
}

function closeSocket(socket) {
  try {
    socket.close();
  } catch {
    // Ignore stale socket cleanup failures.
  }
}

function endSession(sessionId, room, reason) {
  clearHostDisconnectTimer(room);
  room.guests.forEach((guest) => sendJson(guest, { type: 'session:ended', reason }));
  rooms.delete(sessionId);

  room.guests.forEach((guest) => closeSocket(guest));

  if (room.host) {
    closeSocket(room.host);
  }
}

const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/session') {
    const sessionId = createSessionId();
    rooms.set(sessionId, {
      host: null,
      guests: new Set(),
      targetId: null,
      shareMode: 'off',
      pointer: null,
      hostDisconnectTimer: null,
    });
    response.writeHead(200, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    });
    response.end(JSON.stringify({ sessionId }));
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    response.end();
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  let joinedSessionId = null;
  let role = null;

  socket.on('message', (rawMessage) => {
    let message;
    try {
      message = JSON.parse(String(rawMessage));
    } catch {
      sendJson(socket, { type: 'error', code: 'INVALID_MESSAGE' });
      return;
    }

    if (message.type === 'host:join' || message.type === 'guest:join') {
      const room = rooms.get(message.sessionId);
      if (!room) {
        sendJson(socket, { type: 'error', code: 'SESSION_NOT_FOUND' });
        return;
      }

      joinedSessionId = message.sessionId;
      role = message.type === 'host:join' ? 'host' : 'guest';

      if (role === 'host') {
        clearHostDisconnectTimer(room);
        if (room.host && room.host !== socket) {
          closeSocket(room.host);
        }
        room.host = socket;
      } else {
        room.guests.add(socket);
      }

      broadcastState(joinedSessionId, room);
      return;
    }

    if (message.type === 'target:update') {
      if (!joinedSessionId || role !== 'host') {
        sendJson(socket, { type: 'error', code: 'HOST_REQUIRED' });
        return;
      }

      const room = rooms.get(joinedSessionId);
      if (!room) {
        sendJson(socket, { type: 'error', code: 'SESSION_NOT_FOUND' });
        return;
      }

      room.targetId = message.targetId;
      room.shareMode = resolveTargetShareMode(message);
      room.pointer = null;
      broadcastTarget(joinedSessionId, room, message.targetId);
      return;
    }

    if (message.type === 'pointer:update') {
      if (!joinedSessionId || role !== 'host') {
        sendJson(socket, { type: 'error', code: 'HOST_REQUIRED' });
        return;
      }

      const room = rooms.get(joinedSessionId);
      if (!room) {
        sendJson(socket, { type: 'error', code: 'SESSION_NOT_FOUND' });
        return;
      }

      room.targetId = null;
      room.shareMode = 'pointer';
      room.pointer = {
        azimuthDeg: Number(message.azimuth),
        altitudeDeg: Number(message.altitude),
      };
      broadcastPointer(joinedSessionId, room, room.pointer.azimuthDeg, room.pointer.altitudeDeg);
      return;
    }

    if (message.type === 'session:end') {
      if (!joinedSessionId || role !== 'host') {
        sendJson(socket, { type: 'error', code: 'HOST_REQUIRED' });
        return;
      }

      const room = rooms.get(joinedSessionId);
      if (!room) {
        sendJson(socket, { type: 'error', code: 'SESSION_NOT_FOUND' });
        return;
      }

      endSession(joinedSessionId, room, 'host_ended');
      return;
    }

    sendJson(socket, { type: 'error', code: 'INVALID_MESSAGE' });
  });

  socket.on('close', () => {
    if (!joinedSessionId) return;
    const room = rooms.get(joinedSessionId);
    if (!room) return;

    if (role === 'host' && room.host === socket) {
      room.host = null;
      clearHostDisconnectTimer(room);
      room.hostDisconnectTimer = setTimeout(() => {
        const currentRoom = rooms.get(joinedSessionId);
        if (!currentRoom || currentRoom.host) return;
        endSession(joinedSessionId, currentRoom, 'host_disconnected');
      }, 30000);
    }
    if (role === 'guest') {
      room.guests.delete(socket);
    }

    broadcastState(joinedSessionId, room);
  });
});

server.listen(PORT, () => {
  console.log(`SkyShare session server listening on http://127.0.0.1:${PORT}`);
});

function shutdown() {
  rooms.forEach((room, sessionId) => endSession(sessionId, room, 'server_shutdown'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
