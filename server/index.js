import crypto from 'node:crypto';
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 80);
const MAX_GUESTS_PER_ROOM = Number(process.env.MAX_GUESTS_PER_ROOM ?? 60);
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS ?? 6 * 60 * 60 * 1000);
const CLEANUP_INTERVAL_MS = Number(process.env.CLEANUP_INTERVAL_MS ?? 5 * 60 * 1000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 25000);
const HEARTBEAT_MISSES_LIMIT = Number(process.env.HEARTBEAT_MISSES_LIMIT ?? 3);
const HOST_DISCONNECT_GRACE_MS = Number(process.env.HOST_DISCONNECT_GRACE_MS ?? 90000);
const SESSION_CREATE_WINDOW_MS = Number(process.env.SESSION_CREATE_WINDOW_MS ?? 60000);
const SESSION_CREATE_LIMIT = Number(process.env.SESSION_CREATE_LIMIT ?? 12);
const POINTER_MIN_INTERVAL_MS = Number(process.env.POINTER_MIN_INTERVAL_MS ?? 35);
const WS_OPEN = 1;

const VALID_TARGET_IDS = new Set([
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'star_vega',
  'star_altair',
  'star_deneb',
  'star_arcturus',
  'star_spica',
  'star_antares',
  'star_sirius',
  'star_betelgeuse',
  'star_rigel',
  'star_capella',
  'star_aldebaran',
  'star_procyon',
  'star_pollux',
  'star_regulus',
  'star_fomalhaut',
  'star_polaris',
  'star_canopus',
  'messier_m31',
  'messier_m42',
  'messier_m45',
  'messier_m13',
  'messier_m57',
  'messier_m27',
  'messier_m44',
  'messier_m3',
  'messier_m8',
  'messier_m20',
  'messier_m17',
  'messier_m11',
  'double_albireo',
  'double_mizar',
  'double_castor',
  'double_almach',
  'double_epsilon_lyrae',
  'double_cor_caroli',
  'landmark_polaris',
  'landmark_summer_triangle',
  'landmark_winter_triangle',
  'landmark_spring_arc',
  'landmark_big_dipper',
  'landmark_cassiopeia',
  'landmark_orion_belt',
]);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {Map<string, { host: import('ws').WebSocket | null, guests: Set<import('ws').WebSocket>, targetId: string | null, shareMode: 'off' | 'target' | 'pointer', pointer: { azimuthDeg: number, altitudeDeg: number } | null, timeSync: { baseObservationTimeIso: string, baseRealTimeMs: number } | null, hostDisconnectTimer: NodeJS.Timeout | null, createdAt: number, lastActivityAt: number }>} */
const rooms = new Map();

/** @type {Map<string, { windowStartedAt: number, count: number }>} */
const sessionCreateLimits = new Map();

function isConfiguredOriginAllowed(origin) {
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

function isHttpOriginAllowed(origin) {
  if (!origin) return true;
  return isConfiguredOriginAllowed(origin);
}

function isWebSocketOriginAllowed(origin) {
  if (!origin) return true;
  return isConfiguredOriginAllowed(origin);
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };

  if (allowedOrigins.length === 0) {
    headers['access-control-allow-origin'] = '*';
    return headers;
  }

  if (origin && isConfiguredOriginAllowed(origin)) {
    headers['access-control-allow-origin'] = origin;
  }

  return headers;
}

function clientIp(request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.socket.remoteAddress ?? 'unknown';
}

function checkSessionCreateRateLimit(ip) {
  const now = Date.now();
  const current = sessionCreateLimits.get(ip);
  if (!current || now - current.windowStartedAt > SESSION_CREATE_WINDOW_MS) {
    sessionCreateLimits.set(ip, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (current.count >= SESSION_CREATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function createSessionId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 24; attempt += 1) {
    let id = '';
    for (let index = 0; index < 6; index += 1) {
      id += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    if (!rooms.has(id)) return id;
  }
  throw new Error('session_id_generation_failed');
}

function sendJson(socket, message) {
  if (socket.readyState === WS_OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function sendHttpJson(response, status, request, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    ...corsHeaders(request),
  });
  response.end(JSON.stringify(body));
}

function touchRoom(room) {
  room.lastActivityAt = Date.now();
}

function participantCount(room) {
  return (room.host ? 1 : 0) + room.guests.size;
}

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[A-Z2-9]{6}$/.test(sessionId);
}

function isValidTargetId(targetId) {
  return targetId === null || (typeof targetId === 'string' && VALID_TARGET_IDS.has(targetId));
}

function isValidPointerValue(value, min, max, maxExclusive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return maxExclusive ? value >= min && value < max : value >= min && value <= max;
}

function validatePointerMessage(message) {
  return (
    isValidPointerValue(message.azimuth, 0, 360, true) &&
    isValidPointerValue(message.altitude, -90, 90)
  );
}

function validateTimeSyncMessage(message) {
  if (typeof message.baseObservationTimeIso !== 'string') return false;
  const observationMs = Date.parse(message.baseObservationTimeIso);
  if (!Number.isFinite(observationMs)) return false;
  if (typeof message.baseRealTimeMs !== 'number' || !Number.isFinite(message.baseRealTimeMs)) return false;
  return message.baseRealTimeMs > 0;
}

function broadcastState(sessionId, room) {
  const message = {
    type: 'session:state',
    sessionId,
    targetId: room.targetId,
    shareMode: room.shareMode,
    pointer: room.pointer,
    timeSync: room.timeSync,
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

function broadcastTimeSync(sessionId, room) {
  if (!room.timeSync) return;
  const message = { type: 'time:sync', ...room.timeSync };
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

function terminateSocket(socket) {
  try {
    socket.terminate();
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

function cleanupRooms() {
  const now = Date.now();
  rooms.forEach((room, sessionId) => {
    if (now - room.createdAt > ROOM_TTL_MS || now - room.lastActivityAt > ROOM_TTL_MS) {
      endSession(sessionId, room, 'server_shutdown');
    }
  });

  sessionCreateLimits.forEach((limit, ip) => {
    if (now - limit.windowStartedAt > SESSION_CREATE_WINDOW_MS * 2) {
      sessionCreateLimits.delete(ip);
    }
  });
}

const server = http.createServer((request, response) => {
  if (!isHttpOriginAllowed(request.headers.origin)) {
    sendHttpJson(response, 403, request, { error: 'origin_not_allowed' });
    return;
  }

  if (request.method === 'GET' && (request.url === '/' || request.url === '/health')) {
    sendHttpJson(response, 200, request, { ok: true, service: 'sorava-session-server' });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/session') {
    const ip = clientIp(request);
    if (!checkSessionCreateRateLimit(ip)) {
      sendHttpJson(response, 429, request, { error: 'rate_limited' });
      return;
    }
    if (rooms.size >= MAX_ROOMS) {
      sendHttpJson(response, 503, request, { error: 'room_limit_reached' });
      return;
    }

    let sessionId;
    try {
      sessionId = createSessionId();
    } catch {
      sendHttpJson(response, 500, request, { error: 'session_id_generation_failed' });
      return;
    }

    const now = Date.now();
    rooms.set(sessionId, {
      host: null,
      guests: new Set(),
      targetId: null,
      shareMode: 'off',
      pointer: null,
      timeSync: null,
      hostDisconnectTimer: null,
      createdAt: now,
      lastActivityAt: now,
    });
    sendHttpJson(response, 200, request, { sessionId });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }

  sendHttpJson(response, 404, request, { error: 'not_found' });
});

const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: ({ origin }, done) => {
    if (isWebSocketOriginAllowed(origin)) {
      done(true);
      return;
    }
    done(false, 403, 'Forbidden');
  },
});

wss.on('connection', (socket) => {
  let joinedSessionId = null;
  let role = null;
  let lastPointerUpdateAt = 0;
  socket.isAlive = true;
  socket.missedHeartbeats = 0;

  socket.on('pong', () => {
    socket.isAlive = true;
    socket.missedHeartbeats = 0;
  });

  socket.on('message', (rawMessage) => {
    let message;
    try {
      message = JSON.parse(String(rawMessage));
    } catch {
      sendJson(socket, { type: 'error', code: 'INVALID_MESSAGE' });
      return;
    }

    if (message.type === 'host:join' || message.type === 'guest:join') {
      if (!isValidSessionId(message.sessionId)) {
        sendJson(socket, { type: 'error', code: 'INVALID_SESSION_ID' });
        return;
      }

      const room = rooms.get(message.sessionId);
      if (!room) {
        sendJson(socket, { type: 'error', code: 'SESSION_NOT_FOUND' });
        return;
      }

      if (message.type === 'guest:join' && room.guests.size >= MAX_GUESTS_PER_ROOM && !room.guests.has(socket)) {
        sendJson(socket, { type: 'error', code: 'ROOM_FULL' });
        closeSocket(socket);
        return;
      }

      joinedSessionId = message.sessionId;
      role = message.type === 'host:join' ? 'host' : 'guest';
      touchRoom(room);

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
      if (!isValidTargetId(message.targetId)) {
        sendJson(socket, { type: 'error', code: 'INVALID_TARGET_ID' });
        return;
      }

      touchRoom(room);
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
      if (!validatePointerMessage(message)) {
        sendJson(socket, { type: 'error', code: 'INVALID_POINTER' });
        return;
      }

      const now = Date.now();
      if (now - lastPointerUpdateAt < POINTER_MIN_INTERVAL_MS) {
        sendJson(socket, { type: 'error', code: 'RATE_LIMITED' });
        return;
      }
      lastPointerUpdateAt = now;

      touchRoom(room);
      room.targetId = null;
      room.shareMode = 'pointer';
      room.pointer = {
        azimuthDeg: message.azimuth,
        altitudeDeg: message.altitude,
      };
      broadcastPointer(joinedSessionId, room, room.pointer.azimuthDeg, room.pointer.altitudeDeg);
      return;
    }

    if (message.type === 'time:sync') {
      if (!joinedSessionId || role !== 'host') {
        sendJson(socket, { type: 'error', code: 'HOST_REQUIRED' });
        return;
      }

      const room = rooms.get(joinedSessionId);
      if (!room) {
        sendJson(socket, { type: 'error', code: 'SESSION_NOT_FOUND' });
        return;
      }
      if (!validateTimeSyncMessage(message)) {
        sendJson(socket, { type: 'error', code: 'INVALID_TIME_SYNC' });
        return;
      }

      touchRoom(room);
      room.timeSync = {
        baseObservationTimeIso: message.baseObservationTimeIso,
        baseRealTimeMs: message.baseRealTimeMs,
      };
      broadcastTimeSync(joinedSessionId, room);
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

      touchRoom(room);
      endSession(joinedSessionId, room, 'host_ended');
      return;
    }

    sendJson(socket, { type: 'error', code: 'INVALID_MESSAGE' });
  });

  socket.on('close', () => {
    if (!joinedSessionId) return;
    const room = rooms.get(joinedSessionId);
    if (!room) return;

    touchRoom(room);
    if (role === 'host' && room.host === socket) {
      room.host = null;
      clearHostDisconnectTimer(room);
      room.hostDisconnectTimer = setTimeout(() => {
        const currentRoom = rooms.get(joinedSessionId);
        if (!currentRoom || currentRoom.host) return;
        endSession(joinedSessionId, currentRoom, 'host_disconnected');
      }, HOST_DISCONNECT_GRACE_MS);
    }
    if (role === 'guest') {
      room.guests.delete(socket);
    }

    broadcastState(joinedSessionId, room);
  });
});

const cleanupTimer = setInterval(cleanupRooms, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      socket.missedHeartbeats = (socket.missedHeartbeats ?? 0) + 1;
      if (socket.missedHeartbeats >= HEARTBEAT_MISSES_LIMIT) {
        terminateSocket(socket);
        return;
      }
    } else {
      socket.missedHeartbeats = 0;
    }
    socket.isAlive = false;
    socket.ping();
  });
}, HEARTBEAT_INTERVAL_MS);
heartbeatTimer.unref();

server.listen(PORT, () => {
  console.log(`SkyShare session server listening on port ${PORT}`);
});

function shutdown() {
  clearInterval(cleanupTimer);
  clearInterval(heartbeatTimer);
  rooms.forEach((room, sessionId) => endSession(sessionId, room, 'server_shutdown'));
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
