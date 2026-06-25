import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Astronomy from 'astronomy-engine';
import './styles.css';

type TargetId = 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

type TargetPosition = {
  id: TargetId;
  azimuthDeg: number;
  altitudeDeg: number;
  phaseDeg?: number;
};

type StarPosition = {
  name: string;
  azimuthDeg: number;
  altitudeDeg: number;
  magnitude: number;
  color: string;
};

type ObserverLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  fallback?: boolean;
};

type ViewState = {
  centerAzimuthDeg: number;
  centerAltitudeDeg: number;
  zoom: number;
};

type ViewMetrics = {
  width: number;
  height: number;
  horizontalFovDeg: number;
  verticalFovDeg: number;
  zoom: number;
};

const TARGETS: Array<{
  id: TargetId;
  label: string;
  body: Astronomy.Body;
  color: string;
  glow: string;
  radius: number;
}> = [
  { id: 'moon', label: 'Moon', body: Astronomy.Body.Moon, color: '#e7dfc8', glow: 'rgba(235, 230, 207, 0.24)', radius: 7.2 },
  { id: 'mercury', label: 'Mercury', body: Astronomy.Body.Mercury, color: '#b8b2aa', glow: 'rgba(184, 178, 170, 0.08)', radius: 2.2 },
  { id: 'venus', label: 'Venus', body: Astronomy.Body.Venus, color: '#fff1ca', glow: 'rgba(255, 241, 202, 0.24)', radius: 3.2 },
  { id: 'mars', label: 'Mars', body: Astronomy.Body.Mars, color: '#d27b5e', glow: 'rgba(210, 123, 94, 0.1)', radius: 2.5 },
  { id: 'jupiter', label: 'Jupiter', body: Astronomy.Body.Jupiter, color: '#dcc7a5', glow: 'rgba(220, 199, 165, 0.13)', radius: 3.0 },
  { id: 'saturn', label: 'Saturn', body: Astronomy.Body.Saturn, color: '#d7c696', glow: 'rgba(215, 198, 150, 0.1)', radius: 2.7 },
];

const BRIGHT_STARS: Array<{ name: string; raHours: number; decDeg: number; magnitude: number }> = [
  { name: 'Sirius', raHours: 6.752, decDeg: -16.716, magnitude: -1.46 },
  { name: 'Canopus', raHours: 6.399, decDeg: -52.696, magnitude: -0.74 },
  { name: 'Arcturus', raHours: 14.261, decDeg: 19.182, magnitude: -0.05 },
  { name: 'Vega', raHours: 18.615, decDeg: 38.783, magnitude: 0.03 },
  { name: 'Capella', raHours: 5.278, decDeg: 45.998, magnitude: 0.08 },
  { name: 'Rigel', raHours: 5.242, decDeg: -8.202, magnitude: 0.13 },
  { name: 'Procyon', raHours: 7.655, decDeg: 5.225, magnitude: 0.34 },
  { name: 'Betelgeuse', raHours: 5.919, decDeg: 7.407, magnitude: 0.42 },
  { name: 'Achernar', raHours: 1.628, decDeg: -57.237, magnitude: 0.46 },
  { name: 'Altair', raHours: 19.846, decDeg: 8.868, magnitude: 0.77 },
  { name: 'Aldebaran', raHours: 4.598, decDeg: 16.509, magnitude: 0.86 },
  { name: 'Antares', raHours: 16.49, decDeg: -26.432, magnitude: 0.96 },
  { name: 'Spica', raHours: 13.42, decDeg: -11.161, magnitude: 0.98 },
  { name: 'Pollux', raHours: 7.755, decDeg: 28.026, magnitude: 1.14 },
  { name: 'Fomalhaut', raHours: 22.961, decDeg: -29.622, magnitude: 1.16 },
  { name: 'Deneb', raHours: 20.691, decDeg: 45.28, magnitude: 1.25 },
  { name: 'Regulus', raHours: 10.139, decDeg: 11.967, magnitude: 1.35 },
  { name: 'Adhara', raHours: 6.977, decDeg: -28.972, magnitude: 1.5 },
  { name: 'Castor', raHours: 7.576, decDeg: 31.888, magnitude: 1.58 },
  { name: 'Shaula', raHours: 17.56, decDeg: -37.104, magnitude: 1.63 },
  { name: 'Bellatrix', raHours: 5.419, decDeg: 6.35, magnitude: 1.64 },
  { name: 'Elnath', raHours: 5.438, decDeg: 28.607, magnitude: 1.65 },
  { name: 'Alnilam', raHours: 5.604, decDeg: -1.202, magnitude: 1.69 },
  { name: 'Alnitak', raHours: 5.679, decDeg: -1.943, magnitude: 1.74 },
  { name: 'Alioth', raHours: 12.901, decDeg: 55.959, magnitude: 1.76 },
  { name: 'Dubhe', raHours: 11.063, decDeg: 61.751, magnitude: 1.79 },
  { name: 'Mirfak', raHours: 3.405, decDeg: 49.861, magnitude: 1.79 },
  { name: 'Wezen', raHours: 7.14, decDeg: -26.393, magnitude: 1.83 },
  { name: 'Kaus Australis', raHours: 18.403, decDeg: -34.384, magnitude: 1.85 },
  { name: 'Alkaid', raHours: 13.792, decDeg: 49.313, magnitude: 1.86 },
  { name: 'Menkent', raHours: 14.112, decDeg: -36.37, magnitude: 2.06 },
  { name: 'Alhena', raHours: 6.628, decDeg: 16.399, magnitude: 1.93 },
  { name: 'Mirzam', raHours: 6.378, decDeg: -17.956, magnitude: 1.98 },
  { name: 'Polaris', raHours: 2.53, decDeg: 89.264, magnitude: 1.98 },
  { name: 'Alphard', raHours: 9.46, decDeg: -8.658, magnitude: 2.0 },
  { name: 'Hamal', raHours: 2.119, decDeg: 23.462, magnitude: 2.0 },
  { name: 'Denebola', raHours: 11.817, decDeg: 14.572, magnitude: 2.14 },
  { name: 'Algol', raHours: 3.137, decDeg: 40.956, magnitude: 2.12 },
  { name: 'Almach', raHours: 2.065, decDeg: 42.329, magnitude: 2.1 },
  { name: 'Markab', raHours: 23.08, decDeg: 15.205, magnitude: 2.49 },
  { name: 'Scheat', raHours: 23.063, decDeg: 28.082, magnitude: 2.42 },
  { name: 'Alpheratz', raHours: 0.139, decDeg: 29.09, magnitude: 2.06 },
  { name: 'Enif', raHours: 21.737, decDeg: 9.875, magnitude: 2.4 },
  { name: 'Rasalhague', raHours: 17.582, decDeg: 12.56, magnitude: 2.07 },
  { name: 'Caph', raHours: 0.153, decDeg: 59.15, magnitude: 2.28 },
  { name: 'Schedar', raHours: 0.675, decDeg: 56.537, magnitude: 2.24 },
  { name: 'Kochab', raHours: 14.845, decDeg: 74.155, magnitude: 2.08 },
  { name: 'Mizar', raHours: 13.399, decDeg: 54.925, magnitude: 2.23 },
  { name: 'Merak', raHours: 11.031, decDeg: 56.382, magnitude: 2.34 },
];

const FALLBACK_LOCATION: ObserverLocation = {
  latitude: 35.6812,
  longitude: 139.7671,
  fallback: true,
};

const INITIAL_HORIZONTAL_FOV_DEG = 56;
const MAX_HORIZONTAL_FOV_DEG = 76;
const MIN_HORIZONTAL_FOV_DEG = 28;

function normalizeAzimuth(deg: number) {
  return ((deg % 360) + 360) % 360;
}

function shortestAzimuthDelta(targetDeg: number, centerDeg: number) {
  return ((((targetDeg - centerDeg) % 360) + 540) % 360) - 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getZoomBounds(width: number) {
  return {
    min: width / MAX_HORIZONTAL_FOV_DEG,
    initial: width / INITIAL_HORIZONTAL_FOV_DEG,
    max: width / MIN_HORIZONTAL_FOV_DEG,
  };
}

function calculateTargets(location: ObserverLocation, date: Date): TargetPosition[] {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  return TARGETS.map((target) => {
    const equator = Astronomy.Equator(target.body, date, observer, true, true);
    const horizon = Astronomy.Horizon(date, observer, equator.ra, equator.dec, 'normal');

    return {
      id: target.id,
      azimuthDeg: normalizeAzimuth(horizon.azimuth),
      altitudeDeg: horizon.altitude,
      phaseDeg: target.id === 'moon' ? Astronomy.MoonPhase(date) : undefined,
    };
  });
}

function calculateStars(location: ObserverLocation, date: Date): StarPosition[] {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  return BRIGHT_STARS.map((star) => {
    const horizon = Astronomy.Horizon(date, observer, star.raHours, star.decDeg, 'normal');

    return {
      name: star.name,
      azimuthDeg: normalizeAzimuth(horizon.azimuth),
      altitudeDeg: horizon.altitude,
      magnitude: star.magnitude,
      color: getStarColor(star.name),
    };
  });
}

function formatDirection(azimuthDeg: number) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(normalizeAzimuth(azimuthDeg) / 45) % 8];
}

function getStarColor(name: string) {
  const redOrange = new Set(['Betelgeuse', 'Aldebaran', 'Antares', 'Arcturus', 'Hamal']);
  const yellowWhite = new Set(['Capella', 'Pollux', 'Fomalhaut', 'Polaris', 'Alpheratz']);
  const blueWhite = new Set([
    'Sirius',
    'Canopus',
    'Vega',
    'Rigel',
    'Procyon',
    'Spica',
    'Deneb',
    'Adhara',
    'Shaula',
    'Bellatrix',
    'Elnath',
    'Alnilam',
    'Alnitak',
    'Mirfak',
    'Wezen',
  ]);

  if (redOrange.has(name)) return '255, 184, 108';
  if (yellowWhite.has(name)) return '255, 238, 184';
  if (blueWhite.has(name)) return '205, 225, 255';
  return '224, 232, 255';
}

function drawStars(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ViewState,
  pxPerDeg: number,
  stars: StarPosition[],
) {
  const centerX = width / 2;
  const centerY = height / 2;

  stars.forEach((star) => {
    const x = centerX + shortestAzimuthDelta(star.azimuthDeg, view.centerAzimuthDeg) * pxPerDeg;
    const y = centerY - (star.altitudeDeg - view.centerAltitudeDeg) * pxPerDeg;
    if (x < -8 || x > width + 8 || y < -8 || y > height + 8) return;

    const brightness = clamp((2.7 - star.magnitude) / 4.2, 0.12, 0.82);
    const radius = 0.45 + brightness * 1.15;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(${star.color}, ${0.22 + brightness * 0.5})`;
    context.shadowColor = `rgba(${star.color}, ${0.2 + brightness * 0.28})`;
    context.shadowBlur = 1.5 + brightness * 4.5;
    context.fill();
  });

  context.shadowBlur = 0;
}

function auroraIntensityAtAzimuth(azimuthDeg: number) {
  const northBias = Math.max(0, Math.cos((shortestAzimuthDelta(azimuthDeg, 0) * Math.PI) / 180));
  const ripple = Math.max(0, Math.sin((azimuthDeg * Math.PI) / 28) * 0.55 + Math.sin((azimuthDeg * Math.PI) / 11) * 0.35);
  return northBias * (0.35 + ripple);
}

function drawAurora(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  view: ViewState,
  pxPerDeg: number,
) {
  if (horizonY < -height * 0.5 || horizonY > height + 120) return;

  context.save();
  context.globalCompositeOperation = 'screen';
  context.filter = 'blur(34px)';

  const baseY = clamp(horizonY - height * 0.08, height * 0.18, height * 0.94);
  const wash = context.createLinearGradient(0, baseY - height * 0.55, 0, baseY + height * 0.18);
  wash.addColorStop(0, 'rgba(56, 91, 181, 0)');
  wash.addColorStop(0.36, 'rgba(36, 176, 132, 0.018)');
  wash.addColorStop(0.58, 'rgba(41, 211, 149, 0.035)');
  wash.addColorStop(0.78, 'rgba(37, 130, 103, 0.018)');
  wash.addColorStop(1, 'rgba(12, 54, 48, 0)');
  context.fillStyle = wash;
  context.fillRect(-40, baseY - height * 0.55, width + 80, height * 0.82);

  for (let band = 0; band < 3; band += 1) {
    const y = baseY - height * (0.08 + band * 0.12);
    const bandGradient = context.createLinearGradient(0, y - 34, 0, y + 44);
    bandGradient.addColorStop(0, 'rgba(83, 99, 220, 0)');
    bandGradient.addColorStop(0.46, `rgba(57, 214, 154, ${0.018 - band * 0.003})`);
    bandGradient.addColorStop(1, 'rgba(23, 98, 83, 0)');

    context.beginPath();
    context.moveTo(-40, y + Math.sin((view.centerAzimuthDeg + band * 20) * 0.04) * 14);
    for (let x = -20; x <= width + 40; x += 64) {
      const wave = Math.sin(x * 0.012 + view.centerAzimuthDeg * 0.035 + band) * 18;
      context.lineTo(x, y + wave);
    }
    context.lineTo(width + 40, y + 52);
    context.lineTo(-40, y + 52);
    context.closePath();
    context.fillStyle = bandGradient;
    context.fill();
  }

  context.restore();
}

function mountainHeightForIndex(index: number) {
  const wave = Math.sin(index * 1.43) * 0.44 + Math.sin(index * 0.61 + 0.8) * 0.34 + Math.sin(index * 2.37) * 0.18;
  return Math.max(0, wave) * 46;
}

function drawGroundAndMountains(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  view: ViewState,
  pxPerDeg: number,
) {
  if (horizonY <= 0) {
    context.fillStyle = 'rgba(0, 0, 0, 0.68)';
    context.fillRect(0, 0, width, height);
    return;
  }

  if (horizonY > height + 120) return;

  const visibleHorizonY = Math.min(horizonY, height);
  const groundGradient = context.createLinearGradient(0, visibleHorizonY, 0, height);
  groundGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  groundGradient.addColorStop(0.38, 'rgba(0, 0, 0, 0.96)');
  groundGradient.addColorStop(1, 'rgba(0, 0, 0, 0.78)');

  const centerX = width / 2;
  const sectorWidthDeg = 14;
  const leftAzimuth = view.centerAzimuthDeg - centerX / pxPerDeg - sectorWidthDeg;
  const rightAzimuth = view.centerAzimuthDeg + centerX / pxPerDeg + sectorWidthDeg;
  const startIndex = Math.floor(leftAzimuth / sectorWidthDeg);
  const endIndex = Math.ceil(rightAzimuth / sectorWidthDeg);
  const ridgePoints: Array<{ x: number; y: number }> = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const azimuthDeg = index * sectorWidthDeg;
    ridgePoints.push({
      x: centerX + shortestAzimuthDelta(normalizeAzimuth(azimuthDeg), view.centerAzimuthDeg) * pxPerDeg,
      y: horizonY - mountainHeightForIndex(index),
    });
  }

  if (ridgePoints.length < 2) return;

  context.beginPath();
  context.moveTo(0, height);
  context.lineTo(0, horizonY);
  for (let index = 0; index < ridgePoints.length; index += 1) {
    const current = ridgePoints[index];
    if (index === 0 || index === ridgePoints.length - 1) {
      context.lineTo(current.x, current.y);
      continue;
    }

    const previous = ridgePoints[index - 1];
    const next = ridgePoints[index + 1];
    const chamfer = 0.1;
    context.lineTo(current.x + (previous.x - current.x) * chamfer, current.y + (previous.y - current.y) * chamfer);
    context.lineTo(current.x + (next.x - current.x) * chamfer, current.y + (next.y - current.y) * chamfer);
  }

  context.lineTo(width, horizonY);
  context.lineTo(width, height);
  context.closePath();
  context.fillStyle = groundGradient;
  context.fill();
}

function drawMoonPhase(context: CanvasRenderingContext2D, position: TargetPosition, x: number, y: number, radius: number) {
  const phaseDeg = position.phaseDeg ?? 180;
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const illumination = (1 - Math.cos(phaseRad)) / 2;
  const waxing = phaseDeg < 180;
  const lightOffset = (illumination - 0.5) * radius * 1.05;

  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();

  const dark = context.createRadialGradient(x - radius * 0.2, y - radius * 0.25, 1, x, y, radius * 1.3);
  dark.addColorStop(0, 'rgba(104, 100, 88, 0.92)');
  dark.addColorStop(1, 'rgba(38, 38, 36, 0.98)');
  context.fillStyle = dark;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  const light = context.createRadialGradient(x - radius * 0.25, y - radius * 0.35, 1, x, y, radius * 1.35);
  light.addColorStop(0, 'rgba(255, 255, 244, 0.95)');
  light.addColorStop(0.7, 'rgba(223, 218, 195, 0.9)');
  light.addColorStop(1, 'rgba(150, 143, 123, 0.78)');

  context.beginPath();
  context.ellipse(
    x + (waxing ? lightOffset : -lightOffset),
    y,
    Math.max(radius * 0.16, radius * (0.28 + illumination * 0.72)),
    radius * 1.08,
    0,
    0,
    Math.PI * 2,
  );
  context.fillStyle = light;
  context.fill();
  context.restore();
}

function drawTargetObject(
  context: CanvasRenderingContext2D,
  target: (typeof TARGETS)[number] | undefined,
  position: TargetPosition,
  x: number,
  y: number,
) {
  const radius = target?.radius ?? 5;
  const color = target?.color ?? '#ffd166';

  context.save();
  context.shadowColor = target?.glow ?? 'rgba(255, 255, 255, 0.45)';
  context.shadowBlur = target?.id === 'moon' ? 7 : 2.5;

  if (target?.id === 'saturn') {
    context.save();
    context.globalAlpha = 0.42;
    context.strokeStyle = 'rgba(215, 198, 150, 0.5)';
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(x, y + radius * 0.04, radius * 1.9, radius * 0.55, -0.2, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  if (target?.id === 'moon') {
    drawMoonPhase(context, position, x, y, radius);
  } else {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.shadowBlur = 0;

  if (target?.id === 'moon') {
    context.fillStyle = 'rgba(235, 229, 202, 0.13)';
    for (let crater = 0; crater < 4; crater += 1) {
      const angle = crater * 1.65 + 0.4;
      context.beginPath();
      context.arc(x + Math.cos(angle) * radius * 0.42, y + Math.sin(angle) * radius * 0.34, radius * 0.1, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (target?.id !== 'moon') {
    context.strokeStyle = position.altitudeDeg >= 0 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.16)';
    context.lineWidth = 0.65;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function SkyCanvas({
  positions,
  stars,
  view,
  onViewChange,
  onMetricsChange,
}: {
  positions: TargetPosition[];
  stars: StarPosition[];
  view: ViewState;
  onViewChange: React.Dispatch<React.SetStateAction<ViewState>>;
  onMetricsChange: (metrics: ViewMetrics) => void;
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

    onMetricsChange({
      width,
      height,
      horizontalFovDeg,
      verticalFovDeg,
      zoom: pxPerDeg,
    });

    context.clearRect(0, 0, width, height);

    const skyGradient = context.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#051425');
    skyGradient.addColorStop(0.55, '#071a22');
    skyGradient.addColorStop(1, '#10110e');
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, width, height);

    const horizonY = centerY + (view.centerAltitudeDeg - 0) * pxPerDeg;

    drawStars(context, width, height, view, pxPerDeg, stars);
    drawAurora(context, width, height, horizonY, view, pxPerDeg);

    drawGroundAndMountains(context, width, height, horizonY, view, pxPerDeg);

    context.fillStyle = 'rgba(222, 242, 230, 0.86)';
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

    context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(centerX - 9, centerY);
    context.lineTo(centerX + 9, centerY);
    context.moveTo(centerX, centerY - 9);
    context.lineTo(centerX, centerY + 9);
    context.stroke();

    context.fillStyle = 'rgba(255, 248, 220, 0.7)';
    context.font = '500 11px system-ui, sans-serif';
    context.textAlign = 'left';
    context.fillText(`FOV ${Math.round(horizontalFovDeg)}° x ${Math.round(verticalFovDeg)}°`, 12, 18);
    context.fillText(`zoom ${pxPerDeg.toFixed(1)} px/°`, 12, 34);

    positions.forEach((position) => {
      const x = centerX + shortestAzimuthDelta(position.azimuthDeg, view.centerAzimuthDeg) * pxPerDeg;
      const y = centerY - (position.altitudeDeg - view.centerAltitudeDeg) * pxPerDeg;
      if (x < -80 || x > width + 80 || y < -80 || y > height + 80) return;

      const target = TARGETS.find((item) => item.id === position.id);
      const radius = target?.radius ?? 5;

      drawTargetObject(context, target, position, x, y);

      context.fillStyle = position.altitudeDeg >= 0 ? '#f7f2dc' : 'rgba(247, 242, 220, 0.55)';
      context.font = '600 12px system-ui, sans-serif';
      context.fillText(target?.label ?? position.id, x, y - radius - 12);
    });
  }, [onMetricsChange, positions, stars, view]);

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
  const [view, setView] = useState<ViewState>({
    centerAzimuthDeg: 180,
    centerAltitudeDeg: 25,
    zoom: 7,
  });
  const [viewMetrics, setViewMetrics] = useState<ViewMetrics | null>(null);

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
    const timer = window.setInterval(() => setTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const positions = useMemo(() => {
    if (!location) return [];
    return calculateTargets(location, time);
  }, [location, time]);

  const stars = useMemo(() => {
    if (!location) return [];
    return calculateStars(location, time);
  }, [location, time]);

  return (
    <main className="app-shell">
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
          onViewChange={setView}
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
        <div className="view-readout">
          <span>{formatDirection(view.centerAzimuthDeg)}</span>
          <span>Az {Math.round(view.centerAzimuthDeg)}°</span>
          <span>Alt {Math.round(view.centerAltitudeDeg)}°</span>
          <span>Zoom {viewMetrics?.zoom.toFixed(1) ?? view.zoom.toFixed(1)}</span>
          <span>
            FOV {viewMetrics ? `${Math.round(viewMetrics.horizontalFovDeg)}°` : '--'}
          </span>
        </div>
      </section>

      <section className="object-list" aria-label="天体位置">
        {positions.map((position) => {
          const target = TARGETS.find((item) => item.id === position.id);
          return (
            <button
              type="button"
              key={position.id}
              onClick={() =>
                setView((current) => ({
                  ...current,
                  centerAzimuthDeg: position.azimuthDeg,
                  centerAltitudeDeg: clamp(position.altitudeDeg, -90, 80),
                }))
              }
            >
              <strong>{target?.label ?? position.id}</strong>
              <span>{formatDirection(position.azimuthDeg)}</span>
              <span>Az {Math.round(position.azimuthDeg)}°</span>
              <span>Alt {Math.round(position.altitudeDeg)}°</span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
