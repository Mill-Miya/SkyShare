import type { StarPosition, TargetDefinition, TargetPosition, ViewState } from './types';

const INITIAL_HORIZONTAL_FOV_DEG = 56;
const MAX_HORIZONTAL_FOV_DEG = 76;
const MIN_HORIZONTAL_FOV_DEG = 28;

export function normalizeAzimuth(deg: number) {
  return ((deg % 360) + 360) % 360;
}

export function shortestAzimuthDelta(targetDeg: number, centerDeg: number) {
  return ((((targetDeg - centerDeg) % 360) + 540) % 360) - 180;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getZoomBounds(width: number) {
  return {
    min: width / MAX_HORIZONTAL_FOV_DEG,
    initial: width / INITIAL_HORIZONTAL_FOV_DEG,
    max: width / MIN_HORIZONTAL_FOV_DEG,
  };
}

const SKY_COLOR_STOPS = [
  { altitudeDeg: 5, top: '#5fa9ff', bottom: '#b9ddff' },
  { altitudeDeg: 0, top: '#315f9e', bottom: '#f0a66d' },
  { altitudeDeg: -6, top: '#122b59', bottom: '#55406f' },
  { altitudeDeg: -12, top: '#071632', bottom: '#111c3a' },
  { altitudeDeg: -18, top: '#020811', bottom: '#05080b' },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function lerpHexColor(fromHex: string, toHex: string, t: number) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const r = Math.round(lerp(from.r, to.r, t));
  const g = Math.round(lerp(from.g, to.g, t));
  const b = Math.round(lerp(from.b, to.b, t));
  return `rgb(${r}, ${g}, ${b})`;
}

function getSkyGradientColors(sunAltitudeDeg: number | null, nightMode: boolean) {
  if (nightMode) {
    const daylightHint = sunAltitudeDeg === null ? 0 : clamp((sunAltitudeDeg + 18) / 24, 0, 1);
    return {
      top: lerpHexColor('#070000', '#170403', daylightHint * 0.45),
      bottom: lerpHexColor('#030000', '#0a0101', daylightHint * 0.35),
    };
  }

  if (sunAltitudeDeg === null || !Number.isFinite(sunAltitudeDeg)) {
    return { top: '#051425', bottom: '#10110e' };
  }

  if (sunAltitudeDeg >= SKY_COLOR_STOPS[0].altitudeDeg) {
    return { top: SKY_COLOR_STOPS[0].top, bottom: SKY_COLOR_STOPS[0].bottom };
  }

  const lastStop = SKY_COLOR_STOPS[SKY_COLOR_STOPS.length - 1];
  if (sunAltitudeDeg <= lastStop.altitudeDeg) {
    return { top: lastStop.top, bottom: lastStop.bottom };
  }

  for (let index = 0; index < SKY_COLOR_STOPS.length - 1; index += 1) {
    const upper = SKY_COLOR_STOPS[index];
    const lower = SKY_COLOR_STOPS[index + 1];
    if (sunAltitudeDeg <= upper.altitudeDeg && sunAltitudeDeg >= lower.altitudeDeg) {
      const t = (upper.altitudeDeg - sunAltitudeDeg) / (upper.altitudeDeg - lower.altitudeDeg);
      return {
        top: lerpHexColor(upper.top, lower.top, t),
        bottom: lerpHexColor(upper.bottom, lower.bottom, t),
      };
    }
  }

  return { top: '#051425', bottom: '#10110e' };
}

export function drawSkyBrightnessBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sunAltitudeDeg: number | null,
  nightMode: boolean,
) {
  const colors = getSkyGradientColors(sunAltitudeDeg, nightMode);
  const skyGradient = context.createLinearGradient(0, 0, 0, height);
  skyGradient.addColorStop(0, colors.top);
  skyGradient.addColorStop(1, colors.bottom);
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, width, height);
}

export function drawStars(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ViewState,
  pxPerDeg: number,
  stars: StarPosition[],
  nightMode: boolean,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const alphaScale = nightMode ? 0.55 : 1;

  stars.forEach((star) => {
    const x = centerX + shortestAzimuthDelta(star.azimuthDeg, view.centerAzimuthDeg) * pxPerDeg;
    const y = centerY - (star.altitudeDeg - view.centerAltitudeDeg) * pxPerDeg;
    if (x < -8 || x > width + 8 || y < -8 || y > height + 8) return;

    const brightness = clamp((2.7 - star.magnitude) / 4.2, 0.12, 0.82);
    const radius = 0.45 + brightness * 1.15;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(${nightMode ? '255, 96, 78' : star.color}, ${(0.22 + brightness * 0.5) * alphaScale})`;
    context.shadowColor = `rgba(${nightMode ? '255, 68, 52' : star.color}, ${(0.2 + brightness * 0.28) * alphaScale})`;
    context.shadowBlur = 1.5 + brightness * 4.5;
    context.fill();
  });

  context.shadowBlur = 0;
}

export function drawAurora(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  view: ViewState,
  nightMode: boolean,
  showAurora: boolean,
) {
  if (!showAurora || horizonY < -height * 0.8) return;

  const alpha = nightMode ? 0.32 : 1;
  context.save();
  context.globalCompositeOperation = 'screen';
  context.filter = 'blur(34px)';

  const centerX = width / 2;
  const pxPerDeg = view.zoom;
  const auroraBaseAltDeg = 6;
  const auroraTopAltDeg = 34;
  const baseY = horizonY - auroraBaseAltDeg * pxPerDeg;
  const topY = horizonY - auroraTopAltDeg * pxPerDeg;
  if (topY > height + 120 || baseY < -height * 0.45) {
    context.restore();
    return;
  }

  const wash = context.createLinearGradient(0, topY, 0, baseY + 34);
  wash.addColorStop(0, 'rgba(56, 91, 181, 0)');
  wash.addColorStop(0.36, `rgba(36, 176, 132, ${0.018 * alpha})`);
  wash.addColorStop(0.58, `rgba(41, 211, 149, ${0.035 * alpha})`);
  wash.addColorStop(0.78, `rgba(37, 130, 103, ${0.018 * alpha})`);
  wash.addColorStop(1, 'rgba(12, 54, 48, 0)');
  context.fillStyle = wash;
  context.fillRect(-40, topY, width + 80, baseY - topY + 52);

  for (let band = 0; band < 3; band += 1) {
    const altitudeDeg = 10 + band * 7;
    const y = horizonY - altitudeDeg * pxPerDeg;
    const bandGradient = context.createLinearGradient(0, y - 34, 0, y + 44);
    bandGradient.addColorStop(0, 'rgba(83, 99, 220, 0)');
    bandGradient.addColorStop(0.46, `rgba(57, 214, 154, ${(0.018 - band * 0.003) * alpha})`);
    bandGradient.addColorStop(1, 'rgba(23, 98, 83, 0)');

    context.beginPath();
    context.moveTo(-40, y + Math.sin((view.centerAzimuthDeg + band * 20) * 0.04) * 14);
    for (let x = -20; x <= width + 40; x += 64) {
      const azimuthDeg = normalizeAzimuth(view.centerAzimuthDeg + (x - centerX) / pxPerDeg);
      const wave = Math.sin(azimuthDeg * 0.05 + band) * 18 + Math.sin(azimuthDeg * 0.12 + band * 2) * 8;
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

export function drawGroundAndMountains(
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

  const mountainBaseY = horizonY;
  const gradientTopY = Math.max(0, Math.min(mountainBaseY, height - 1));
  const groundGradient = context.createLinearGradient(0, gradientTopY, 0, height);
  groundGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  groundGradient.addColorStop(0.38, 'rgba(0, 0, 0, 0.96)');
  groundGradient.addColorStop(1, 'rgba(0, 0, 0, 0.78)');

  const centerX = width / 2;
  const stepPx = Math.max(6, width / 90);
  const ridgePoints: Array<{ x: number; y: number }> = [];

  for (let x = -stepPx; x <= width + stepPx; x += stepPx) {
    const azimuthDeg = normalizeAzimuth(view.centerAzimuthDeg + (x - centerX) / pxPerDeg);
    ridgePoints.push({
      x,
      y: mountainBaseY - mountainHeightAtAzimuth(azimuthDeg) * pxPerDeg,
    });
  }

  if (ridgePoints.length < 2) return;

  context.beginPath();
  context.moveTo(0, height);
  context.lineTo(0, mountainBaseY);
  for (let index = 0; index < ridgePoints.length; index += 1) {
    const current = ridgePoints[index];
    if (index === 0 || index === ridgePoints.length - 1) {
      context.lineTo(current.x, current.y);
      continue;
    }

    const previous = ridgePoints[index - 1];
    const next = ridgePoints[index + 1];
    const chamfer = 0.035;
    context.lineTo(current.x + (previous.x - current.x) * chamfer, current.y + (previous.y - current.y) * chamfer);
    context.lineTo(current.x + (next.x - current.x) * chamfer, current.y + (next.y - current.y) * chamfer);
  }

  context.lineTo(width, mountainBaseY);
  context.lineTo(width, height);
  context.closePath();
  context.fillStyle = groundGradient;
  context.fill();
}

const MOUNTAIN_PROFILE = [
  { az: 0, height: 2.9 },
  { az: 15, height: 4.0 },
  { az: 30, height: 2.6 },
  { az: 45, height: 5.0 },
  { az: 60, height: 3.4 },
  { az: 75, height: 4.4 },
  { az: 90, height: 2.4 },
  { az: 105, height: 6.0 },
  { az: 120, height: 3.7 },
  { az: 135, height: 3.1 },
  { az: 150, height: 4.9 },
  { az: 165, height: 2.7 },
  { az: 180, height: 4.3 },
  { az: 195, height: 3.6 },
  { az: 210, height: 5.4 },
  { az: 225, height: 3.0 },
  { az: 240, height: 4.1 },
  { az: 255, height: 2.6 },
  { az: 270, height: 4.7 },
  { az: 285, height: 3.3 },
  { az: 300, height: 3.9 },
  { az: 315, height: 5.7 },
  { az: 330, height: 2.9 },
  { az: 345, height: 4.6 },
];

function mountainHeightAtAzimuth(azimuthDeg: number) {
  const azimuth = normalizeAzimuth(azimuthDeg);
  const currentIndex = MOUNTAIN_PROFILE.findIndex((point, index) => {
    const next = MOUNTAIN_PROFILE[index + 1];
    return next ? azimuth >= point.az && azimuth < next.az : false;
  });
  const index = currentIndex >= 0 ? currentIndex : MOUNTAIN_PROFILE.length - 1;
  const current = MOUNTAIN_PROFILE[index];
  const next = MOUNTAIN_PROFILE[(index + 1) % MOUNTAIN_PROFILE.length];
  const span = next.az > current.az ? next.az - current.az : next.az + 360 - current.az;
  const offset = azimuth >= current.az ? azimuth - current.az : azimuth + 360 - current.az;
  const t = offset / span;
  return current.height + (next.height - current.height) * t;
}

export function drawTargetObject(
  context: CanvasRenderingContext2D,
  target: TargetDefinition | undefined,
  position: TargetPosition,
  x: number,
  y: number,
  selected: boolean,
  nightMode: boolean,
) {
  const radius = (target?.radius ?? 5) + (selected ? 1.3 : 0);
  const color = nightMode && target?.id !== 'moon' ? '#ff6a58' : target?.color ?? '#ffd166';

  context.save();
  context.shadowColor = nightMode ? 'rgba(255, 59, 45, 0.22)' : target?.glow ?? 'rgba(255, 255, 255, 0.45)';
  context.shadowBlur = selected ? 10 : target?.id === 'moon' ? 7 : 2.5;

  if (target?.id === 'saturn') {
    context.save();
    context.globalAlpha = selected ? 0.68 : 0.42;
    context.strokeStyle = nightMode ? 'rgba(255, 92, 72, 0.55)' : 'rgba(215, 198, 150, 0.5)';
    context.lineWidth = selected ? 1.25 : 1;
    context.beginPath();
    context.ellipse(x, y + radius * 0.04, radius * 1.9, radius * 0.55, -0.2, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  if (target?.id === 'moon') {
    drawMoonPhase(context, position, x, y, radius, nightMode);
  } else if (target?.kind === 'messier') {
    context.strokeStyle = color;
    context.lineWidth = selected ? 1.8 : 1.1;
    context.beginPath();
    context.arc(x, y, radius + 1.2, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(x, y, Math.max(1, radius * 0.42), 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  } else if (target?.kind === 'double_star') {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x - radius * 0.42, y, Math.max(1.1, radius * 0.52), 0, Math.PI * 2);
    context.arc(x + radius * 0.42, y, Math.max(1.1, radius * 0.52), 0, Math.PI * 2);
    context.fill();
  } else if (target?.kind === 'landmark') {
    context.strokeStyle = color;
    context.lineWidth = selected ? 1.8 : 1.1;
    context.beginPath();
    context.moveTo(x - radius, y);
    context.lineTo(x + radius, y);
    context.moveTo(x, y - radius);
    context.lineTo(x, y + radius);
    context.stroke();
  } else {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.shadowBlur = 0;

  if (selected) {
    context.strokeStyle = nightMode ? 'rgba(255, 78, 58, 0.94)' : 'rgba(255, 238, 170, 0.95)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, radius + 7, 0, Math.PI * 2);
    context.stroke();
  } else if (target?.id !== 'moon') {
    context.strokeStyle = position.altitudeDeg >= 0 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.16)';
    context.lineWidth = 0.65;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawMoonPhase(
  context: CanvasRenderingContext2D,
  position: TargetPosition,
  x: number,
  y: number,
  radius: number,
  nightMode: boolean,
) {
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
  dark.addColorStop(0, nightMode ? 'rgba(72, 30, 28, 0.92)' : 'rgba(104, 100, 88, 0.92)');
  dark.addColorStop(1, 'rgba(28, 24, 24, 0.98)');
  context.fillStyle = dark;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  const light = context.createRadialGradient(x - radius * 0.25, y - radius * 0.35, 1, x, y, radius * 1.35);
  light.addColorStop(0, nightMode ? 'rgba(255, 100, 82, 0.78)' : 'rgba(255, 255, 244, 0.95)');
  light.addColorStop(0.7, nightMode ? 'rgba(210, 64, 54, 0.72)' : 'rgba(223, 218, 195, 0.9)');
  light.addColorStop(1, nightMode ? 'rgba(98, 34, 32, 0.7)' : 'rgba(150, 143, 123, 0.78)');

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
