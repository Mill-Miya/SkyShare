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
  if (!showAurora || horizonY < -height * 0.5 || horizonY > height + 120) return;

  const alpha = nightMode ? 0.32 : 1;
  context.save();
  context.globalCompositeOperation = 'screen';
  context.filter = 'blur(34px)';

  const baseY = clamp(horizonY - height * 0.08, height * 0.18, height * 0.94);
  const wash = context.createLinearGradient(0, baseY - height * 0.55, 0, baseY + height * 0.18);
  wash.addColorStop(0, 'rgba(56, 91, 181, 0)');
  wash.addColorStop(0.36, `rgba(36, 176, 132, ${0.018 * alpha})`);
  wash.addColorStop(0.58, `rgba(41, 211, 149, ${0.035 * alpha})`);
  wash.addColorStop(0.78, `rgba(37, 130, 103, ${0.018 * alpha})`);
  wash.addColorStop(1, 'rgba(12, 54, 48, 0)');
  context.fillStyle = wash;
  context.fillRect(-40, baseY - height * 0.55, width + 80, height * 0.82);

  for (let band = 0; band < 3; band += 1) {
    const y = baseY - height * (0.08 + band * 0.12);
    const bandGradient = context.createLinearGradient(0, y - 34, 0, y + 44);
    bandGradient.addColorStop(0, 'rgba(83, 99, 220, 0)');
    bandGradient.addColorStop(0.46, `rgba(57, 214, 154, ${(0.018 - band * 0.003) * alpha})`);
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

function mountainHeightForIndex(index: number) {
  const wave = Math.sin(index * 1.43) * 0.44 + Math.sin(index * 0.61 + 0.8) * 0.34 + Math.sin(index * 2.37) * 0.18;
  return Math.max(0, wave) * 46;
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
