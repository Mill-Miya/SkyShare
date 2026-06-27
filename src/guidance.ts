import type { AltitudeStatus, GuidanceState, TargetPosition, ViewState } from './types';
import { shortestAzimuthDelta } from './drawing';

export function calculateGuidance(target: TargetPosition, view: ViewState): GuidanceState {
  const deltaAzimuthDeg = shortestAzimuthDelta(target.azimuthDeg, view.centerAzimuthDeg);
  const deltaAltitudeDeg = target.altitudeDeg - view.centerAltitudeDeg;
  const acquired = Math.abs(deltaAzimuthDeg) <= 3 && Math.abs(deltaAltitudeDeg) <= 3;

  return {
    deltaAzimuthDeg,
    deltaAltitudeDeg,
    acquired,
    arrow: acquired ? '◎' : getGuidanceArrow(deltaAzimuthDeg, deltaAltitudeDeg),
    horizontalText: Math.abs(deltaAzimuthDeg) <= 3 ? '左右 OK' : `${deltaAzimuthDeg > 0 ? '右へ' : '左へ'} ${Math.round(Math.abs(deltaAzimuthDeg))}°`,
    verticalText: Math.abs(deltaAltitudeDeg) <= 3 ? '上下 OK' : `${deltaAltitudeDeg > 0 ? '上へ' : '下へ'} ${Math.round(Math.abs(deltaAltitudeDeg))}°`,
  };
}

export function getAltitudeStatus(altitudeDeg: number): AltitudeStatus {
  if (altitudeDeg < 0) return 'below';
  if (altitudeDeg < 10) return 'difficult';
  return 'visible';
}

export function getAltitudeStatusLabel(status: AltitudeStatus) {
  if (status === 'below') return '地平線下';
  if (status === 'difficult') return '観測困難';
  return '見やすい';
}

export function formatDirection(azimuthDeg: number) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8];
}

function getGuidanceArrow(deltaAzimuthDeg: number, deltaAltitudeDeg: number): GuidanceState['arrow'] {
  const horizontal = Math.abs(deltaAzimuthDeg) <= 3 ? '' : deltaAzimuthDeg > 0 ? 'right' : 'left';
  const vertical = Math.abs(deltaAltitudeDeg) <= 3 ? '' : deltaAltitudeDeg > 0 ? 'up' : 'down';

  if (horizontal === 'right' && vertical === 'up') return '↗';
  if (horizontal === 'left' && vertical === 'up') return '↖';
  if (horizontal === 'right' && vertical === 'down') return '↘';
  if (horizontal === 'left' && vertical === 'down') return '↙';
  if (horizontal === 'right') return '→';
  if (horizontal === 'left') return '←';
  if (vertical === 'up') return '↑';
  return '↓';
}
