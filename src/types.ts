import type * as Astronomy from 'astronomy-engine';

export type TargetId = 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

export type Page = 'sky' | 'targets' | 'settings';

export type TargetPosition = {
  id: TargetId;
  azimuthDeg: number;
  altitudeDeg: number;
  phaseDeg?: number;
};

export type StarPosition = {
  name: string;
  azimuthDeg: number;
  altitudeDeg: number;
  magnitude: number;
  color: string;
};

export type ObserverLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  fallback?: boolean;
};

export type ViewState = {
  centerAzimuthDeg: number;
  centerAltitudeDeg: number;
  zoom: number;
};

export type ViewMetrics = {
  width: number;
  height: number;
  horizontalFovDeg: number;
  verticalFovDeg: number;
  zoom: number;
};

export type TargetDefinition = {
  id: TargetId;
  label: string;
  body: Astronomy.Body;
  color: string;
  glow: string;
  radius: number;
};

export type AltitudeStatus = 'visible' | 'difficult' | 'below';

export type GuidanceState = {
  deltaAzimuthDeg: number;
  deltaAltitudeDeg: number;
  arrow: '←' | '→' | '↑' | '↓' | '↖' | '↗' | '↙' | '↘' | '◎';
  acquired: boolean;
  horizontalText: string;
  verticalText: string;
};
