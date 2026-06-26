import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
import type { GuidanceState, ObserverLocation, Page, StarPosition, TargetId, TargetPosition, ViewMetrics, ViewState } from './types';
import './styles.css';

const FALLBACK_LOCATION: ObserverLocation = {
  latitude: 35.6812,
  longitude: 139.7671,
  fallback: true,
};

function SkyCanvas({
  positions,
  stars,
  view,
  selectedTargetId,
  nightMode,
  showAurora,
  debug,
  onViewChange,
  onMetricsChange,
}: {
  positions: TargetPosition[];
  stars: StarPosition[];
  view: ViewState;
  selectedTargetId: TargetId | null;
  nightMode: boolean;
  showAurora: boolean;
  debug: boolean;
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
  }, [debug, nightMode, onMetricsChange, positions, selectedTargetId, showAurora, stars, view]);

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
  const [page, setPage] = useState<Page>('sky');
  const [selectedTargetId, setSelectedTargetId] = useState<TargetId | null>('moon');
  const [nightMode, setNightMode] = useState(false);
  const [showAurora, setShowAurora] = useState(true);
  const [view, setView] = useState<ViewState>({
    centerAzimuthDeg: 180,
    centerAltitudeDeg: 25,
    zoom: 7,
  });
  const [viewMetrics, setViewMetrics] = useState<ViewMetrics | null>(null);

  const debug = useMemo(() => new URLSearchParams(window.location.search).get('debug') === '1', []);

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

  const selectedPosition = positions.find((position) => position.id === selectedTargetId) ?? null;
  const guidance: GuidanceState | null = selectedPosition ? calculateGuidance(selectedPosition, view) : null;
  const selectedStatus = selectedPosition ? getAltitudeStatus(selectedPosition.altitudeDeg) : null;

  return (
    <main className={`app-shell ${nightMode ? 'night-mode' : ''}`}>
      <section className="top-bar">
        <div>
          <h1>{page === 'sky' ? 'Sky' : page === 'targets' ? 'Targets' : 'Settings'}</h1>
          <p>{locationStatus}</p>
        </div>
        <button type="button" onClick={() => setTime(new Date())}>
          Now
        </button>
      </section>

      {page === 'sky' && (
        <>
          <section className="sky-panel">
            <SkyCanvas
              positions={positions}
              stars={stars}
              view={view}
              selectedTargetId={selectedTargetId}
              nightMode={nightMode}
              showAurora={showAurora}
              debug={debug}
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
            {debug && (
              <div className="view-readout">
                <span>{formatDirection(view.centerAzimuthDeg)}</span>
                <span>Az {Math.round(view.centerAzimuthDeg)}°</span>
                <span>Alt {Math.round(view.centerAltitudeDeg)}°</span>
                <span>Zoom {viewMetrics?.zoom.toFixed(1) ?? view.zoom.toFixed(1)}</span>
                <span>FOV {viewMetrics ? `${Math.round(viewMetrics.horizontalFovDeg)}°` : '--'}</span>
              </div>
            )}
            {guidance && selectedPosition && (
              <GuidanceOverlay
                guidance={guidance}
                selectedPosition={selectedPosition}
                selectedStatus={selectedStatus}
                nightMode={nightMode}
              />
            )}
          </section>
        </>
      )}

      {page === 'targets' && (
        <TargetsPage
          positions={positions}
          selectedTargetId={selectedTargetId}
          onSelect={(targetId, position) => {
            setSelectedTargetId(targetId);
            setView((current) => ({
              ...current,
              centerAzimuthDeg: position.azimuthDeg,
              centerAltitudeDeg: clamp(position.altitudeDeg, -90, 80),
            }));
            setPage('sky');
          }}
        />
      )}

      {page === 'settings' && (
        <SettingsPage
          nightMode={nightMode}
          showAurora={showAurora}
          onNightModeChange={setNightMode}
          onShowAuroraChange={setShowAurora}
        />
      )}

      <nav className="bottom-nav" aria-label="画面切り替え">
        <button type="button" className={page === 'sky' ? 'active' : ''} onClick={() => setPage('sky')}>
          Sky
        </button>
        <button type="button" className={page === 'targets' ? 'active' : ''} onClick={() => setPage('targets')}>
          Targets
        </button>
        <button type="button" className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>
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
}: {
  guidance: GuidanceState;
  selectedPosition: TargetPosition;
  selectedStatus: ReturnType<typeof getAltitudeStatus> | null;
  nightMode: boolean;
}) {
  const target = TARGETS.find((item) => item.id === selectedPosition.id);
  const statusLabel = selectedStatus ? getAltitudeStatusLabel(selectedStatus) : '';
  const distanceDeg = Math.hypot(guidance.deltaAzimuthDeg, guidance.deltaAltitudeDeg);
  const maxDistanceDeg = 35;
  const pointerRadiusPx = Math.min(20, (Math.min(distanceDeg, maxDistanceDeg) / maxDistanceDeg) * 20);
  const nearCenter = pointerRadiusPx <= 12;
  const unitX = distanceDeg > 0 ? guidance.deltaAzimuthDeg / distanceDeg : 0;
  const unitY = distanceDeg > 0 ? -guidance.deltaAltitudeDeg / distanceDeg : 0;
  const pointerX = unitX * pointerRadiusPx;
  const pointerY = unitY * pointerRadiusPx;
  const compassCenter = 36;
  const tipX = compassCenter + unitX * (pointerRadiusPx + 13);
  const tipY = compassCenter + unitY * (pointerRadiusPx + 13);
  const baseX = compassCenter + unitX * (pointerRadiusPx - 8);
  const baseY = compassCenter + unitY * (pointerRadiusPx - 8);
  const notchX = compassCenter + unitX * (pointerRadiusPx - 1.5);
  const notchY = compassCenter + unitY * (pointerRadiusPx - 1.5);
  const perpX = -unitY;
  const perpY = unitX;
  const halfBase = 8;
  const trianglePoints = [
    `${tipX.toFixed(1)},${tipY.toFixed(1)}`,
    `${(baseX + perpX * halfBase).toFixed(1)},${(baseY + perpY * halfBase).toFixed(1)}`,
    `${notchX.toFixed(1)},${notchY.toFixed(1)}`,
    `${(baseX - perpX * halfBase).toFixed(1)},${(baseY - perpY * halfBase).toFixed(1)}`,
  ].join(' ');

  return (
    <div className={`guidance-panel ${guidance.acquired ? 'acquired' : ''} ${nightMode ? 'night' : ''}`}>
      <div className="guidance-target">{target?.label ?? selectedPosition.id}</div>
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

function TargetsPage({
  positions,
  selectedTargetId,
  onSelect,
}: {
  positions: TargetPosition[];
  selectedTargetId: TargetId | null;
  onSelect: (targetId: TargetId, position: TargetPosition) => void;
}) {
  return (
    <section className="page-panel targets-page">
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

function SettingsPage({
  nightMode,
  showAurora,
  onNightModeChange,
  onShowAuroraChange,
}: {
  nightMode: boolean;
  showAurora: boolean;
  onNightModeChange: (enabled: boolean) => void;
  onShowAuroraChange: (enabled: boolean) => void;
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
          <small>薄いオーロラ風グラデーションを表示します</small>
        </span>
        <input type="checkbox" checked={showAurora} onChange={(event) => onShowAuroraChange(event.target.checked)} />
      </label>

      <div className="settings-note">
        オーロラは背景演出です。実際のオーロラ表示ではありません。
        山は方角感を補助するための背景演出です。実地形ではありません。
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
