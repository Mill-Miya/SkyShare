import * as Astronomy from 'astronomy-engine';
import type { ObserverLocation, StarPosition, TargetDefinition, TargetPosition } from './types';
import { normalizeAzimuth } from './drawing';

export const TARGETS: TargetDefinition[] = [
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

export function calculateTargets(location: ObserverLocation, date: Date): TargetPosition[] {
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

export function calculateStars(location: ObserverLocation, date: Date): StarPosition[] {
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
