import type * as Astronomy from 'astronomy-engine';

export type SolarSystemTargetId = 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
export type TargetId = SolarSystemTargetId | string;

export type Page = 'sky' | 'targets' | 'session' | 'settings';

export type TargetPosition = {
  id: TargetId;
  azimuthDeg: number;
  altitudeDeg: number;
  phaseDeg?: number;
  kind?: TargetKind;
};

export type StarPosition = {
  name: string;
  azimuthDeg: number;
  altitudeDeg: number;
  magnitude: number;
  color: string;
};

export type SunPosition = {
  azimuthDeg: number;
  altitudeDeg: number;
};

export type SkyBrightnessState =
  | 'day'
  | 'civil_twilight'
  | 'nautical_twilight'
  | 'astronomical_twilight'
  | 'night';

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
  body?: Astronomy.Body;
  color: string;
  glow: string;
  radius: number;
  kind: TargetKind;
  category: TargetCategory;
  nameEn?: string;
  raHours?: number;
  decDeg?: number;
  magnitude?: number;
  descriptionJa?: string;
  recommended?: boolean;
  seasonalTags?: Array<'spring' | 'summer' | 'autumn' | 'winter'>;
};

export type TargetKind = 'moon' | 'planet' | 'star' | 'messier' | 'double_star' | 'landmark';

export type TargetCategory = 'recommended' | 'solar' | 'stars' | 'messier' | 'double' | 'landmark' | 'seasonal';

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
  | { type: 'target:update'; targetId: TargetId | null; shareMode?: 'off' | 'target' }
  | { type: 'pointer:update'; azimuth: number; altitude: number }
  | { type: 'session:end' };

export type ServerWsMessage =
  | {
      type: 'session:state';
      sessionId: string;
      targetId: TargetId | null;
      shareMode?: ShareMode;
      pointer: SharedPointer | null;
      participantCount: number;
    }
  | { type: 'target:update'; targetId: TargetId | null; shareMode?: 'off' | 'target' }
  | { type: 'pointer:update'; azimuth: number; altitude: number }
  | { type: 'session:ended'; reason: 'host_ended' | 'host_disconnected' | 'server_shutdown' }
  | {
      type: 'error';
      code:
        | 'SESSION_NOT_FOUND'
        | 'HOST_REQUIRED'
        | 'INVALID_MESSAGE'
        | 'INVALID_SESSION_ID'
        | 'INVALID_TARGET_ID'
        | 'INVALID_POINTER'
        | 'ROOM_FULL'
        | 'RATE_LIMITED';
    };
