import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import {
  TARGET_CATEGORIES,
  calculateSunPosition,
  calculateStars,
  calculateTargets,
  getSkyBrightnessLabel,
  getSkyBrightnessNote,
  getSkyBrightnessState,
  getKindLabel,
  getTargetDefinition,
} from './astronomy';
import {
  clamp,
  drawAurora,
  drawGroundAndMountains,
  drawSkyBrightnessBackground,
  drawStars,
  drawSunObject,
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
  SkyBrightnessState,
  StarPosition,
  SunPosition,
  TargetId,
  TargetCategory,
  TargetDefinition,
  TargetPosition,
  ViewMetrics,
  ViewState,
} from './types';
import './styles.css';
import './styles/theme-simple.css';

const FALLBACK_LOCATION: ObserverLocation = {
  latitude: 35.6812,
  longitude: 139.7671,
  fallback: true,
};

const SHEET_ANIMATION_MS = 220;
const VIEW_ANIMATION_MS = 720;
const POINTER_SEND_INTERVAL_MS = 50;
const POINTER_SEND_MIN_DELTA_DEG = 0.2;
const POINTER_DISPLAY_SMOOTHING = 0.38;
const POINTER_DISPLAY_MAX_STEP_DEG = 12;
const DEFAULT_PUBLIC_API_BASE_URL = 'https://skyshare-nhcb.onrender.com';
const DEFAULT_PUBLIC_WS_URL = 'wss://skyshare-nhcb.onrender.com/ws';
const SENSOR_INVERT_ALTITUDE_KEY = 'sorava.sensor.invertAltitude.v3';
const UI_THEME_STORAGE_KEY = 'sorava-ui-theme';
const DEFAULT_SENSOR_INVERT_ALTITUDE = true;
const SETTINGS_ADMIN_PASSCODE = 'sorava';
const GUEST_ACCESS_CODE_ENABLED = true;
const DEFAULT_PUBLIC_GUEST_ACCESS_CODE = '0629';
const CONFIGURED_GUEST_ACCESS_CODE = import.meta.env.VITE_GUEST_ACCESS_CODE?.trim() ?? '';
const GUEST_ACCESS_CODE = GUEST_ACCESS_CODE_ENABLED
  ? CONFIGURED_GUEST_ACCESS_CODE || DEFAULT_PUBLIC_GUEST_ACCESS_CODE
  : '';
const MAINTENANCE_UNLOCKED_KEY = 'sorava_maintenance_unlocked_v3';
const MAINTENANCE_UNLOCK_AT_MS = new Date('2026-07-14T19:00:00+09:00').getTime();
const ANDROID_SENSOR_MODE_KEY = 'sorava.sensor.androidMode.v1';

type GuestJoinGateState = {
  status: 'none' | 'pass' | 'rejected';
  sessionId: string | null;
  error: string | null;
};

type UiMode = 'standard' | 'simple';
type AndroidSensorMode = 'a' | 'b' | 'c';

function isGitHubPagesHost() {
  return window.location.hostname === 'mill-miya.github.io';
}

function joinUrlPath(sessionId: string) {
  const basePath = import.meta.env.BASE_URL || '/';
  return `${basePath}${basePath.endsWith('/') ? '' : '/'}join/${sessionId}`;
}

function getWebSocketUrl() {
  const configuredUrl = import.meta.env.VITE_WS_URL || (isGitHubPagesHost() ? DEFAULT_PUBLIC_WS_URL : '');
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/ws';
    }
    return url.toString();
  }

  const url = new URL('/ws', window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function getApiUrl(path: string) {
  const configuredBase = import.meta.env.VITE_API_BASE_URL || (isGitHubPagesHost() ? DEFAULT_PUBLIC_API_BASE_URL : '');
  if (!configuredBase) return path;

  const url = new URL(configuredBase);
  url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`;
  return url.toString();
}

function getJoinSessionId() {
  const basePath = import.meta.env.BASE_URL || '/';
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const path = normalizedBase && window.location.pathname.startsWith(normalizedBase)
    ? window.location.pathname.slice(normalizedBase.length)
    : window.location.pathname;
  const match = path.match(/^\/join\/([^/]+)$/);
  return match?.[1] ?? null;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readStoredBoolean(key: string, fallback: boolean) {
  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue === null) return fallback;
    return storedValue === 'true';
  } catch {
    return fallback;
  }
}

function readStoredAndroidSensorMode(): AndroidSensorMode {
  try {
    const storedValue = window.localStorage.getItem(ANDROID_SENSOR_MODE_KEY);
    return storedValue === 'b' || storedValue === 'c' ? storedValue : 'a';
  } catch {
    return 'a';
  }
}

function readStoredUiMode(): UiMode {
  return 'standard';
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string, value: boolean) {
  try {
    if (value) {
      window.sessionStorage.setItem(key, 'true');
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage can be unavailable in some private browsing modes.
  }
}

function isMaintenanceActive() {
  return Number.isFinite(MAINTENANCE_UNLOCK_AT_MS) && Date.now() < MAINTENANCE_UNLOCK_AT_MS;
}

function getInitialGuestJoinGate(): GuestJoinGateState {
  const sessionId = getJoinSessionId();
  if (!isMaintenanceActive()) return { status: 'none', sessionId, error: null };
  if (!GUEST_ACCESS_CODE) return { status: 'none', sessionId, error: null };
  if (readSessionFlag(MAINTENANCE_UNLOCKED_KEY)) return { status: 'none', sessionId, error: null };
  return { status: 'pass', sessionId, error: null };
}

type SensorPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied' | 'error';
type SensorProfile = 'detecting' | 'ios' | 'android_stable' | 'android_unstable' | 'manual_recommended';

type SensorProbeState = {
  supported: boolean;
  permissionState: SensorPermissionState;
  sensorProfile: SensorProfile;
  eventType: 'deviceorientation' | 'deviceorientationabsolute' | null;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  webkitHeading: number | null;
  azimuthSource: 'webkit' | 'alpha' | null;
  alphaDirection: 1 | -1;
  absolute: boolean | null;
  estimatedAzimuthDeg: number | null;
  rawEstimatedAltitudeDeg: number | null;
  estimatedAltitudeDeg: number | null;
  finalEstimatedAltitudeDeg: number | null;
};

type SensorProfileStats = {
  profile: SensorProfile;
  samples: number;
  largeJumpCount: number;
  jitterScore: number;
  lastAzimuthDeg: number | null;
};

type EstimatedSensorView = {
  estimatedAzimuthDeg: number | null;
  estimatedAltitudeDeg: number | null;
  webkitHeading: number | null;
  alphaDirectAzimuthDeg: number | null;
  alphaAzimuthDeg: number | null;
  useAlphaFallback: boolean;
  azimuthSource: SensorProbeState['azimuthSource'];
};

function supportsDeviceOrientation() {
  return 'DeviceOrientationEvent' in window;
}

function canRequestDeviceOrientationPermission() {
  if (!supportsDeviceOrientation()) return false;
  return typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';
}

function initialSensorProbe(): SensorProbeState {
  const supported = supportsDeviceOrientation();
  return {
    supported,
    permissionState: !supported ? 'unsupported' : canRequestDeviceOrientationPermission() ? 'prompt' : 'granted',
    sensorProfile: 'detecting',
    eventType: null,
    alpha: null,
    beta: null,
    gamma: null,
    webkitHeading: null,
    azimuthSource: null,
    alphaDirection: -1,
    absolute: null,
    estimatedAzimuthDeg: null,
    rawEstimatedAltitudeDeg: null,
    estimatedAltitudeDeg: null,
    finalEstimatedAltitudeDeg: null,
  };
}

function initialSensorProfileStats(): SensorProfileStats {
  return {
    profile: 'detecting',
    samples: 0,
    largeJumpCount: 0,
    jitterScore: 0,
    lastAzimuthDeg: null,
  };
}

function getSensorProfileLabel(profile: SensorProfile) {
  switch (profile) {
    case 'ios':
      return 'iOS';
    case 'android_stable':
      return 'Android安定';
    case 'android_unstable':
      return 'Android補正';
    case 'manual_recommended':
      return '手動推奨';
    case 'detecting':
      return '判定中';
  }
}

function estimateSensorView(event: DeviceOrientationEvent, androidSensorMode: AndroidSensorMode) {
  const alpha = typeof event.alpha === 'number' ? event.alpha : null;
  const beta = typeof event.beta === 'number' ? event.beta : null;
  const gamma = typeof event.gamma === 'number' ? event.gamma : null;
  const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  const alphaDirectAzimuthDeg = alpha !== null ? normalizeAzimuth(alpha) : null;
  const alphaInverseAzimuthDeg = alpha !== null ? normalizeAzimuth(360 - alpha) : null;
  const webkitAzimuthDeg = typeof webkitHeading === 'number' ? normalizeAzimuth(webkitHeading) : null;
  // On iOS, webkitCompassHeading can become sticky when beta passes steep
  // upward angles. In that range, alpha remains movable, but its sign is
  // resolved in the event handler from pre-fallback heading samples.
  const preferAlphaAtSteepAngle =
    webkitAzimuthDeg !== null && beta !== null && Math.abs(beta) > 120 && alphaDirectAzimuthDeg !== null;
  const androidAzimuthDeg =
    androidSensorMode === 'c' && alphaDirectAzimuthDeg !== null ? alphaDirectAzimuthDeg : alphaInverseAzimuthDeg;
  const estimatedAzimuthDeg = preferAlphaAtSteepAngle
    ? alphaDirectAzimuthDeg
    : webkitAzimuthDeg ?? androidAzimuthDeg;
  const azimuthSource: SensorProbeState['azimuthSource'] = estimatedAzimuthDeg === null
    ? null
    : preferAlphaAtSteepAngle || webkitAzimuthDeg === null
      ? 'alpha'
      : 'webkit';
  // iOS keeps the existing beta-based path. Android A/B/C intentionally use
  // different formulas so unstable devices can be compared in the field.
  const androidAltitudeDeg =
    androidSensorMode === 'b'
      ? beta !== null
        ? clamp(90 - beta, -90, 90)
        : null
      : androidSensorMode === 'c'
        ? gamma !== null
          ? clamp(-gamma, -90, 90)
          : beta !== null
            ? clamp(90 - Math.abs(beta), -90, 90)
            : null
        : beta !== null
          ? clamp(90 - Math.abs(beta), -90, 90)
          : null;
  const estimatedAltitudeDeg =
    webkitAzimuthDeg !== null
      ? beta !== null
        ? clamp(90 - Math.abs(beta), -90, 90)
        : null
      : androidAltitudeDeg;

  return {
    estimatedAzimuthDeg,
    estimatedAltitudeDeg,
    webkitHeading: webkitAzimuthDeg,
    alphaDirectAzimuthDeg,
    alphaAzimuthDeg: preferAlphaAtSteepAngle ? alphaDirectAzimuthDeg : alphaInverseAzimuthDeg,
    useAlphaFallback: preferAlphaAtSteepAngle,
    azimuthSource,
  } satisfies EstimatedSensorView;
}

function limitedSensorStep(delta: number, smoothing: number, maxStepDeg: number) {
  if (Math.abs(delta) < 0.12) return 0;
  return clamp(delta * smoothing, -maxStepDeg, maxStepDeg);
}

function SkyCanvas({
  positions,
  stars,
  view,
  selectedTargetId,
  nightMode,
  sunPosition,
  sunAltitudeDeg,
  showAurora,
  showAltitudeGuide,
  sensorModeEnabled,
  showHostPointerCenter,
  debug,
  onViewChange,
  onMetricsChange,
  onInteractionStart,
  onManualGesture,
}: {
  positions: TargetPosition[];
  stars: StarPosition[];
  view: ViewState;
  selectedTargetId: TargetId | null;
  nightMode: boolean;
  sunPosition: SunPosition | null;
  sunAltitudeDeg: number | null;
  showAurora: boolean;
  showAltitudeGuide: boolean;
  sensorModeEnabled: boolean;
  showHostPointerCenter: boolean;
  debug: boolean;
  onViewChange: React.Dispatch<React.SetStateAction<ViewState>>;
  onMetricsChange: (metrics: ViewMetrics) => void;
  onInteractionStart: () => void;
  onManualGesture: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const manualGestureRef = useRef(false);
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

    drawSkyBrightnessBackground(context, width, height, sunAltitudeDeg, nightMode);

    const horizonY = centerY + view.centerAltitudeDeg * pxPerDeg;

    drawStars(context, width, height, view, pxPerDeg, stars, nightMode);
    drawAurora(context, width, height, horizonY, view, nightMode, showAurora);

    if (sunPosition) {
      const sunX = centerX + shortestAzimuthDelta(sunPosition.azimuthDeg, view.centerAzimuthDeg) * pxPerDeg;
      const sunY = centerY - (sunPosition.altitudeDeg - view.centerAltitudeDeg) * pxPerDeg;
      if (sunX >= -80 && sunX <= width + 80 && sunY >= -80 && sunY <= height + 80) {
        drawSunObject(context, sunPosition, sunX, sunY, nightMode, debug);
      }
    }

    if (showAltitudeGuide && debug) {
      const guideColor = nightMode ? 'rgba(255, 92, 74, 0.28)' : 'rgba(190, 223, 242, 0.26)';
      const labelColor = nightMode ? 'rgba(255, 123, 107, 0.66)' : 'rgba(222, 242, 230, 0.66)';
      const toRad = (degrees: number) => (degrees * Math.PI) / 180;
      const centerAzRad = toRad(view.centerAzimuthDeg);
      const centerAltRad = toRad(view.centerAltitudeDeg);
      const centerVector = {
        x: Math.sin(centerAzRad) * Math.cos(centerAltRad),
        y: Math.cos(centerAzRad) * Math.cos(centerAltRad),
        z: Math.sin(centerAltRad),
      };
      const rightVector = {
        x: Math.cos(centerAzRad),
        y: -Math.sin(centerAzRad),
        z: 0,
      };
      const upVector = {
        x: rightVector.y * centerVector.z - rightVector.z * centerVector.y,
        y: rightVector.z * centerVector.x - rightVector.x * centerVector.z,
        z: rightVector.x * centerVector.y - rightVector.y * centerVector.x,
      };
      const focalLength = width / (2 * Math.tan(toRad(horizontalFovDeg) / 2));
      const projectAltAz = (azimuthDeg: number, altitudeDeg: number) => {
        const azimuthRad = toRad(normalizeAzimuth(azimuthDeg));
        const altitudeRad = toRad(altitudeDeg);
        const vector = {
          x: Math.sin(azimuthRad) * Math.cos(altitudeRad),
          y: Math.cos(azimuthRad) * Math.cos(altitudeRad),
          z: Math.sin(altitudeRad),
        };
        const depth =
          vector.x * centerVector.x + vector.y * centerVector.y + vector.z * centerVector.z;
        if (depth <= 0.05) return null;
        const right = vector.x * rightVector.x + vector.y * rightVector.y + vector.z * rightVector.z;
        const up = vector.x * upVector.x + vector.y * upVector.y + vector.z * upVector.z;
        return {
          x: centerX + (right / depth) * focalLength,
          y: centerY - (up / depth) * focalLength,
        };
      };

      context.save();
      context.setLineDash([]);
      context.lineWidth = debug ? 1 : 0;
      context.font = '500 11px system-ui, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      const zenithPoint = projectAltAz(view.centerAzimuthDeg, 90);
      if (zenithPoint && zenithPoint.y > -22 && zenithPoint.y < height + 22) {
        context.fillStyle = debug ? labelColor : guideColor;
        context.beginPath();
        context.arc(zenithPoint.x, zenithPoint.y, debug ? 4 : 2.3, 0, Math.PI * 2);
        context.fill();
        if (debug) {
          context.textAlign = 'center';
          context.fillText('天頂', zenithPoint.x, zenithPoint.y - 16);
        }
      }
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

    if (!showHostPointerCenter) {
      context.strokeStyle = nightMode ? 'rgba(255, 78, 58, 0.55)' : 'rgba(255, 255, 255, 0.45)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(centerX - 9, centerY);
      context.lineTo(centerX + 9, centerY);
      context.moveTo(centerX, centerY - 9);
      context.lineTo(centerX, centerY + 9);
      context.stroke();
    }

    if (debug) {
      context.fillStyle = nightMode ? 'rgba(255, 86, 70, 0.78)' : 'rgba(255, 248, 220, 0.7)';
      context.font = '500 11px system-ui, sans-serif';
      context.textAlign = 'left';
      context.fillText(`FOV ${Math.round(horizontalFovDeg)}° x ${Math.round(verticalFovDeg)}°`, 12, 18);
      context.fillText(`zoom ${pxPerDeg.toFixed(1)} px/°`, 12, 34);
    }

    positions.forEach((position) => {
      const selected = selectedTargetId === position.id;
      const x = centerX + shortestAzimuthDelta(position.azimuthDeg, view.centerAzimuthDeg) * pxPerDeg;
      const y = centerY - (position.altitudeDeg - view.centerAltitudeDeg) * pxPerDeg;
      if (x < -80 || x > width + 80 || y < -80 || y > height + 80) return;

      const target = getTargetDefinition(position.id);
      const radius = (target?.radius ?? 5) + (selected ? 1.3 : 0);

      drawTargetObject(context, target, position, x, y, selected, nightMode);

      const nearSightLine =
        position.altitudeDeg >= 0 &&
        Math.abs(shortestAzimuthDelta(position.azimuthDeg, view.centerAzimuthDeg)) <= 5 &&
        Math.abs(position.altitudeDeg - view.centerAltitudeDeg) <= 5;
      const showLabel =
        selected ||
        debug ||
        nearSightLine;
      if (!showLabel) return;

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

    if (showHostPointerCenter) {
      context.save();
      context.fillStyle = nightMode ? 'rgba(255, 66, 52, 0.94)' : 'rgba(220, 42, 34, 0.96)';
      context.strokeStyle = nightMode ? 'rgba(255, 220, 210, 0.9)' : 'rgba(255, 238, 226, 0.96)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(centerX, centerY - 9);
      context.lineTo(centerX + 9, centerY);
      context.lineTo(centerX, centerY + 9);
      context.lineTo(centerX - 9, centerY);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
  }, [debug, nightMode, onMetricsChange, positions, selectedTargetId, showAltitudeGuide, showAurora, showHostPointerCenter, stars, sunAltitudeDeg, sunPosition, view]);

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
        if (sensorModeEnabled) {
          manualGestureRef.current = true;
          onManualGesture();
        }
        onInteractionStart();
        event.currentTarget.setPointerCapture(event.pointerId);
        gestureRef.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const info = getPointerInfo();
        gestureRef.current.lastCenter = info?.center;
        gestureRef.current.lastDistance = info?.distance;
      }}
      onPointerMove={(event) => {
        if (sensorModeEnabled && !manualGestureRef.current) return;
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
        if (gestureRef.current.pointers.size === 0) {
          manualGestureRef.current = false;
        }
        const info = getPointerInfo();
        gestureRef.current.lastCenter = info?.center;
        gestureRef.current.lastDistance = info?.distance;
      }}
      onPointerCancel={(event) => {
        gestureRef.current.pointers.delete(event.pointerId);
        if (gestureRef.current.pointers.size === 0) {
          manualGestureRef.current = false;
        }
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
  const [displayedSharedPointer, setDisplayedSharedPointer] = useState<SharedPointer | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [joinUrl, setJoinUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [tabResetTick, setTabResetTick] = useState(0);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [guidanceSuppressed, setGuidanceSuppressed] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>(() => readStoredUiMode());
  const [nightMode, setNightMode] = useState(false);
  const [showAurora, setShowAurora] = useState(false);
  const [showAltitudeGuide, setShowAltitudeGuide] = useState(true);
  const [betaFeaturesEnabled, setBetaFeaturesEnabled] = useState(false);
  const [manualTimeEnabled, setManualTimeEnabled] = useState(false);
  const [sensorModeEnabled, setSensorModeEnabled] = useState(false);
  const [sensorProbe, setSensorProbe] = useState<SensorProbeState>(() => initialSensorProbe());
  const [sensorNotice, setSensorNotice] = useState<string | null>(null);
  const [guestJoinGate, setGuestJoinGate] = useState<GuestJoinGateState>(() => getInitialGuestJoinGate());
  const [guestPassInput, setGuestPassInput] = useState('');
  const [androidSensorMode, setAndroidSensorMode] = useState<AndroidSensorMode>(() => readStoredAndroidSensorMode());
  const [invertSensorAltitude, setInvertSensorAltitude] = useState(() =>
    readStoredBoolean(SENSOR_INVERT_ALTITUDE_KEY, DEFAULT_SENSOR_INVERT_ALTITUDE),
  );
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
  const pointerDisplayAnimationRef = useRef<number | null>(null);
  const displayedSharedPointerRef = useRef<SharedPointer | null>(null);
  const targetSharedPointerRef = useRef<SharedPointer | null>(null);
  const manualTimeBaseRef = useRef<{ observationMs: number; realMs: number } | null>(null);
  const smoothedSensorViewRef = useRef<{ azimuthDeg: number; altitudeDeg: number } | null>(null);
  const alphaFallbackOffsetRef = useRef<number | null>(null);
  const alphaFallbackDirectionRef = useRef<1 | -1>(-1);
  const lastAzimuthLearningSampleRef = useRef<{ webkitDeg: number; alphaDirectDeg: number } | null>(null);
  const sensorProfileStatsRef = useRef<SensorProfileStats>(initialSensorProfileStats());
  const lastSensorEventAtRef = useRef(0);
  const lastAbsoluteSensorEventAtRef = useRef(0);

  const guestJoinBlocked = guestJoinGate.status === 'pass' || guestJoinGate.status === 'rejected';

  const debug = useMemo(() => new URLSearchParams(window.location.search).get('debug') === '1', []);

  useEffect(() => {
    try {
      window.localStorage.setItem(UI_THEME_STORAGE_KEY, uiMode);
    } catch {
      // The mode still applies for the current page if storage is unavailable.
    }
  }, [uiMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SENSOR_INVERT_ALTITUDE_KEY, String(invertSensorAltitude));
    } catch {
      // Calibration still works for the current page even if storage is unavailable.
    }
    smoothedSensorViewRef.current = null;
    alphaFallbackOffsetRef.current = null;
    lastAzimuthLearningSampleRef.current = null;
  }, [invertSensorAltitude]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ANDROID_SENSOR_MODE_KEY, androidSensorMode);
    } catch {
      // The selected Android calculation mode still applies for the current page.
    }
    smoothedSensorViewRef.current = null;
    alphaFallbackOffsetRef.current = null;
    sensorProfileStatsRef.current = initialSensorProfileStats();
  }, [androidSensorMode]);

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

  async function requestSensorPermission() {
    if (!supportsDeviceOrientation()) {
      setSensorProbe((current) => ({ ...current, supported: false, permissionState: 'unsupported' }));
      return false;
    }

    const requestPermission = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (!requestPermission) {
      setSensorProbe((current) => ({ ...current, supported: true, permissionState: 'granted' }));
      return true;
    }

    try {
      const result = await requestPermission();
      const granted = result === 'granted';
      setSensorProbe((current) => ({
        ...current,
        supported: true,
        permissionState: granted ? 'granted' : 'denied',
      }));
      return granted;
    } catch {
      setSensorProbe((current) => ({ ...current, supported: true, permissionState: 'error' }));
      return false;
    }
  }

  async function toggleSensorModeFromSky() {
    if (sensorModeEnabled) {
      setSensorModeEnabled(false);
      setSensorNotice(null);
      smoothedSensorViewRef.current = null;
      alphaFallbackOffsetRef.current = null;
      lastAzimuthLearningSampleRef.current = null;
      sensorProfileStatsRef.current = initialSensorProfileStats();
      return;
    }

    if (!sensorProbe.supported) {
      setSensorNotice('センサー非対応');
      window.setTimeout(() => setSensorNotice(null), 2200);
      return;
    }

    if (sensorProbe.permissionState !== 'granted') {
      const granted = await requestSensorPermission();
      if (!granted) {
        setSensorModeEnabled(false);
        setSensorNotice('センサーが許可されていません');
        window.setTimeout(() => setSensorNotice(null), 2400);
        return;
      }
    }

    cancelViewAnimation();
    smoothedSensorViewRef.current = null;
    alphaFallbackOffsetRef.current = null;
    lastAzimuthLearningSampleRef.current = null;
    sensorProfileStatsRef.current = initialSensorProfileStats();
    setSensorModeEnabled(true);
    setSensorNotice(null);
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
    if (getJoinSessionId()) {
      window.history.replaceState(null, '', import.meta.env.BASE_URL || '/');
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
      setSharedTargetId(nextShareMode === 'pointer' ? null : message.targetId);
      setShareMode(nextShareMode);
      setSharedPointer(message.pointer ?? null);
      if (nextShareMode === 'pointer') {
        setGuidanceSuppressed(false);
      }
      setParticipantCount(message.participantCount);
      setSessionError(null);
      if (sessionRole === 'guest' && nextShareMode !== 'off') {
        setSelectedTargetId(null);
      } else if (sessionRole !== 'guest' && nextShareMode === 'target' && message.targetId) {
        setSelectedTargetId(message.targetId);
      }
      return;
    }

    if (message.type === 'target:update') {
      const nextShareMode = message.shareMode ?? (message.targetId ? 'target' : 'off');
      setSharedTargetId(message.targetId);
      setShareMode(nextShareMode);
      setSharedPointer(null);
      if (sessionRole === 'guest' && nextShareMode !== 'off') {
        setSelectedTargetId(null);
      } else if (sessionRole !== 'guest' && message.targetId) {
        setSelectedTargetId(message.targetId);
      }
      return;
    }

    if (message.type === 'pointer:update') {
      setSharedTargetId(null);
      setShareMode('pointer');
      setSharedPointer({ azimuthDeg: message.azimuth, altitudeDeg: message.altitude });
      if (sessionRole === 'guest') {
        setSelectedTargetId(null);
      }
      setGuidanceSuppressed(false);
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
    const response = await fetch(getApiUrl('/api/session'), { method: 'POST' });
    if (!response.ok) {
      setSessionError('SESSION_CREATE_FAILED');
      return;
    }

    const payload = (await response.json()) as { sessionId: string };
    setSharedTargetId(selectedTargetId);
    setShareMode(selectedTargetId ? 'target' : 'off');
    setSharedPointer(null);
    const nextJoinUrl = `${window.location.origin}${joinUrlPath(payload.sessionId)}`;
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
    setGuidanceSuppressed(false);
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
    setJoinUrl(`${window.location.origin}${joinUrlPath(normalizedSessionId)}`);
    connectSession('guest', normalizedSessionId);
    setPage('session');
  }

  function submitGuestPass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sessionId = guestJoinGate.sessionId;

    if (!isMaintenanceActive()) {
      setGuestJoinGate({ status: 'none', sessionId, error: null });
      setGuestPassInput('');
      if (sessionId) {
        joinGuestSession(sessionId);
      }
      return;
    }

    if (guestPassInput.trim() === GUEST_ACCESS_CODE) {
      writeSessionFlag(MAINTENANCE_UNLOCKED_KEY, true);
      setGuestJoinGate({ status: 'none', sessionId, error: null });
      setGuestPassInput('');
      if (sessionId) {
        joinGuestSession(sessionId);
      }
      return;
    }

    writeSessionFlag(MAINTENANCE_UNLOCKED_KEY, false);
    setGuestPassInput('');
    setGuestJoinGate({ status: 'pass', sessionId, error: 'パスワードが違います' });
    setConnectionStatus('disconnected');
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
    if (guestJoinBlocked) {
      setLocationStatus('メンテナンス認証を確認してください');
      return;
    }

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
  }, [guestJoinBlocked]);

  useEffect(() => {
    const joinSessionId = getJoinSessionId();
    if (guestJoinGate.status !== 'none') return;
    if (joinSessionId) {
      joinGuestSession(joinSessionId);
    }
  }, [guestJoinGate.status]);

  useEffect(() => {
    if (guestJoinGate.status !== 'pass') return;
    const sessionId = guestJoinGate.sessionId;
    const timer = window.setInterval(() => {
      if (isMaintenanceActive()) return;
      setGuestPassInput('');
      setGuestJoinGate({ status: 'none', sessionId, error: null });
      if (sessionId) {
        joinGuestSession(sessionId);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [guestJoinGate.sessionId, guestJoinGate.status]);

  useEffect(() => {
    return () => {
      clearReconnectTimer();
      clearSheetCloseTimer();
      cancelViewAnimation(false);
      if (pointerDisplayAnimationRef.current !== null) {
        window.cancelAnimationFrame(pointerDisplayAnimationRef.current);
      }
      socketRef.current?.close();
    };
  }, []);

  function setCurrentTime() {
    manualTimeBaseRef.current = null;
    setManualTimeEnabled(false);
    setTime(new Date());
  }

  function setObservationDateTime(value: string) {
    if (sessionRole !== 'none') return;
    const next = new Date(value);
    if (Number.isNaN(next.getTime())) return;
    setManualTimeEnabled(true);
    next.setSeconds(0, 0);
    manualTimeBaseRef.current = { observationMs: next.getTime(), realMs: Date.now() };
    setTime(next);
  }

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        const base = manualTimeBaseRef.current;
        if (manualTimeEnabled && base) {
          setTime(new Date(base.observationMs + (Date.now() - base.realMs)));
          return;
        }
        setTime(new Date());
      },
      manualTimeEnabled ? 1000 : 30000,
    );
    return () => window.clearInterval(timer);
  }, [manualTimeEnabled]);

  useEffect(() => {
    if (sessionRole === 'none') return;
    manualTimeBaseRef.current = null;
    setManualTimeEnabled(false);
    setTime(new Date());
  }, [sessionRole]);

  useEffect(() => {
    if (!sensorModeEnabled) {
      smoothedSensorViewRef.current = null;
      alphaFallbackOffsetRef.current = null;
      lastAzimuthLearningSampleRef.current = null;
      return;
    }
    cancelViewAnimation();
  }, [sensorModeEnabled]);

  useEffect(() => {
    if (!supportsDeviceOrientation()) {
      setSensorProbe((current) => ({ ...current, supported: false, permissionState: 'unsupported' }));
      return;
    }

    if (canRequestDeviceOrientationPermission() && sensorProbe.permissionState !== 'granted') return;

    const handleOrientation = (
      event: DeviceOrientationEvent,
      eventType: SensorProbeState['eventType'] = 'deviceorientation',
    ) => {
      const now = performance.now();
      if (eventType === 'deviceorientationabsolute') {
        lastAbsoluteSensorEventAtRef.current = now;
      } else if (now - lastAbsoluteSensorEventAtRef.current < 1000) {
        return;
      }
      if (now - lastSensorEventAtRef.current < 33) {
        return;
      }
      lastSensorEventAtRef.current = now;

      const {
        estimatedAzimuthDeg,
        estimatedAltitudeDeg: rawEstimatedAltitudeDeg,
        webkitHeading,
        alphaDirectAzimuthDeg,
        alphaAzimuthDeg,
        useAlphaFallback,
        azimuthSource,
      } = estimateSensorView(event, androidSensorMode);
      const correctedAltitudeDeg =
        rawEstimatedAltitudeDeg === null
          ? null
          : clamp((invertSensorAltitude ? -1 : 1) * rawEstimatedAltitudeDeg, -90, 90);
      const alpha = typeof event.alpha === 'number' ? event.alpha : null;
      const beta = typeof event.beta === 'number' ? event.beta : null;
      const gamma = typeof event.gamma === 'number' ? event.gamma : null;
      const profileStats = sensorProfileStatsRef.current;
      if (webkitHeading !== null) {
        profileStats.profile = 'ios';
        profileStats.samples += 1;
        profileStats.lastAzimuthDeg = estimatedAzimuthDeg;
      } else if (estimatedAzimuthDeg !== null) {
        const profileDelta = profileStats.lastAzimuthDeg === null
          ? 0
          : Math.abs(shortestAzimuthDelta(estimatedAzimuthDeg, profileStats.lastAzimuthDeg));
        profileStats.samples += 1;
        if (profileDelta > 45) profileStats.largeJumpCount += 1;
        if (profileDelta > 8) profileStats.jitterScore += Math.min(profileDelta, 90);
        profileStats.lastAzimuthDeg = estimatedAzimuthDeg;

        if (profileStats.samples < 18) {
          profileStats.profile = 'detecting';
        } else if (profileStats.largeJumpCount >= 6 || profileStats.jitterScore / profileStats.samples > 18) {
          profileStats.profile = 'manual_recommended';
        } else if (profileStats.largeJumpCount >= 2 || profileStats.jitterScore / profileStats.samples > 8) {
          profileStats.profile = 'android_unstable';
        } else {
          profileStats.profile = 'android_stable';
        }
      }
      const sensorProfile = profileStats.profile;
      if (!useAlphaFallback && webkitHeading !== null && alphaDirectAzimuthDeg !== null) {
        const last = lastAzimuthLearningSampleRef.current;
        if (last) {
          const webkitDelta = shortestAzimuthDelta(webkitHeading, last.webkitDeg);
          const alphaDirectDelta = shortestAzimuthDelta(alphaDirectAzimuthDeg, last.alphaDirectDeg);
          if (Math.abs(webkitDelta) >= 0.35 && Math.abs(alphaDirectDelta) >= 0.35) {
            const directError = Math.abs(webkitDelta - alphaDirectDelta);
            const inverseError = Math.abs(webkitDelta + alphaDirectDelta);
            alphaFallbackDirectionRef.current = directError <= inverseError ? 1 : -1;
          }
        }
        lastAzimuthLearningSampleRef.current = { webkitDeg: webkitHeading, alphaDirectDeg: alphaDirectAzimuthDeg };
      }

      setSensorProbe({
        supported: true,
        permissionState: 'granted',
        sensorProfile,
        eventType,
        alpha,
        beta,
        gamma,
        webkitHeading,
        azimuthSource,
        alphaDirection: alphaFallbackDirectionRef.current,
        absolute: typeof event.absolute === 'boolean' ? event.absolute : null,
        estimatedAzimuthDeg,
        rawEstimatedAltitudeDeg,
        estimatedAltitudeDeg: correctedAltitudeDeg,
        finalEstimatedAltitudeDeg: correctedAltitudeDeg,
      });

      if (!sensorModeEnabled || estimatedAzimuthDeg === null || correctedAltitudeDeg === null) {
        if (!useAlphaFallback) alphaFallbackOffsetRef.current = null;
        return;
      }

      setView((current) => {
        const previous = smoothedSensorViewRef.current ?? {
          azimuthDeg: current.centerAzimuthDeg,
          altitudeDeg: current.centerAltitudeDeg,
        };
        let nextEstimatedAzimuthDeg = estimatedAzimuthDeg;
        if (useAlphaFallback && alphaAzimuthDeg !== null) {
          const signedAlphaAzimuthDeg = normalizeAzimuth(
            alphaFallbackDirectionRef.current === 1 ? alphaAzimuthDeg : 360 - alphaAzimuthDeg,
          );
          if (alphaFallbackOffsetRef.current === null) {
            alphaFallbackOffsetRef.current = shortestAzimuthDelta(previous.azimuthDeg, signedAlphaAzimuthDeg);
          }
          nextEstimatedAzimuthDeg = normalizeAzimuth(signedAlphaAzimuthDeg + alphaFallbackOffsetRef.current);
        } else {
          alphaFallbackOffsetRef.current = null;
        }
        const horizonLikeAltitude = Math.abs(correctedAltitudeDeg) <= 10;
        const androidLikeAzimuth = webkitHeading === null && !useAlphaFallback;
        const jumpThreshold =
          sensorProfile === 'manual_recommended'
            ? 25
            : sensorProfile === 'android_unstable'
              ? 35
              : 55;
        if (
          (!androidLikeAzimuth || androidSensorMode === 'a') &&
          horizonLikeAltitude &&
          Math.abs(shortestAzimuthDelta(nextEstimatedAzimuthDeg, previous.azimuthDeg)) > jumpThreshold
        ) {
          nextEstimatedAzimuthDeg = previous.azimuthDeg;
        }
        const azimuthDeltaDeg = shortestAzimuthDelta(nextEstimatedAzimuthDeg, previous.azimuthDeg);
        // Keep heading responsive even at steep device angles. When iOS
        // webkitCompassHeading becomes sticky, the alpha fallback is offset to
        // the current view so source changes stay continuous.
        const steadyHorizonAzimuth = androidLikeAzimuth && horizonLikeAltitude;
        const azimuthSmoothing = androidLikeAzimuth && androidSensorMode === 'b'
          ? steadyHorizonAzimuth ? 0.16 : 0.22
          : androidLikeAzimuth && androidSensorMode === 'c'
            ? steadyHorizonAzimuth ? 0.24 : 0.32
            : sensorProfile === 'manual_recommended'
            ? steadyHorizonAzimuth ? 0.04 : 0.06
            : sensorProfile === 'android_unstable'
              ? steadyHorizonAzimuth ? 0.07 : 0.1
              : sensorProfile === 'android_stable'
                ? steadyHorizonAzimuth ? 0.1 : 0.18
                : steadyHorizonAzimuth ? 0.12 : 0.24;
        const maxAzimuthStep = androidLikeAzimuth && androidSensorMode === 'b'
          ? steadyHorizonAzimuth ? 10 : 16
          : androidLikeAzimuth && androidSensorMode === 'c'
            ? steadyHorizonAzimuth ? 18 : 26
            : sensorProfile === 'manual_recommended'
            ? steadyHorizonAzimuth ? 1.5 : 2.5
            : sensorProfile === 'android_unstable'
              ? steadyHorizonAzimuth ? 3 : 5
              : sensorProfile === 'android_stable'
                ? steadyHorizonAzimuth ? 5 : 10
                : steadyHorizonAzimuth ? 6 : 18;
        const altitudeSmoothing = androidLikeAzimuth && androidSensorMode === 'b'
          ? 0.22
          : androidLikeAzimuth && androidSensorMode === 'c'
            ? 0.32
            : sensorProfile === 'manual_recommended'
            ? 0.12
            : sensorProfile === 'android_unstable'
              ? 0.18
              : 0.24;
        const maxAltitudeStep = androidLikeAzimuth && androidSensorMode === 'b'
          ? 10
          : androidLikeAzimuth && androidSensorMode === 'c'
            ? 16
            : sensorProfile === 'manual_recommended'
            ? 4
            : sensorProfile === 'android_unstable'
              ? 7
              : 12;
        const azimuthStep = limitedSensorStep(
          azimuthDeltaDeg,
          azimuthSmoothing,
          maxAzimuthStep,
        );
        const altitudeStep = limitedSensorStep(correctedAltitudeDeg - previous.altitudeDeg, altitudeSmoothing, maxAltitudeStep);
        const nextAzimuthDeg = normalizeAzimuth(
          previous.azimuthDeg + azimuthStep,
        );
        const nextAltitudeDeg = clamp(previous.altitudeDeg + altitudeStep, -90, 90);
        smoothedSensorViewRef.current = { azimuthDeg: nextAzimuthDeg, altitudeDeg: nextAltitudeDeg };

        return {
          ...current,
          centerAzimuthDeg: nextAzimuthDeg,
          centerAltitudeDeg: nextAltitudeDeg,
        };
      });
    };

    const handleRelativeOrientation = (event: DeviceOrientationEvent) => handleOrientation(event, 'deviceorientation');
    const handleAbsoluteOrientation = (event: DeviceOrientationEvent) => handleOrientation(event, 'deviceorientationabsolute');
    window.addEventListener('deviceorientation', handleRelativeOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleRelativeOrientation, true);
      window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
    };
  }, [androidSensorMode, invertSensorAltitude, sensorModeEnabled, sensorProbe.permissionState]);

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
      Math.abs(shortestAzimuthDelta(view.centerAzimuthDeg, last.azimuthDeg)) >= POINTER_SEND_MIN_DELTA_DEG ||
      Math.abs(view.centerAltitudeDeg - last.altitudeDeg) >= POINTER_SEND_MIN_DELTA_DEG;
    const waitedEnough = !last || now - last.time >= POINTER_SEND_INTERVAL_MS;

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

  useEffect(() => {
    if (sessionRole !== 'guest' || shareMode !== 'pointer' || !sharedPointer) {
      targetSharedPointerRef.current = null;
      displayedSharedPointerRef.current = null;
      setDisplayedSharedPointer(null);
      if (pointerDisplayAnimationRef.current !== null) {
        window.cancelAnimationFrame(pointerDisplayAnimationRef.current);
        pointerDisplayAnimationRef.current = null;
      }
      return;
    }

    targetSharedPointerRef.current = sharedPointer;
    if (!displayedSharedPointerRef.current) {
      displayedSharedPointerRef.current = sharedPointer;
      setDisplayedSharedPointer(sharedPointer);
      return;
    }

    if (pointerDisplayAnimationRef.current !== null) return;

    const step = () => {
      const target = targetSharedPointerRef.current;
      const current = displayedSharedPointerRef.current;
      if (!target || !current) {
        pointerDisplayAnimationRef.current = null;
        return;
      }

      const azimuthDelta = shortestAzimuthDelta(target.azimuthDeg, current.azimuthDeg);
      const altitudeDelta = target.altitudeDeg - current.altitudeDeg;
      if (Math.abs(azimuthDelta) < 0.04 && Math.abs(altitudeDelta) < 0.04) {
        displayedSharedPointerRef.current = target;
        setDisplayedSharedPointer(target);
        pointerDisplayAnimationRef.current = null;
        return;
      }

      const nextPointer = {
        azimuthDeg: normalizeAzimuth(
          current.azimuthDeg +
            clamp(
              azimuthDelta * POINTER_DISPLAY_SMOOTHING,
              -POINTER_DISPLAY_MAX_STEP_DEG,
              POINTER_DISPLAY_MAX_STEP_DEG,
            ),
        ),
        altitudeDeg: clamp(
          current.altitudeDeg +
            clamp(
              altitudeDelta * POINTER_DISPLAY_SMOOTHING,
              -POINTER_DISPLAY_MAX_STEP_DEG,
              POINTER_DISPLAY_MAX_STEP_DEG,
            ),
          -90,
          90,
        ),
      };
      displayedSharedPointerRef.current = nextPointer;
      setDisplayedSharedPointer(nextPointer);
      pointerDisplayAnimationRef.current = window.requestAnimationFrame(step);
    };

    pointerDisplayAnimationRef.current = window.requestAnimationFrame(step);
  }, [sessionRole, shareMode, sharedPointer]);

  const positions = useMemo(() => {
    if (!location) return [];
    return calculateTargets(location, time);
  }, [location, time]);

  const stars = useMemo(() => {
    if (!location) return [];
    return calculateStars(location, time);
  }, [location, time]);

  const sunPosition = useMemo(() => {
    if (!location) return null;
    return calculateSunPosition(location, time);
  }, [location, time]);
  const skyBrightnessState = sunPosition ? getSkyBrightnessState(sunPosition.altitudeDeg) : null;
  const observationDateTimeValue = formatDateTimeLocal(time);

  const activeTargetId =
    shareMode === 'pointer'
      ? null
      : sessionRole === 'guest'
        ? (shareMode === 'target' ? sharedTargetId : selectedTargetId)
        : selectedTargetId;
  const selectedPosition = positions.find((position) => position.id === activeTargetId) ?? null;
  const guidance: GuidanceState | null = selectedPosition ? calculateGuidance(selectedPosition, view) : null;
  const selectedStatus = selectedPosition ? getAltitudeStatus(selectedPosition.altitudeDeg) : null;
  const guestPointerForDisplay = displayedSharedPointer ?? sharedPointer;
  const hostPointerPosition: TargetPosition | null =
    sessionRole === 'guest' && shareMode === 'pointer' && guestPointerForDisplay
      ? { id: 'host_pointer', azimuthDeg: guestPointerForDisplay.azimuthDeg, altitudeDeg: guestPointerForDisplay.altitudeDeg }
      : null;
  const hostPointerGuidance = hostPointerPosition ? calculateGuidance(hostPointerPosition, view) : null;

  if (guestJoinGate.status === 'rejected') {
    return <GuestRejectedScreen nightMode={nightMode} uiMode={uiMode} />;
  }

  if (guestJoinGate.status === 'pass') {
    return (
      <GuestPassGate
        nightMode={nightMode}
        uiMode={uiMode}
        value={guestPassInput}
        error={guestJoinGate.error}
        onChange={setGuestPassInput}
        onSubmit={submitGuestPass}
      />
    );
  }

  return (
    <main className={`app-shell ${nightMode ? 'night-mode' : ''}`} data-ui-mode={uiMode}>
      <section className="top-bar">
        <div>
          <h1>Sky</h1>
          <p>{locationStatus}</p>
        </div>
        <button type="button" onClick={setCurrentTime}>
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
          sunPosition={sunPosition}
          sunAltitudeDeg={sunPosition?.altitudeDeg ?? null}
          showAurora={showAurora}
          showAltitudeGuide={showAltitudeGuide}
          sensorModeEnabled={sensorModeEnabled}
          showHostPointerCenter={sessionRole === 'host' && shareMode === 'pointer'}
          debug={debug}
          onViewChange={setView}
          onInteractionStart={cancelViewAnimation}
          onManualGesture={() => {
            setSensorModeEnabled(false);
            setSensorNotice(null);
          }}
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
        <button
          type="button"
          className={`sensor-follow-button ${sensorModeEnabled ? 'active' : ''}`}
          onClick={toggleSensorModeFromSky}
          disabled={!sensorProbe.supported}
          aria-pressed={sensorModeEnabled}
        >
          {sensorModeEnabled ? '追従' : '手動'}
        </button>
        {sessionRole === 'none' && betaFeaturesEnabled && (
          <div className="time-controls" aria-label="観望時刻">
            <div className="time-controls-label">
              <span>{manualTimeEnabled ? '手動時刻' : '現在時刻'}</span>
              <strong>
                {time.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}{' '}
                {time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </strong>
            </div>
            <label className="time-native-picker">
              <span>日時</span>
              <input
                type="datetime-local"
                value={observationDateTimeValue}
                onChange={(event) => setObservationDateTime(event.currentTarget.value)}
              />
            </label>
            <div className="time-controls-actions">
              <button type="button" onClick={setCurrentTime}>
                Now
              </button>
            </div>
          </div>
        )}
        {sensorNotice && <div className="sensor-notice">{sensorNotice}</div>}
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
            uiMode={uiMode}
            sharedByHost={sessionRole === 'guest' && sharedTargetId === selectedPosition.id}
          />
        )}
        {!guidanceSuppressed && hostPointerGuidance && hostPointerPosition && (
          <GuidanceOverlay
            guidance={hostPointerGuidance}
            selectedPosition={hostPointerPosition}
            selectedStatus={null}
            nightMode={nightMode}
            uiMode={uiMode}
            sharedByHost
            labelOverride="Host方向"
            pointerMode
          />
        )}
        {sessionRole === 'guest' && shareMode !== 'pointer' && !sharedTargetId && (
          <div className="shared-empty-note">
            共有されている天体はありません
          </div>
        )}
        {sessionRole === 'guest' && shareMode === 'pointer' && !sharedPointer && (
          <div className="shared-empty-note">Host方向を待機中</div>
        )}
        {sessionRole === 'guest' && shareMode === 'pointer' && guestPointerForDisplay && viewMetrics && (
          <PointerOverlay pointer={guestPointerForDisplay} view={view} metrics={viewMetrics} />
        )}
      </section>

      {page !== 'sky' && (
        <div className={`sheet-layer ${sheetClosing ? 'closing' : ''}`} onClick={closeSheet}>
          <section className={`bottom-sheet ${page}-sheet`} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="sheet-close" onClick={closeSheet}>
              閉じる
            </button>
            {page === 'targets' && (
              <TargetsPage
                positions={positions}
                skyBrightnessState={skyBrightnessState}
                sunAltitudeDeg={sunPosition?.altitudeDeg ?? null}
                selectedTargetId={sessionRole === 'guest' ? activeTargetId : selectedTargetId}
                onClear={() => {
                  setSelectedTargetId(null);
                  setGuidanceSuppressed(false);
                  closeSheet();
                }}
                onSelect={(targetId, position) => {
                  setSelectedTargetId(targetId);
                  closeSheet();
                  if (sensorModeEnabled) {
                    setGuidanceSuppressed(false);
                    return;
                  }
                  setGuidanceSuppressed(true);
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
                betaFeaturesEnabled={betaFeaturesEnabled}
                sensorProbe={sensorProbe}
                androidSensorMode={androidSensorMode}
                invertSensorAltitude={invertSensorAltitude}
                onNightModeChange={setNightMode}
                onShowAuroraChange={setShowAurora}
                onShowAltitudeGuideChange={setShowAltitudeGuide}
                onBetaFeaturesEnabledChange={setBetaFeaturesEnabled}
                onAndroidSensorModeChange={setAndroidSensorMode}
                onInvertSensorAltitudeChange={setInvertSensorAltitude}
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

function GuestPassGate({
  nightMode,
  uiMode,
  value,
  error,
  onChange,
  onSubmit,
}: {
  nightMode: boolean;
  uiMode: UiMode;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className={`app-shell gate-shell ${nightMode ? 'night-mode' : ''}`} data-ui-mode={uiMode}>
      <section className="guest-gate-card">
        <h1>Sorava/SkyShare</h1>
        <p>メンテナンス中</p>
        <form className="guest-pass-form" onSubmit={onSubmit}>
          <input
            type="password"
            inputMode="numeric"
            value={value}
            onChange={(event) => onChange(event.target.value.trim())}
            placeholder="パスワード"
            autoComplete="off"
          />
          {error && <div className="guest-pass-error">{error}</div>}
          <button type="submit">入る</button>
        </form>
      </section>
    </main>
  );
}

function GuestRejectedScreen({ nightMode, uiMode }: { nightMode: boolean; uiMode: UiMode }) {
  return (
    <main className={`app-shell gate-shell ${nightMode ? 'night-mode' : ''}`} data-ui-mode={uiMode}>
      <section className="guest-gate-card rejected">
        <h1>参加できません</h1>
        <p>PASSが確認できませんでした。</p>
        <p>もう一度参加する場合は、ブラウザを閉じてQRコードを読み直してください。</p>
      </section>
    </main>
  );
}

function GuidanceOverlay({
  guidance,
  selectedPosition,
  selectedStatus,
  nightMode,
  uiMode,
  sharedByHost,
  labelOverride,
  pointerMode = false,
}: {
  guidance: GuidanceState;
  selectedPosition: TargetPosition;
  selectedStatus: ReturnType<typeof getAltitudeStatus> | null;
  nightMode: boolean;
  uiMode: UiMode;
  sharedByHost: boolean;
  labelOverride?: string;
  pointerMode?: boolean;
}) {
  const target = getTargetDefinition(selectedPosition.id);
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
    <div className={`guidance-panel ${guidance.acquired ? 'acquired' : ''} ${nightMode ? 'night' : ''} ${pointerMode ? 'pointer-guidance' : ''}`}>
      <div className="guidance-target">{labelOverride ?? target?.label ?? selectedPosition.id}</div>
      {sharedByHost && <div className="shared-badge">{pointerMode ? '方向案内中' : 'Host共有中'}</div>}
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
      {guidance.acquired && uiMode !== 'simple' && !pointerMode && <div className="target-acquired">捕捉しました</div>}
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
  const inView = rawX >= 0 && rawX <= metrics.width && rawY >= 0 && rawY <= metrics.height;

  if (!inView) return null;

  return (
    <div
      className="pointer-marker"
      style={{ transform: `translate(${rawX}px, ${rawY}px)` }}
      aria-label="方向案内"
    >
      <span />
    </div>
  );
}

function TargetsPage({
  positions,
  skyBrightnessState,
  sunAltitudeDeg,
  selectedTargetId,
  onClear,
  onSelect,
}: {
  positions: TargetPosition[];
  skyBrightnessState: SkyBrightnessState | null;
  sunAltitudeDeg: number | null;
  selectedTargetId: TargetId | null;
  onClear: () => void;
  onSelect: (targetId: TargetId, position: TargetPosition) => void;
}) {
  const [category, setCategory] = useState<TargetCategory>('recommended');
  const season = getCurrentSeason();
  const visiblePositions = positions
    .map((position) => ({ position, target: getTargetDefinition(position.id) }))
    .filter(({ target }) => Boolean(target))
    .filter(({ position, target }) => {
      if (!target) return false;
      if (target.kind === 'landmark' && target.id !== 'landmark_polaris') return false;
      if (category === 'recommended') {
        return isRecommendedForSkyBrightness(target, position, skyBrightnessState);
      }
      if (category === 'seasonal') {
        return Boolean(target.seasonalTags?.includes(season));
      }
      return target.category === category;
    })
    .sort((left, right) => {
      if (category === 'recommended') return right.position.altitudeDeg - left.position.altitudeDeg;
      const leftBelow = left.position.altitudeDeg < 0 ? 1 : 0;
      const rightBelow = right.position.altitudeDeg < 0 ? 1 : 0;
      return leftBelow - rightBelow;
    });

  return (
    <section className="page-panel targets-page">
      {skyBrightnessState && sunAltitudeDeg !== null && (
        <div className="sky-brightness-note">
          <strong>
            {getSkyBrightnessLabel(skyBrightnessState)} / 太陽 {Math.round(sunAltitudeDeg)}°
          </strong>
          <span>{getSkyBrightnessNote(skyBrightnessState)}</span>
        </div>
      )}
      <div className="target-category-strip" aria-label="対象カテゴリ">
        {TARGET_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={category === item.id ? 'active' : ''}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button type="button" className={`target-row clear ${selectedTargetId === null ? 'selected' : ''}`} onClick={onClear}>
        <strong>選択なし</strong>
      </button>
      {visiblePositions.length === 0 && (
        <div className="target-empty">今は表示できるおすすめが少ないです。別のカテゴリを見てください。</div>
      )}
      {visiblePositions.map(({ position, target }) => {
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
            <span className="target-meta">
              {getKindLabel(target)} / {formatDirection(position.azimuthDeg)} / 方{Math.round(position.azimuthDeg)}° / 高{' '}
              {Math.round(position.altitudeDeg)}°
            </span>
            <span className="target-status">{getCompactAltitudeStatusLabel(status)}</span>
          </button>
        );
      })}
    </section>
  );
}

function isRecommendedForSkyBrightness(
  target: TargetDefinition,
  position: TargetPosition,
  skyBrightnessState: SkyBrightnessState | null,
) {
  if (!target.recommended || position.altitudeDeg < 5) return false;
  if (!skyBrightnessState) return true;

  if (skyBrightnessState === 'day') {
    return target.kind === 'moon' || target.kind === 'planet';
  }

  if (
    skyBrightnessState === 'civil_twilight' ||
    skyBrightnessState === 'nautical_twilight'
  ) {
    return target.kind !== 'messier' && target.kind !== 'double_star';
  }

  return true;
}

function getCompactAltitudeStatusLabel(status: ReturnType<typeof getAltitudeStatus>) {
  if (status === 'below') return '地平下';
  if (status === 'difficult') return '困難';
  return '見やすい';
}

function getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
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
  const sharedTarget = getTargetDefinition(sharedTargetId);
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
            <h2>案内を始める</h2>
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
          <p>セッションに参加しますか？</p>
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
          <h2>セッション</h2>
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
  betaFeaturesEnabled,
  sensorProbe,
  androidSensorMode,
  invertSensorAltitude,
  onNightModeChange,
  onShowAuroraChange,
  onShowAltitudeGuideChange,
  onBetaFeaturesEnabledChange,
  onAndroidSensorModeChange,
  onInvertSensorAltitudeChange,
}: {
  nightMode: boolean;
  showAurora: boolean;
  showAltitudeGuide: boolean;
  betaFeaturesEnabled: boolean;
  sensorProbe: SensorProbeState;
  androidSensorMode: AndroidSensorMode;
  invertSensorAltitude: boolean;
  onNightModeChange: (enabled: boolean) => void;
  onShowAuroraChange: (enabled: boolean) => void;
  onShowAltitudeGuideChange: (enabled: boolean) => void;
  onBetaFeaturesEnabledChange: (enabled: boolean) => void;
  onAndroidSensorModeChange: (mode: AndroidSensorMode) => void;
  onInvertSensorAltitudeChange: (enabled: boolean) => void;
}) {
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const formatSensorValue = (value: number | null) => (value === null ? '--' : value.toFixed(1));
  const permissionLabel =
    sensorProbe.permissionState === 'unsupported'
      ? '非対応'
      : sensorProbe.permissionState === 'prompt'
        ? '未許可'
        : sensorProbe.permissionState === 'granted'
          ? '許可済み'
          : sensorProbe.permissionState === 'denied'
            ? '拒否'
            : 'エラー';

  function unlockAdminPanel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adminPasscode === SETTINGS_ADMIN_PASSCODE) {
      setAdminUnlocked(true);
      setAdminError(false);
      setAdminPasscode('');
      return;
    }
    setAdminError(true);
  }

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
          <strong>上下反転</strong>
          <small>追従時に上向き/下向きが逆ならON</small>
        </span>
        <input
          type="checkbox"
          checked={invertSensorAltitude}
          onChange={(event) => onInvertSensorAltitudeChange(event.target.checked)}
        />
      </label>

      <label className="setting-row">
        <span>
          <strong>Android方位方式</strong>
          <small>Android端末だけに適用します</small>
        </span>
        <select
          value={androidSensorMode}
          onChange={(event) => onAndroidSensorModeChange(event.target.value as AndroidSensorMode)}
        >
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>
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
          <strong>ベータ版を使用</strong>
        </span>
        <input
          type="checkbox"
          checked={betaFeaturesEnabled}
          onChange={(event) => onBetaFeaturesEnabledChange(event.target.checked)}
        />
      </label>

      {!adminUnlocked && (
        <form className="admin-panel" onSubmit={unlockAdminPanel}>
          <label className="session-input-row">
            <span>管理</span>
            <input
              type="password"
              value={adminPasscode}
              onChange={(event) => {
                setAdminPasscode(event.target.value);
                setAdminError(false);
              }}
              placeholder="pass"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="secondary-action">
            開く
          </button>
          {adminError && <div className="session-error">passが違います</div>}
        </form>
      )}

      {adminUnlocked && (
        <>
          <div className="admin-panel">
            <div className="settings-note">管理者表示</div>
            <button type="button" className="secondary-action" onClick={() => setAdminUnlocked(false)}>
              閉じる
            </button>
          </div>

          <label className="toggle-row">
            <span>
              <strong>Debug天頂</strong>
              <small>?debug=1 のときだけ表示します</small>
            </span>
            <input
              type="checkbox"
              checked={showAltitudeGuide}
              onChange={(event) => onShowAltitudeGuideChange(event.target.checked)}
            />
          </label>

          <div className="sensor-probe">
            <div>
              <span>DeviceOrientation</span>
              <strong>{sensorProbe.supported ? '対応' : '非対応'}</strong>
            </div>
            <div>
              <span>権限</span>
              <strong>{permissionLabel}</strong>
            </div>
            <div>
              <span>補正</span>
              <strong>{getSensorProfileLabel(sensorProbe.sensorProfile)}</strong>
            </div>
            <div>
              <span>Android方式</span>
              <strong>{androidSensorMode.toUpperCase()}</strong>
            </div>
            <div>
              <span>event</span>
              <strong>{sensorProbe.eventType ?? '--'}</strong>
            </div>
            <div>
              <span>alpha</span>
              <strong>{formatSensorValue(sensorProbe.alpha)}</strong>
            </div>
            <div>
              <span>beta</span>
              <strong>{formatSensorValue(sensorProbe.beta)}</strong>
            </div>
            <div>
              <span>gamma</span>
              <strong>{formatSensorValue(sensorProbe.gamma)}</strong>
            </div>
            <div>
              <span>webkit方位</span>
              <strong>{formatSensorValue(sensorProbe.webkitHeading)}°</strong>
            </div>
            <div>
              <span>方位元</span>
              <strong>{sensorProbe.azimuthSource ?? '--'}</strong>
            </div>
            <div>
              <span>alpha方向</span>
              <strong>{sensorProbe.alphaDirection === 1 ? '+' : '-'}</strong>
            </div>
            <div>
              <span>absolute</span>
              <strong>{sensorProbe.absolute === null ? '--' : sensorProbe.absolute ? 'true' : 'false'}</strong>
            </div>
            <div>
              <span>推定方位</span>
              <strong>{formatSensorValue(sensorProbe.estimatedAzimuthDeg)}°</strong>
            </div>
            <div>
              <span>raw高度</span>
              <strong>{formatSensorValue(sensorProbe.rawEstimatedAltitudeDeg)}°</strong>
            </div>
            <div>
              <span>final高度</span>
              <strong>{formatSensorValue(sensorProbe.finalEstimatedAltitudeDeg)}°</strong>
            </div>
            <div>
              <span>高度反転</span>
              <strong>{invertSensorAltitude ? 'ON' : 'OFF'}</strong>
            </div>
          </div>
        </>
      )}

    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
