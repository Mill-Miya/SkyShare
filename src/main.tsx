import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { TARGETS, calculateStars, calculateTargets } from './astronomy';
import {
  clamp,
  drawAurora,
  drawGroundAndMountains,
  drawStars,
  drawTargetObject,
  getZoomBounds,
  normalizeAzimuth,
  shortestAzimuthDelta,
} from './drawing';
import { calculateGuidance, formatDirection, getAltitudeStatus, getAltitudeStatusLabel } from './guidance';
import type {
  ClientWsMessage,
  GuidanceState,
  ObserverLocation,
  Page,
  ServerWsMessage,
  SessionRole,
  ShareMode,
  SharedPointer,
  StarPosition,
  TargetId,
  TargetPosition,
  ViewMetrics,
  ViewState,
} from './types';
import './styles.css';

const FALLBACK_LOCATION: ObserverLocation = {
  latitude: 35.6812,
  longitude: 139.7671,
  fallback: true,
};

const SHEET_ANIMATION_MS = 220;
const VIEW_ANIMATION_MS = 720;

function getWebSocketUrl() {
  const url = new URL('/ws', window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function getJoinSessionId() {
  const match = window.location.pathname.match(/^\/join\/([^/]+)$/);
  return match?.[1] ?? null;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function SkyCanvas({
  positions,
  stars,
  view,
  selectedTargetId,
  nightMode,
  showAurora,
  showAltitudeGuide,
  debug,
  onViewChange,
  onMetricsChange,
  onInteractionStart,
}: {
  positions: TargetPosition[];
  stars: StarPosition[];
  view: ViewState;
  selectedTargetId: TargetId | null;
  nightMode: boolean;
  showAurora: boolean;
  showAltitudeGuide: boolean;
  debug: boolean;
  onViewChange: React.Dispatch<React.SetStateAction<ViewState>>;
  onMetricsChange: (metrics: ViewMetrics) => void;
  onInteractionStart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    lastCenter?: { x: number; y: number };
    lastDistance?: number;
  }>({ pointers: new Map() });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const zoomBounds = getZoomBounds(width);
    const pxPerDeg = clamp(view.zoom, zoomBounds.min, zoomBounds.max);
    const horizontalFovDeg = width / pxPerDeg;
    const verticalFovDeg = height / pxPerDeg;

    onMetricsChange({ width, height, horizontalFovDeg, verticalFovDeg, zoom: pxPerDeg });

    context.clearRect(0, 0, width, height);

    const skyGradient = context.createLinearGradient(0, 0, 0, height);
    if (nightMode) {
      skyGradient.addColorStop(0, '#070000');
      skyGradient.addColorStop(0.55, '#090202');
      skyGradient.addColorStop(1, '#030000');
    } else {
      skyGradient.addColorStop(0, '#051425');
      skyGradient.addColorStop(0.55, '#071a22');
      skyGradient.addColorStop(1, '#10110e');
    }
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, width, height);

    const horizonY = centerY + view.centerAltitudeDeg * pxPerDeg;

    drawStars(context, width, height, view, pxPerDeg, stars, nightMode);
    drawAurora(context, width, height, horizonY, view, nightMode, showAurora);

    if (showAltitudeGuide) {
      const guideColor = nightMode ? 'rgba(255, 92, 74, 0.22)' : 'rgba(190, 223, 242, 0.18)';
      const labelColor = nightMode ? 'rgba(255, 123, 107, 0.58)' : 'rgba(222, 242, 230, 0.56)';
      context.save();
      context.setLineDash([5, 7]);
      context.lineWidth = 1;
      context.font = '500 11px system-ui, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      [0, 30, 60, 90].forEach((altitudeDeg) => {
        const y = centerY - (altitudeDeg - view.centerAltitudeDeg) * pxPerDeg;
        if (y < -16 || y > height + 16) return;
        context.strokeStyle = altitudeDeg === 0 ? 'rgba(255,255,255,0.08)' : guideColor;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
        context.fillStyle = labelColor;
        context.fillText(altitudeDeg === 90 ? '天頂' : `${altitudeDeg}°`, 10, y - 8);
      });
      context.restore();
    }

    drawGroundAndMountains(context, width, height, horizonY, view, pxPerDeg);

    context.fillStyle = nightMode ? 'rgba(255, 86, 70, 0.86)' : 'rgba(222, 242, 230, 0.86)';
    context.font = '600 13px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    [
      { az: 0, label: 'N' },
      { az: 90, label: 'E' },
      { az: 180, label: 'S' },
      { az: 270, label: 'W' },
    ].forEach((direction) => {
      const x = centerX + shortestAzimuthDelta(direction.az, view.centerAzimuthDeg) * pxPerDeg;
      if (x >= 0 && x <= width && horizonY > -20 && horizonY < height + 20) {
        context.fillText(direction.label, x, horizonY - 18);
      }
    });

    context.strokeStyle = nightMode ? 'rgba(255, 78, 58, 0.55)' : 'rgba(255, 255, 255, 0.45)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(centerX - 9, centerY);
    context.lineTo(centerX + 9, centerY);
    context.moveTo(centerX, centerY - 9);
    context.lineTo(centerX, centerY + 9);
    context.stroke();

    if (showAltitudeGuide) {
      context.fillStyle = nightMode ? 'rgba(255, 123, 107, 0.56)' : 'rgba(222, 242, 230, 0.58)';
      context.font = '500 11px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillText(`高度 ${Math.round(view.centerAltitudeDeg)}°`, centerX, centerY + 12);
    }

    if (debug) {
      context.fillStyle = nightMode ? 'rgba(255, 86, 70, 0.78)' : 'rgba(255, 248, 220, 0.7)';
      context.font = '500 11px system-ui, sans-serif';
      context.textAlign = 'left';
      context.fillText(`FOV ${Math.round(horizontalFovDeg)}° x ${Math.round(verticalFovDeg)}°`, 12, 18);
      context.fillText(`zoom ${pxPerDeg.toFixed(1)} px/°`, 12, 34);
    }

    positions.forEach((position) => {
      const x = centerX + shortestAzimuthDelta(position.azimuthDeg, view.centerAzimuthDeg) * pxPerDeg;
      const y = centerY - (position.altitudeDeg - view.centerAltitudeDeg) * pxPerDeg;
      if (x < -80 || x > width + 80 || y < -80 || y > height + 80) return;

      const target = TARGETS.find((item) => item.id === position.id);
      const selected = selectedTargetId === position.id;
      const radius = (target?.radius ?? 5) + (selected ? 1.3 : 0);

      drawTargetObject(context, target, position, x, y, selected, nightMode);

      context.fillStyle = selected
        ? nightMode
          ? '#ff705e'
          : '#fff0aa'
        : position.altitudeDeg >= 0
          ? nightMode
            ? 'rgba(255, 112, 94, 0.86)'
            : '#f7f2dc'
          : nightMode
            ? 'rgba(255, 112, 94, 0.42)'
            : 'rgba(247, 242, 220, 0.55)';
      context.font = selected ? '700 13px system-ui, sans-serif' : '600 12px system-ui, sans-serif';
      context.fillText(target?.label ?? position.id, x, y - radius - 12);
    });
  }, [debug, nightMode, onMetricsChange, positions, selectedTargetId, showAltitudeGuide, showAurora, stars, view]);

  function getPointerInfo() {
    const pointers = [...gestureRef.current.pointers.values()];
    if (pointers.length === 0) return null;
    const center = {
      x: pointers.reduce((sum, pointer) => sum + pointer.x, 0) / pointers.length,
      y: pointers.reduce((sum, pointer) => sum + pointer.y, 0) / pointers.length,
    };
    const distance =
      pointers.length >= 2
        ? Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y)
        : undefined;
    return { center, distance };
  }

  return (
    <canvas
      ref={canvasRef}
      className="sky-canvas"
      onPointerDown={(event) => {
        onInteractionStart();
        event.currentTarget.setPointerCapture(event.pointerId);
        gestureRef.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const info = getPointerInfo();
        gestureRef.current.lastCenter = info?.center;
        gestureRef.current.lastDistance = info?.distance;
      }}
      onPointerMove={(event) => {
        if (!gestureRef.current.pointers.has(event.pointerId)) return;
        gestureRef.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const info = getPointerInfo();
        if (!info || !gestureRef.current.lastCenter) return;

        const dx = info.center.x - gestureRef.current.lastCenter.x;
        const dy = info.center.y - gestureRef.current.lastCenter.y;
        const width = event.currentTarget.getBoundingClientRect().width;
        const zoomBounds = getZoomBounds(width);
        const pinchRatio =
          info.distance && gestureRef.current.lastDistance ? info.distance / gestureRef.current.lastDistance : 1;

        onViewChange((current) => {
          const currentZoom = clamp(current.zoom, zoomBounds.min, zoomBounds.max);
          const nextZoom = clamp(currentZoom * pinchRatio, zoomBounds.min, zoomBounds.max);

          return {
            centerAzimuthDeg: normalizeAzimuth(current.centerAzimuthDeg - dx / currentZoom),
            centerAltitudeDeg: clamp(current.centerAltitudeDeg + dy / currentZoom, -90, 90),
            zoom: nextZoom,
          };
        });

        gestureRef.current.lastCenter = info.center;
        gestureRef.current.lastDistance = info.distance;
      }}
      onPointerUp={(event) => {
        gestureRef.current.pointers.delete(event.pointerId);
        const info = getPointerInfo();
        gestureRef.current.lastCenter = info?.center;
        gestureRef.current.lastDistance = info?.distance;
      }}
      onPointerCancel={(event) => {
        gestureRef.current.pointers.delete(event.pointerId);
        const info = getPointerInfo();
        gestureRef.current.lastCenter = info?.center;
        gestureRef.current.lastDistance = info?.distance;
      }}
    />
  );
}

function App() {
  const [location, setLocation] = useState<ObserverLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState('位置情報を取得中');
  const [time, setTime] = useState(() => new Date());
  const [page, setPage] = useState<Page>('sky');
  const [selectedTargetId, setSelectedTargetId] = useState<TargetId | null>(null);
  const [sessionRole, setSessionRole] = useState<SessionRole>('none');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sharedTargetId, setSharedTargetId] = useState<TargetId | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>('off');
  const [sharedPointer, setSharedPointer] = useState<SharedPointer | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [joinUrl, setJoinUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [tabResetTick, setTabResetTick] = useState(0);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [guidanceSuppressed, setGuidanceSuppressed] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [showAurora, setShowAurora] = useState(true);
  const [showAltitudeGuide, setShowAltitudeGuide] = useState(true);
  const [view, setView] = useState<ViewState>({
    centerAzimuthDeg: 180,
    centerAltitudeDeg: 25,
    zoom: 7,
  });
  const [viewMetrics, setViewMetrics] = useState<ViewMetrics | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectRoleRef = useRef<SessionRole>('none');
  const reconnectSessionIdRef = useRef<string | null>(null);
  const sheetCloseTimerRef = useRef<number | null>(null);
  const viewAnimationRef = useRef<number | null>(null);
  const lastPointerSendRef = useRef<{ azimuthDeg: number; altitudeDeg: number; time: number } | null>(null);

  const debug = useMemo(() => new URLSearchParams(window.location.search).get('debug') === '1', []);

  function clearSheetCloseTimer() {
    if (sheetCloseTimerRef.current !== null) {
      window.clearTimeout(sheetCloseTimerRef.current);
      sheetCloseTimerRef.current = null;
    }
  }

  function cancelViewAnimation(resetGuidance = true) {
    if (viewAnimationRef.current !== null) {
      window.cancelAnimationFrame(viewAnimationRef.current);
      viewAnimationRef.current = null;
    }
    if (resetGuidance) {
      setGuidanceSuppressed(false);
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  function sendSessionMessage(message: ClientWsMessage) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function resetSessionState(notice: string | null = null) {
    clearReconnectTimer();
    reconnectRoleRef.current = 'none';
    reconnectSessionIdRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    setSessionRole('none');
    setSessionId(null);
    setSharedTargetId(null);
    setShareMode('off');
    setSharedPointer(null);
    setParticipantCount(0);
    setConnectionStatus('disconnected');
    setJoinUrl('');
    setQrCodeUrl('');
    setSessionError(null);
    setSessionNotice(notice);
    if (window.location.pathname.startsWith('/join/')) {
      window.history.replaceState(null, '', '/');
    }
  }

  function leaveSession() {
    const socket = socketRef.current;
    if (sessionRole === 'host' && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'session:end' } satisfies ClientWsMessage));
      window.setTimeout(() => resetSessionState(), 80);
      return;
    }
    resetSessionState();
  }

  function scheduleReconnect() {
    if (reconnectRoleRef.current === 'none' || !reconnectSessionIdRef.current) return;
    clearReconnectTimer();
    setConnectionStatus('reconnecting');
    reconnectTimerRef.current = window.setTimeout(() => {
      connectSession(reconnectRoleRef.current, reconnectSessionIdRef.current!, true);
    }, 3000);
  }

  function handleSessionMessage(message: ServerWsMessage) {
    if (message.type === 'session:state') {
      const nextShareMode = message.shareMode ?? (message.targetId ? 'target' : 'off');
      setSessionId(message.sessionId);
      setSharedTargetId(message.targetId);
      setShareMode(nextShareMode);
      setSharedPointer(message.pointer ?? null);
      setParticipantCount(message.participantCount);
      setSessionError(null);
      if (message.targetId) {
        setSelectedTargetId(message.targetId);
      }
      return;
    }

    if (message.type === 'target:update') {
      const nextShareMode = message.shareMode ?? (message.targetId ? 'target' : 'off');
      setSharedTargetId(message.targetId);
      setShareMode(nextShareMode);
      setSharedPointer(null);
      if (message.targetId) {
        setSelectedTargetId(message.targetId);
      }
      return;
    }

    if (message.type === 'pointer:update') {
      setSharedTargetId(null);
      setShareMode('pointer');
      setSharedPointer({ azimuthDeg: message.azimuth, altitudeDeg: message.altitude });
      return;
    }

    if (message.type === 'session:ended') {
      const notice =
        message.reason === 'host_disconnected'
          ? 'ホストの接続が切れたためセッションが終了しました'
          : message.reason === 'server_shutdown'
            ? 'サーバー停止によりセッションが終了しました'
            : 'ホストがセッションを終了しました';
      resetSessionState(notice);
      setPage('session');
      return;
    }

    if (message.type === 'error') {
      setSessionError(message.code);
    }
  }

  function connectSession(role: SessionRole, nextSessionId: string, reconnect = false) {
    if (role === 'none') return;

    clearReconnectTimer();
    socketRef.current?.close();
    setConnectionStatus(reconnect ? 'reconnecting' : 'connecting');
    setSessionRole(role);
    setSessionId(nextSessionId);
    reconnectRoleRef.current = role;
    reconnectSessionIdRef.current = nextSessionId;

    const socket = new WebSocket(getWebSocketUrl());
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnectionStatus('connected');
      sendSessionMessage({ type: role === 'host' ? 'host:join' : 'guest:join', sessionId: nextSessionId });
      if (role === 'host' && shareMode === 'target') {
        window.setTimeout(
          () => sendSessionMessage({ type: 'target:update', targetId: selectedTargetId, shareMode: 'target' }),
          0,
        );
      }
    });

    socket.addEventListener('message', (event) => {
      try {
        handleSessionMessage(JSON.parse(String(event.data)) as ServerWsMessage);
      } catch {
        setSessionError('INVALID_MESSAGE');
      }
    });

    socket.addEventListener('close', () => {
      if (socketRef.current !== socket) return;

      socketRef.current = null;
      if (reconnectRoleRef.current === 'guest') {
        scheduleReconnect();
      } else {
        setConnectionStatus('disconnected');
      }
    });

    socket.addEventListener('error', () => {
      setSessionError('CONNECTION_ERROR');
    });
  }

  async function createHostSession() {
    setSessionError(null);
    setSessionNotice(null);
    const response = await fetch('/api/session', { method: 'POST' });
    if (!response.ok) {
      setSessionError('SESSION_CREATE_FAILED');
      return;
    }

    const payload = (await response.json()) as { sessionId: string };
    setSharedTargetId(selectedTargetId);
    setShareMode(selectedTargetId ? 'target' : 'off');
    setSharedPointer(null);
    const nextJoinUrl = `${window.location.origin}/join/${payload.sessionId}`;
    setJoinUrl(nextJoinUrl);
    setQrCodeUrl(await QRCode.toDataURL(nextJoinUrl, { margin: 1, width: 220 }));
    connectSession('host', payload.sessionId);
  }

  function stopSharingTarget() {
    if (sessionRole !== 'host') return;
    setSharedTargetId(null);
    setShareMode('off');
    setSharedPointer(null);
    sendSessionMessage({ type: 'target:update', targetId: null, shareMode: 'off' });
  }

  function startSharingTarget() {
    if (sessionRole !== 'host') return;
    setSharedTargetId(selectedTargetId);
    setShareMode('target');
    setSharedPointer(null);
    sendSessionMessage({ type: 'target:update', targetId: selectedTargetId, shareMode: 'target' });
  }

  function startPointerSharing() {
    if (sessionRole !== 'host') return;
    const pointer = { azimuthDeg: view.centerAzimuthDeg, altitudeDeg: view.centerAltitudeDeg };
    setSharedTargetId(null);
    setShareMode('pointer');
    setSharedPointer(pointer);
    lastPointerSendRef.current = { ...pointer, time: performance.now() };
    sendSessionMessage({
      type: 'pointer:update',
      azimuth: pointer.azimuthDeg,
      altitude: pointer.altitudeDeg,
    });
  }

  function joinGuestSession(nextSessionId: string) {
    const normalizedSessionId = nextSessionId.trim().toUpperCase();
    if (!normalizedSessionId) return;
    setSessionError(null);
    setSessionNotice(null);
    setJoinUrl(`${window.location.origin}/join/${normalizedSessionId}`);
    connectSession('guest', normalizedSessionId);
    setPage('session');
  }

  function closeSheet() {
    if (page === 'sky') return;
    clearSheetCloseTimer();
    if (prefersReducedMotion()) {
      setSheetClosing(false);
      setPage('sky');
      return;
    }
    setSheetClosing(true);
    sheetCloseTimerRef.current = window.setTimeout(() => {
      setPage('sky');
      setSheetClosing(false);
      sheetCloseTimerRef.current = null;
    }, SHEET_ANIMATION_MS);
  }

  function animateViewTo(position: TargetPosition) {
    cancelViewAnimation();
    setGuidanceSuppressed(true);
    const targetAltitudeDeg = clamp(position.altitudeDeg, -90, 80);

    if (prefersReducedMotion()) {
      setView((current) => ({
        ...current,
        centerAzimuthDeg: position.azimuthDeg,
        centerAltitudeDeg: targetAltitudeDeg,
      }));
      setGuidanceSuppressed(false);
      return;
    }

    const startView = view;
    const azimuthDelta = shortestAzimuthDelta(position.azimuthDeg, startView.centerAzimuthDeg);
    const altitudeDelta = targetAltitudeDeg - startView.centerAltitudeDeg;
    const zoomBounds = viewMetrics ? getZoomBounds(viewMetrics.width) : null;
    const zoomOut = zoomBounds
      ? clamp(startView.zoom * 0.85, zoomBounds.min, zoomBounds.max)
      : startView.zoom * 0.85;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = clamp((now - startedAt) / VIEW_ANIMATION_MS, 0, 1);
      const moveProgress = 1 - Math.pow(1 - progress, 3);
      const zoomProgress =
        progress < 0.28
          ? progress / 0.28
          : progress > 0.72
            ? 1 - (progress - 0.72) / 0.28
            : 1;
      const zoomEase = 0.5 - Math.cos(clamp(zoomProgress, 0, 1) * Math.PI) / 2;

      setView((current) => ({
        ...current,
        centerAzimuthDeg: normalizeAzimuth(startView.centerAzimuthDeg + azimuthDelta * moveProgress),
        centerAltitudeDeg: clamp(startView.centerAltitudeDeg + altitudeDelta * moveProgress, -90, 90),
        zoom: startView.zoom + (zoomOut - startView.zoom) * zoomEase,
      }));

      if (progress < 1) {
        viewAnimationRef.current = window.requestAnimationFrame(step);
      } else {
        viewAnimationRef.current = null;
        setGuidanceSuppressed(false);
      }
    };

    viewAnimationRef.current = window.requestAnimationFrame(step);
  }

  function handleNavClick(nextPage: Page) {
    if (page === nextPage) {
      if (nextPage === 'sky') {
        setTabResetTick((tick) => tick + 1);
        return;
      }
      closeSheet();
      return;
    }
    clearSheetCloseTimer();
    setSheetClosing(false);
    setPage(nextPage);
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(FALLBACK_LOCATION);
      setLocationStatus('GPS非対応のため東京駅付近を使用');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus('現在地を使用中');
      },
      () => {
        setLocation(FALLBACK_LOCATION);
        setLocationStatus('GPS取得失敗: 東京駅付近を使用');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    const joinSessionId = getJoinSessionId();
    if (joinSessionId) {
      joinGuestSession(joinSessionId);
    }

    return () => {
      clearReconnectTimer();
      clearSheetCloseTimer();
      cancelViewAnimation(false);
      socketRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sessionRole !== 'host' || shareMode !== 'target') return;
    setSharedTargetId(selectedTargetId);
    sendSessionMessage({ type: 'target:update', targetId: selectedTargetId, shareMode: 'target' });
  }, [selectedTargetId, sessionRole, shareMode]);

  useEffect(() => {
    if (sessionRole !== 'host' || shareMode !== 'pointer') return;
    const now = performance.now();
    const last = lastPointerSendRef.current;
    const changedEnough =
      !last ||
      Math.abs(shortestAzimuthDelta(view.centerAzimuthDeg, last.azimuthDeg)) >= 0.35 ||
      Math.abs(view.centerAltitudeDeg - last.altitudeDeg) >= 0.35;
    const waitedEnough = !last || now - last.time >= 80;

    if (!changedEnough || !waitedEnough) return;

    const pointer = { azimuthDeg: view.centerAzimuthDeg, altitudeDeg: view.centerAltitudeDeg };
    lastPointerSendRef.current = { ...pointer, time: now };
    setSharedPointer(pointer);
    sendSessionMessage({
      type: 'pointer:update',
      azimuth: pointer.azimuthDeg,
      altitude: pointer.altitudeDeg,
    });
  }, [sessionRole, shareMode, view.centerAzimuthDeg, view.centerAltitudeDeg]);

  const positions = useMemo(() => {
    if (!location) return [];
    return calculateTargets(location, time);
  }, [location, time]);

  const stars = useMemo(() => {
    if (!location) return [];
    return calculateStars(location, time);
  }, [location, time]);

  const activeTargetId = sessionRole === 'guest' ? (shareMode === 'target' ? sharedTargetId : null) : selectedTargetId;
  const selectedPosition = positions.find((position) => position.id === activeTargetId) ?? null;
  const guidance: GuidanceState | null = selectedPosition ? calculateGuidance(selectedPosition, view) : null;
  const selectedStatus = selectedPosition ? getAltitudeStatus(selectedPosition.altitudeDeg) : null;

  return (
    <main className={`app-shell ${nightMode ? 'night-mode' : ''}`}>
      <section className="top-bar">
        <div>
          <h1>Sky</h1>
          <p>{locationStatus}</p>
        </div>
        <button type="button" onClick={() => setTime(new Date())}>
          Now
        </button>
      </section>

      <section className="sky-panel">
        <SkyCanvas
          positions={positions}
          stars={stars}
          view={view}
          selectedTargetId={activeTargetId}
          nightMode={nightMode}
          showAurora={showAurora}
          showAltitudeGuide={showAltitudeGuide}
          debug={debug}
          onViewChange={setView}
          onInteractionStart={cancelViewAnimation}
          onMetricsChange={(nextMetrics) => {
            setViewMetrics((current) => {
              if (
                current &&
                Math.abs(current.width - nextMetrics.width) < 1 &&
                Math.abs(current.height - nextMetrics.height) < 1 &&
                Math.abs(current.horizontalFovDeg - nextMetrics.horizontalFovDeg) < 0.1 &&
                Math.abs(current.verticalFovDeg - nextMetrics.verticalFovDeg) < 0.1 &&
                Math.abs(current.zoom - nextMetrics.zoom) < 0.1
              ) {
                return current;
              }
              return nextMetrics;
            });
          }}
        />
        {debug && (
          <div className="view-readout">
            <span>{formatDirection(view.centerAzimuthDeg)}</span>
            <span>Az {Math.round(view.centerAzimuthDeg)}°</span>
            <span>Alt {Math.round(view.centerAltitudeDeg)}°</span>
            <span>Zoom {viewMetrics?.zoom.toFixed(1) ?? view.zoom.toFixed(1)}</span>
            <span>FOV {viewMetrics ? `${Math.round(viewMetrics.horizontalFovDeg)}°` : '--'}</span>
          </div>
        )}
        {!guidanceSuppressed && guidance && selectedPosition && (
          <GuidanceOverlay
            guidance={guidance}
            selectedPosition={selectedPosition}
            selectedStatus={selectedStatus}
            nightMode={nightMode}
            sharedByHost={sessionRole === 'guest' && sharedTargetId === selectedPosition.id}
          />
        )}
        {sessionRole === 'guest' && !sharedTargetId && (
          <div className="shared-empty-note">
            {shareMode === 'pointer' ? '方向案内中' : '共有されている天体はありません'}
          </div>
        )}
        {sessionRole === 'guest' && shareMode === 'pointer' && sharedPointer && viewMetrics && (
          <PointerOverlay pointer={sharedPointer} view={view} metrics={viewMetrics} />
        )}
      </section>

      {page !== 'sky' && (
        <div className={`sheet-layer ${sheetClosing ? 'closing' : ''}`} onClick={closeSheet}>
          <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="sheet-close" onClick={closeSheet}>
              閉じる
            </button>
            {page === 'targets' && (
              <TargetsPage
                positions={positions}
                selectedTargetId={sessionRole === 'guest' ? activeTargetId : selectedTargetId}
                onClear={() => {
                  setSelectedTargetId(null);
                  setGuidanceSuppressed(false);
                  closeSheet();
                }}
                onSelect={(targetId, position) => {
                  setGuidanceSuppressed(true);
                  setSelectedTargetId(targetId);
                  closeSheet();
                  window.setTimeout(
                    () => animateViewTo(position),
                    prefersReducedMotion() ? 0 : SHEET_ANIMATION_MS,
                  );
                }}
              />
            )}
            {page === 'session' && (
              <SessionPage
                role={sessionRole}
                sessionId={sessionId}
                sharedTargetId={sharedTargetId}
                shareMode={shareMode}
                sharedPointer={sharedPointer}
                selectedTargetId={selectedTargetId}
                participantCount={participantCount}
                connectionStatus={connectionStatus}
                joinUrl={joinUrl}
                qrCodeUrl={qrCodeUrl}
                sessionError={sessionError}
                sessionNotice={sessionNotice}
                resetSignal={tabResetTick}
                onCreateHostSession={createHostSession}
                onJoinGuestSession={joinGuestSession}
                onLeaveSession={leaveSession}
                onStartSharing={startSharingTarget}
                onStopSharing={stopSharingTarget}
                onStartPointerSharing={startPointerSharing}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                nightMode={nightMode}
                showAurora={showAurora}
                showAltitudeGuide={showAltitudeGuide}
                onNightModeChange={setNightMode}
                onShowAuroraChange={setShowAurora}
                onShowAltitudeGuideChange={setShowAltitudeGuide}
              />
            )}
          </section>
        </div>
      )}

      <nav className="bottom-nav" aria-label="画面切り替え">
        <button type="button" className={page === 'sky' ? 'active' : ''} onClick={() => handleNavClick('sky')}>
          Sky
        </button>
        <button type="button" className={page === 'targets' ? 'active' : ''} onClick={() => handleNavClick('targets')}>
          Targets
        </button>
        <button type="button" className={page === 'session' ? 'active' : ''} onClick={() => handleNavClick('session')}>
          Session
        </button>
        <button type="button" className={page === 'settings' ? 'active' : ''} onClick={() => handleNavClick('settings')}>
          Settings
        </button>
      </nav>
    </main>
  );
}

function GuidanceOverlay({
  guidance,
  selectedPosition,
  selectedStatus,
  nightMode,
  sharedByHost,
}: {
  guidance: GuidanceState;
  selectedPosition: TargetPosition;
  selectedStatus: ReturnType<typeof getAltitudeStatus> | null;
  nightMode: boolean;
  sharedByHost: boolean;
}) {
  const target = TARGETS.find((item) => item.id === selectedPosition.id);
  const statusLabel = selectedStatus ? getAltitudeStatusLabel(selectedStatus) : '';
  const distanceDeg = Math.hypot(guidance.deltaAzimuthDeg, guidance.deltaAltitudeDeg);
  const maxDistanceDeg = 45;
  const maxPointerRadiusPx = 26;
  const pointerRadiusPx =
    (Math.min(distanceDeg, maxDistanceDeg) / maxDistanceDeg) * maxPointerRadiusPx;
  const nearCenter = pointerRadiusPx <= 12;
  const unitX = distanceDeg > 0 ? guidance.deltaAzimuthDeg / distanceDeg : 0;
  const unitY = distanceDeg > 0 ? -guidance.deltaAltitudeDeg / distanceDeg : 0;
  const pointerX = unitX * pointerRadiusPx;
  const pointerY = unitY * pointerRadiusPx;
  const compassCenter = 36;
  const tipX = compassCenter + unitX * (pointerRadiusPx + 7);
  const tipY = compassCenter + unitY * (pointerRadiusPx + 7);
  const baseX = compassCenter + unitX * (pointerRadiusPx - 7);
  const baseY = compassCenter + unitY * (pointerRadiusPx - 7);
  const notchX = compassCenter + unitX * (pointerRadiusPx - 2);
  const notchY = compassCenter + unitY * (pointerRadiusPx - 2);
  const perpX = -unitY;
  const perpY = unitX;
  const halfBase = 7;
  const trianglePoints = [
    `${tipX.toFixed(1)},${tipY.toFixed(1)}`,
    `${(baseX + perpX * halfBase).toFixed(1)},${(baseY + perpY * halfBase).toFixed(1)}`,
    `${notchX.toFixed(1)},${notchY.toFixed(1)}`,
    `${(baseX - perpX * halfBase).toFixed(1)},${(baseY - perpY * halfBase).toFixed(1)}`,
  ].join(' ');

  return (
    <div className={`guidance-panel ${guidance.acquired ? 'acquired' : ''} ${nightMode ? 'night' : ''}`}>
      <div className="guidance-target">{target?.label ?? selectedPosition.id}</div>
      {sharedByHost && <div className="shared-badge">Host共有中</div>}
      <div className="guidance-compass" aria-label={`誘導 ${guidance.arrow}`}>
        {guidance.acquired ? (
          <span className="guidance-acquired-symbol">◎</span>
        ) : nearCenter ? (
          <span
            className="guidance-near-dot"
            style={{
              transform: `translate(calc(-50% + ${pointerX}px), calc(-50% + ${pointerY}px))`,
            }}
          />
        ) : (
          <svg className="guidance-vector" viewBox="0 0 72 72" aria-hidden="true">
            <polygon className="guidance-triangle" points={trianglePoints} />
          </svg>
        )}
      </div>
      <div className="guidance-lines">
        <span>{guidance.horizontalText}</span>
        <span>{guidance.verticalText}</span>
      </div>
      <div className="guidance-meta">
        方位 {Math.round(selectedPosition.azimuthDeg)}° / 高度 {Math.round(selectedPosition.altitudeDeg)}°
      </div>
      {guidance.acquired && <div className="target-acquired">捕捉しました</div>}
      {selectedStatus !== 'visible' && <div className={`altitude-warning ${selectedStatus}`}>{statusLabel}</div>}
    </div>
  );
}

function PointerOverlay({
  pointer,
  view,
  metrics,
}: {
  pointer: SharedPointer;
  view: ViewState;
  metrics: ViewMetrics;
}) {
  const centerX = metrics.width / 2;
  const centerY = metrics.height / 2;
  const deltaAzimuth = shortestAzimuthDelta(pointer.azimuthDeg, view.centerAzimuthDeg);
  const deltaAltitude = pointer.altitudeDeg - view.centerAltitudeDeg;
  const rawX = centerX + deltaAzimuth * metrics.zoom;
  const rawY = centerY - deltaAltitude * metrics.zoom;
  const x = clamp(rawX, 22, metrics.width - 22);
  const y = clamp(rawY, 22, metrics.height - 22);
  const offscreen = rawX !== x || rawY !== y;

  return (
    <div
      className={`pointer-marker ${offscreen ? 'edge' : ''}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      aria-label="方向案内"
    >
      <span />
    </div>
  );
}

function TargetsPage({
  positions,
  selectedTargetId,
  onClear,
  onSelect,
}: {
  positions: TargetPosition[];
  selectedTargetId: TargetId | null;
  onClear: () => void;
  onSelect: (targetId: TargetId, position: TargetPosition) => void;
}) {
  return (
    <section className="page-panel targets-page">
      <button type="button" className={`target-row clear ${selectedTargetId === null ? 'selected' : ''}`} onClick={onClear}>
        <strong>選択なし</strong>
        <span>天体を選ばずに空を見る</span>
      </button>
      {positions.map((position) => {
        const target = TARGETS.find((item) => item.id === position.id);
        const status = getAltitudeStatus(position.altitudeDeg);
        const selected = selectedTargetId === position.id;

        return (
          <button
            type="button"
            key={position.id}
            className={`target-row ${selected ? 'selected' : ''} ${status}`}
            onClick={() => onSelect(position.id, position)}
          >
            <span className="target-color" style={{ background: target?.color }} />
            <strong>{target?.label ?? position.id}</strong>
            <span>{formatDirection(position.azimuthDeg)}</span>
            <span>方位 {Math.round(position.azimuthDeg)}°</span>
            <span>高度 {Math.round(position.altitudeDeg)}°</span>
            <span className="target-status">{getAltitudeStatusLabel(status)}</span>
          </button>
        );
      })}
    </section>
  );
}

function SessionPage({
  role,
  sessionId,
  sharedTargetId,
  shareMode,
  sharedPointer,
  selectedTargetId,
  participantCount,
  connectionStatus,
  joinUrl,
  qrCodeUrl,
  sessionError,
  sessionNotice,
  resetSignal,
  onCreateHostSession,
  onJoinGuestSession,
  onLeaveSession,
  onStartSharing,
  onStopSharing,
  onStartPointerSharing,
}: {
  role: SessionRole;
  sessionId: string | null;
  sharedTargetId: TargetId | null;
  shareMode: ShareMode;
  sharedPointer: SharedPointer | null;
  selectedTargetId: TargetId | null;
  participantCount: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  joinUrl: string;
  qrCodeUrl: string;
  sessionError: string | null;
  sessionNotice: string | null;
  resetSignal: number;
  onCreateHostSession: () => void;
  onJoinGuestSession: (sessionId: string) => void;
  onLeaveSession: () => void;
  onStartSharing: () => void;
  onStopSharing: () => void;
  onStartPointerSharing: () => void;
}) {
  const [joinCode, setJoinCode] = useState('');
  const [entryMode, setEntryMode] = useState<'choose' | 'join' | 'create'>('choose');
  const [joinMethod, setJoinMethod] = useState<'none' | 'qr' | 'code'>('none');
  const sharedTarget = TARGETS.find((target) => target.id === sharedTargetId);
  const sharingEnabled = shareMode !== 'off';
  const connectionLabel =
    connectionStatus === 'connected'
      ? '接続中'
      : connectionStatus === 'connecting'
        ? '接続中'
        : connectionStatus === 'reconnecting'
          ? '再接続中'
          : '切断';

  useEffect(() => {
    if (role !== 'none') {
      setEntryMode('choose');
      setJoinMethod('none');
    }
  }, [role]);

  useEffect(() => {
    if (role === 'none') {
      setEntryMode('choose');
      setJoinMethod('none');
    }
  }, [resetSignal, role]);

  if (role === 'none') {
    if (entryMode === 'join') {
      return (
        <section className="page-panel session-page">
          {sessionNotice && <div className="session-warning">{sessionNotice}</div>}
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setJoinMethod('none');
              setEntryMode('choose');
            }}
          >
            ← 戻る
          </button>
          <div className="session-card">
            <h2>参加</h2>
            <div className="session-methods">
              <button
                type="button"
                className={joinMethod === 'qr' ? 'active' : ''}
                onClick={() => setJoinMethod((current) => (current === 'qr' ? 'none' : 'qr'))}
              >
                QRで参加
              </button>
              <button
                type="button"
                className={joinMethod === 'code' ? 'active' : ''}
                onClick={() => setJoinMethod((current) => (current === 'code' ? 'none' : 'code'))}
              >
                コードで参加
              </button>
            </div>
            {joinMethod === 'qr' && <p className="session-note">端末のカメラで読み取れます。</p>}
            {joinMethod === 'code' && (
              <form
                className="session-inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onJoinGuestSession(joinCode);
                }}
              >
                <label className="session-input-row">
                  <span>コード</span>
                  <input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder="ABC123"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </label>
                <button type="submit" className="primary-action">
                  参加
                </button>
              </form>
            )}
          </div>
          {sessionError && <div className="session-error">Error: {sessionError}</div>}
        </section>
      );
    }

    if (entryMode === 'create') {
      return (
        <section className="page-panel session-page">
          {sessionNotice && <div className="session-warning">{sessionNotice}</div>}
          <button type="button" className="secondary-action" onClick={() => setEntryMode('choose')}>
            ← 戻る
          </button>
          <div className="session-card">
            <h2>観望会を始める</h2>
            <p>参加者には選択した天体だけが共有されます。</p>
            <ul className="session-list">
              <li>向きは共有されません</li>
              <li>現在地は共有されません</li>
              <li>時刻は共有されません</li>
            </ul>
            <button type="button" className="primary-action" onClick={onCreateHostSession}>
              始める
            </button>
          </div>
          {sessionError && <div className="session-error">Error: {sessionError}</div>}
        </section>
      );
    }

    return (
      <section className="page-panel session-page">
        {sessionNotice && <div className="session-warning">{sessionNotice}</div>}
        <div className="session-choice">
          <h2>Session</h2>
          <p>観望会に参加しますか？</p>
          <button type="button" className="session-choice-button primary-choice" onClick={() => setEntryMode('join')}>
            参加する
          </button>
          <button type="button" className="session-choice-button" onClick={() => setEntryMode('create')}>
            始める
          </button>
        </div>
        {sessionError && <div className="session-error">Error: {sessionError}</div>}
      </section>
    );
  }

  if (role === 'host') {
    return (
      <section className="page-panel session-page">
        <div className="session-card">
          <h2>観望会</h2>
          <dl className="session-facts">
            <div>
              <dt>コード</dt>
              <dd>{sessionId}</dd>
            </div>
            <div>
              <dt>状態</dt>
              <dd>
                <span className={`connection-pill ${connectionStatus}`}>{connectionLabel}</span>
              </dd>
            </div>
            <div>
              <dt>参加者</dt>
              <dd>{participantCount}人</dd>
            </div>
            <div>
              <dt>共有中</dt>
              <dd>{sharedTarget?.label ?? 'なし'}</dd>
            </div>
          </dl>
          <div className={`sharing-state ${sharingEnabled ? 'on' : 'off'}`}>
            <span>共有: {shareMode === 'target' ? '天体' : shareMode === 'pointer' ? '方向' : 'OFF'}</span>
            <strong>
              {shareMode === 'target'
                ? (sharedTarget?.label ?? '天体未選択')
                : shareMode === 'pointer'
                  ? '方向案内中'
                  : '現在共有中の案内はありません。'}
            </strong>
          </div>
          <div className="share-mode-buttons" aria-label="共有モード">
            <button type="button" className={shareMode === 'off' ? 'active' : ''} onClick={onStopSharing}>
              OFF
            </button>
            <button
              type="button"
              className={shareMode === 'target' ? 'active' : ''}
              onClick={onStartSharing}
            >
              天体
            </button>
            <button type="button" className={shareMode === 'pointer' ? 'active' : ''} onClick={onStartPointerSharing}>
              方向
            </button>
          </div>
          {qrCodeUrl && (
            <div className="qr-block">
              <div className="qr-label">QRを表示</div>
              <img className="qr-code" src={qrCodeUrl} alt="参加用QRコード" />
            </div>
          )}
          {joinUrl && <div className="join-url">{joinUrl}</div>}
          <button type="button" onClick={onLeaveSession}>
            終了
          </button>
        </div>
        {sessionError && <div className="session-error">Error: {sessionError}</div>}
      </section>
    );
  }

  return (
    <section className="page-panel session-page">
      <div className="session-card">
        <h2>参加中</h2>
        <dl className="session-facts">
          <div>
            <dt>コード</dt>
            <dd>{sessionId}</dd>
          </div>
          <div>
            <dt>状態</dt>
            <dd>
              <span className={`connection-pill ${connectionStatus}`}>{connectionLabel}</span>
            </dd>
          </div>
          <div>
            <dt>案内中</dt>
            <dd>{shareMode === 'target' ? (sharedTarget?.label ?? 'なし') : shareMode === 'pointer' ? '方向' : 'なし'}</dd>
          </div>
        </dl>
        {shareMode === 'off' && <div className="session-note">現在共有されている案内はありません。</div>}
        {shareMode === 'pointer' && sharedPointer && <div className="session-note">Hostが説明中です。</div>}
        {connectionStatus === 'reconnecting' && <div className="session-warning">再接続中...</div>}
        <button type="button" onClick={onLeaveSession}>
          退出
        </button>
      </div>
      {sessionError && <div className="session-error">Error: {sessionError}</div>}
    </section>
  );
}

function SettingsPage({
  nightMode,
  showAurora,
  showAltitudeGuide,
  onNightModeChange,
  onShowAuroraChange,
  onShowAltitudeGuideChange,
}: {
  nightMode: boolean;
  showAurora: boolean;
  showAltitudeGuide: boolean;
  onNightModeChange: (enabled: boolean) => void;
  onShowAuroraChange: (enabled: boolean) => void;
  onShowAltitudeGuideChange: (enabled: boolean) => void;
}) {
  return (
    <section className="page-panel settings-page">
      <label className="toggle-row">
        <span>
          <strong>ナイトモード</strong>
          <small>赤系UIで暗順応への影響を抑えます</small>
        </span>
        <input type="checkbox" checked={nightMode} onChange={(event) => onNightModeChange(event.target.checked)} />
      </label>

      <label className="toggle-row">
        <span>
          <strong>背景演出</strong>
          <small>空の雰囲気を少し残します</small>
        </span>
        <input type="checkbox" checked={showAurora} onChange={(event) => onShowAuroraChange(event.target.checked)} />
      </label>

      <label className="toggle-row">
        <span>
          <strong>高度目安</strong>
          <small>空の高さを薄く表示します</small>
        </span>
        <input
          type="checkbox"
          checked={showAltitudeGuide}
          onChange={(event) => onShowAltitudeGuideChange(event.target.checked)}
        />
      </label>

      <div className="settings-note">
        背景や山は方角感を助けるための表示です。
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
