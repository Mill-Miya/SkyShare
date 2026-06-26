import type * as Astronomy from 'astronomy-engine';

export type TargetId = 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

export type Page = 'sky' | 'targets' | 'session' | 'settings';

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

export type SessionRole = 'none' | 'host' | 'guest';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type ShareMode = 'off' | 'target' | 'pointer';

export type SharedPointer = {
  azimuthDeg: number;
  altitudeDeg: number;
};

export type SessionState = {
  role: SessionRole;
  sessionId: string | null;
  sharedTargetId: TargetId | null;
  shareMode: ShareMode;
  sharedPointer: SharedPointer | null;
  participantCount: number;
  connectionStatus: ConnectionStatus;
  reconnecting: boolean;
};

export type ClientWsMessage =
  | { type: 'host:join'; sessionId: string }
  | { type: 'guest:join'; sessionId: string }
  | { type: 'target:update'; targetId: TargetId | null }
  | { type: 'pointer:update'; azimuth: number; altitude: number }
  | { type: 'session:end' };

export type ServerWsMessage =
  | {
      type: 'session:state';
      sessionId: string;
      targetId: TargetId | null;
      shareMode: ShareMode;
      pointer: SharedPointer | null;
      participantCount: number;
    }
  | { type: 'target:update'; targetId: TargetId | null }
  | { type: 'pointer:update'; azimuth: number; altitude: number }
  | { type: 'session:ended'; reason: 'host_ended' | 'host_disconnected' | 'server_shutdown' }
  | { type: 'error'; code: 'SESSION_NOT_FOUND' | 'HOST_REQUIRED' | 'INVALID_MESSAGE' };
