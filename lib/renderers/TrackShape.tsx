import type { PointerEvent } from 'react';
import { connectors, degToRad, isDoubleTrack, partLength } from '@/lib/geometry';
import type { PlacedTrack } from '@/lib/geometry';
import type { TrackPart } from '@/lib/unitrack';
import { getRendererFamily } from './rendererRegistry';

const PX_PER_MM = 1.15;
function mm(v: number) { return v * PX_PER_MM; }

type TrackShapeLayer = 'roadbed' | 'rails' | 'markers' | 'both';

export function TrackShape({
  part,
  item,
  selected = false,
  ghost = false,
  onPointerDown,
  layer = 'both',
  connectionStates,
  selectedNodeKey,
  onNodeClick,
}: {
  part: TrackPart;
  item: Pick<PlacedTrack, 'x' | 'y' | 'rotation' | 'flip' | 'customLength' | 'shapeWidth' | 'shapeHeight' | 'shapeSide' | 'shapeDiameter' | 'shapeColor' | 'buildingSvg'> & { uid?: string };
  selected?: boolean;
  ghost?: boolean;
  onPointerDown?: (e: PointerEvent<SVGGElement>) => void;
  layer?: 'roadbed' | 'rails' | 'markers' | 'both';
  connectionStates?: boolean[];
  selectedNodeKey?: string | null;
  onNodeClick?: (uid: string, key: string) => void;
}) {
  const railStroke = ghost ? 'var(--rail-ghost-stroke)' : selected ? 'var(--rail-selected-stroke)' : 'var(--rail-stroke)';
  const roadbedStroke = part.color || 'var(--roadbed-stroke)';
  const isDouble = isDoubleTrack(part);
  const isViaduct = part.secondaryKinds?.includes('Viaduct') ?? false;
  const isBridge = part.secondaryKinds?.includes('Bridge') ?? false;
  const rendererFamily = getRendererFamily(part);
  const bridgeStyle = part.bridgeStyle ?? (part.name.toLowerCase().includes('truss') ? 'truss' : part.name.toLowerCase().includes('plate') ? 'plate-girder' : part.name.toLowerCase().includes('girder') ? 'deck-girder' : undefined);
  const bridgeStructureStroke = part.color || 'var(--bridge-structure-stroke)';
  const bridgeShadowStroke = 'var(--bridge-shadow-stroke)';
  const roadbedWidth = 25;
  function doubleTrackCenterFillWidth(trackCenters: number) {
    // Auto-size the center infill so double-track roadbeds visually merge without seams.
    // The minimum gap is the space between two 25mm roadbeds; the rail-derived guard
    // accounts for rail offset/stroke anti-aliasing at different zoom levels.
    const roadbedGap = Math.max(0, trackCenters - roadbedWidth);
    const railGuard = railOffset * 2 + railWidth / 2;
    return Math.max(roadbedGap + railWidth, railGuard);
  }
  const viaductWallStroke = 'var(--viaduct-wall-stroke)';
  const viaductWallWidth = 4;
  const railWidth = 2;
  const railOffset = 4.5; // two rails 9mm apart, centered on track centerline
  const lineCap = 'butt' as const;
  const effectiveLength = partLength(part, item);
  const transform = `translate(${mm(item.x)} ${mm(item.y)}) rotate(${item.rotation}) scale(${item.flip ? '1 -1' : '1 1'})`;
  const opacity = ghost ? 0.55 : 1;
  const className = onPointerDown ? 'cursor-grab' : 'pointer-events-none';

  const markerPorts = !ghost
    ? connectors(part, { uid: item.uid ?? 'shape', partId: part.id, x: item.x, y: item.y, rotation: item.rotation, flip: item.flip }).map((c, idx) => {
      const key = c.key ?? String(idx);
      const isPrimaryAB = key === 'a' || key === 'b' || c.label === 'A' || c.label === 'B';
      const label = key === 'a' || c.label === 'A' ? 'A' : key === 'b' || c.label === 'B' ? 'B' : '';
      const isActiveNode = selectedNodeKey === key;
      const fill = selected && isPrimaryAB
        ? (label === 'A' ? 'var(--node-a-highlight)' : 'var(--node-b-highlight)')
        : connectionStates?.[idx]
          ? 'var(--connection-good)'
          : 'var(--connection-open)';
      return (
        <g
          key={`${key}`}
          transform={`translate(${mm(c.x)} ${mm(c.y)})`}
          pointerEvents={selected && isPrimaryAB && onNodeClick ? 'auto' : 'none'}
          onClick={(e) => {
            if (!selected || !isPrimaryAB || !onNodeClick) return;
            e.stopPropagation();
            onNodeClick(item.uid ?? '', key);
          }}
          className={selected && isPrimaryAB && onNodeClick ? 'cursor-pointer' : undefined}
        >
          <circle
            r={selected && isPrimaryAB ? (isActiveNode ? '8' : '6.5') : '5'}
            fill={fill}
            stroke={isActiveNode ? 'var(--node-active-ring)' : 'var(--connection-node-ring)'}
            strokeWidth={isActiveNode ? '2.5' : '1.5'}
          />
          <line x1="0" y1="0" x2={mm(10 * Math.cos(degToRad(c.heading)))} y2={mm(10 * Math.sin(degToRad(c.heading)))} stroke="var(--port-heading)" strokeWidth="1.45" strokeLinecap="round" opacity="0.8" />
          {selected && isPrimaryAB && <text
            x="0"
            y={mm(-11)}
            fill="var(--node-label-fill)"
            stroke="var(--node-label-stroke)"
            strokeWidth="2.4"
            paintOrder="stroke"
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
          >{label}</text>}
        </g>
      );
    })
    : null;

  if (layer === 'markers') return <>{markerPorts}</>;

  function viaductStraightWalls(x1: number, y1: number, x2: number, y2: number, key: string) {
    if (!isViaduct || !(layer === 'roadbed' || layer === 'both')) return null;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const edgeOffset = roadbedWidth / 2 - viaductWallWidth / 2;
    const ox = nx * edgeOffset;
    const oy = ny * edgeOffset;
    return <g key={`${key}-viaduct-walls`}>
      <line x1={mm(x1 + ox)} y1={mm(y1 + oy)} x2={mm(x2 + ox)} y2={mm(y2 + oy)} stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
      <line x1={mm(x1 - ox)} y1={mm(y1 - oy)} x2={mm(x2 - ox)} y2={mm(y2 - oy)} stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
    </g>;
  }

  function railLine(x1: number, y1: number, x2: number, y2: number, key: string, drawRoadbed = true) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * railOffset;
    const oy = (dx / len) * railOffset;
    return <g key={key}>
      {drawRoadbed && (layer === 'roadbed' || layer === 'both') && <>
        <line x1={mm(x1)} y1={mm(y1)} x2={mm(x2)} y2={mm(y2)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        {viaductStraightWalls(x1, y1, x2, y2, key)}
      </>}
      {(layer === 'rails' || layer === 'both') && <>
        <line x1={mm(x1 + ox)} y1={mm(y1 + oy)} x2={mm(x2 + ox)} y2={mm(y2 + oy)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <line x1={mm(x1 - ox)} y1={mm(y1 - oy)} x2={mm(x2 - ox)} y2={mm(y2 - oy)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      </>}
    </g>;
  }


  function straightRoadbedOnly(x1: number, y1: number, x2: number, y2: number, key: string, drawRoadbed = true) {
    if (!drawRoadbed) return null;
    return <g key={`${key}-roadbed-only`}>
      <line x1={mm(x1)} y1={mm(y1)} x2={mm(x2)} y2={mm(y2)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
      {viaductStraightWalls(x1, y1, x2, y2, key)}
    </g>;
  }

  function straightRailsOnly(x1: number, y1: number, x2: number, y2: number, key: string) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * railOffset;
    const oy = (dx / len) * railOffset;
    return <g key={`${key}-rails-only`}>
      <line x1={mm(x1 + ox)} y1={mm(y1 + oy)} x2={mm(x2 + ox)} y2={mm(y2 + oy)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <line x1={mm(x1 - ox)} y1={mm(y1 - oy)} x2={mm(x2 - ox)} y2={mm(y2 - oy)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
    </g>;
  }

  function bumperStopShape(length: number) {
    const stopColor = part.color || 'var(--rail-stroke)';
    const darkStroke = selected ? 'var(--selection-stroke)' : 'var(--rail-stroke)';
    const beamX = length - 3;
    const braceBackX = Math.max(0, length - 17);
    const postBackX = Math.max(0, length - 10);
    const bumperHalfWidth = 9.5;
    return <g key="bumper-track">
      {(layer === 'roadbed' || layer === 'both') && <>
        <line x1={0} y1={0} x2={mm(length)} y2={0} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        {viaductStraightWalls(0, 0, length, 0, 'bumper')}
      </>}
      {(layer === 'rails' || layer === 'both') && <>
        {straightRailsOnly(0, 0, length - 4, 0, 'bumper-rails')}
        <line x1={mm(beamX)} y1={mm(-bumperHalfWidth)} x2={mm(beamX)} y2={mm(bumperHalfWidth)} stroke={stopColor} strokeWidth="4.5" strokeLinecap="butt" />
        <line x1={mm(postBackX)} y1={mm(-railOffset)} x2={mm(beamX)} y2={mm(-railOffset)} stroke={stopColor} strokeWidth="3.2" strokeLinecap="butt" />
        <line x1={mm(postBackX)} y1={mm(railOffset)} x2={mm(beamX)} y2={mm(railOffset)} stroke={stopColor} strokeWidth="3.2" strokeLinecap="butt" />
        <line x1={mm(braceBackX)} y1={mm(-railOffset)} x2={mm(beamX)} y2={mm(-bumperHalfWidth + 1.5)} stroke={darkStroke} strokeWidth="2.1" strokeLinecap="butt" />
        <line x1={mm(braceBackX)} y1={mm(railOffset)} x2={mm(beamX)} y2={mm(bumperHalfWidth - 1.5)} stroke={darkStroke} strokeWidth="2.1" strokeLinecap="butt" />
        <line x1={mm(braceBackX)} y1={mm(railOffset)} x2={mm(beamX)} y2={mm(-bumperHalfWidth + 1.5)} stroke={darkStroke} strokeWidth="1.6" strokeLinecap="butt" opacity="0.8" />
        <line x1={mm(braceBackX)} y1={mm(-railOffset)} x2={mm(beamX)} y2={mm(bumperHalfWidth - 1.5)} stroke={darkStroke} strokeWidth="1.6" strokeLinecap="butt" opacity="0.8" />
        <rect x={mm(length - 7)} y={mm(-bumperHalfWidth - 2.5)} width={mm(8)} height={mm(5)} fill={stopColor} stroke={darkStroke} strokeWidth="1" />
        <rect x={mm(length - 7)} y={mm(bumperHalfWidth - 2.5)} width={mm(8)} height={mm(5)} fill={stopColor} stroke={darkStroke} strokeWidth="1" />
      </>}
    </g>;
  }

  function crossoverRouteGeometry(startX: number, startY: number, endX: number, endY: number) {
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * railOffset;
    const oy = (dx / len) * railOffset;
    const controlInset = Math.min(Math.abs(dx) * 0.38, 95);
    const c1x = startX + Math.sign(dx || 1) * controlInset;
    const c1y = startY;
    const c2x = endX - Math.sign(dx || 1) * controlInset;
    const c2y = endY;
    return {
      center: `M ${mm(startX)} ${mm(startY)} C ${mm(c1x)} ${mm(c1y)} ${mm(c2x)} ${mm(c2y)} ${mm(endX)} ${mm(endY)}`,
      plus: `M ${mm(startX + ox)} ${mm(startY + oy)} C ${mm(c1x + ox)} ${mm(c1y + oy)} ${mm(c2x + ox)} ${mm(c2y + oy)} ${mm(endX + ox)} ${mm(endY + oy)}`,
      minus: `M ${mm(startX - ox)} ${mm(startY - oy)} C ${mm(c1x - ox)} ${mm(c1y - oy)} ${mm(c2x - ox)} ${mm(c2y - oy)} ${mm(endX - ox)} ${mm(endY - oy)}`,
    };
  }

  function crossoverRouteRoadbed(startX: number, startY: number, endX: number, endY: number, key: string) {
    const g = crossoverRouteGeometry(startX, startY, endX, endY);
    return <path key={`${key}-roadbed-only`} d={g.center} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />;
  }

  function crossoverRouteRails(startX: number, startY: number, endX: number, endY: number, key: string) {
    const g = crossoverRouteGeometry(startX, startY, endX, endY);
    return <g key={`${key}-rails-only`}>
      <path d={g.plus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <path d={g.minus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
    </g>;
  }

  function turnoutBranchGeometry(ex: number, ey: number, len: number) {
    const cx = len * 0.45;
    const cy = ey * 0.15;
    const chordLen = Math.hypot(ex, ey) || 1;
    const ox = (-ey / chordLen) * railOffset;
    const oy = (ex / chordLen) * railOffset;
    return {
      center: `M 0 0 Q ${mm(cx)} ${mm(cy)} ${mm(ex)} ${mm(ey)}`,
      plus: `M ${mm(ox)} ${mm(oy)} Q ${mm(cx + ox)} ${mm(cy + oy)} ${mm(ex + ox)} ${mm(ey + oy)}`,
      minus: `M ${mm(-ox)} ${mm(-oy)} Q ${mm(cx - ox)} ${mm(cy - oy)} ${mm(ex - ox)} ${mm(ey - oy)}`,
    };
  }

  function turnoutBranchRoadbedOnly(ex: number, ey: number, len: number, key: string) {
    return <path key={`${key}-roadbed-only`} d={turnoutBranchGeometry(ex, ey, len).center} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />;
  }

  function turnoutBranchRailsOnly(ex: number, ey: number, len: number, key: string) {
    const g = turnoutBranchGeometry(ex, ey, len);
    return <g key={`${key}-rails-only`}>
      <path d={g.plus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <path d={g.minus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
    </g>;
  }

  function routePath(startX: number, startY: number, endX: number, endY: number, key: string) {
    // Curved crossover route used by KATO 20-210 and related double-track crossovers.
    // Draw roadbed in the roadbed pass, then draw a pair of rail strokes in the rails pass.
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * railOffset;
    const oy = (dx / len) * railOffset;
    const controlInset = Math.min(Math.abs(dx) * 0.38, 95);
    const c1x = startX + Math.sign(dx || 1) * controlInset;
    const c1y = startY;
    const c2x = endX - Math.sign(dx || 1) * controlInset;
    const c2y = endY;
    const center = `M ${mm(startX)} ${mm(startY)} C ${mm(c1x)} ${mm(c1y)} ${mm(c2x)} ${mm(c2y)} ${mm(endX)} ${mm(endY)}`;
    const plus = `M ${mm(startX + ox)} ${mm(startY + oy)} C ${mm(c1x + ox)} ${mm(c1y + oy)} ${mm(c2x + ox)} ${mm(c2y + oy)} ${mm(endX + ox)} ${mm(endY + oy)}`;
    const minus = `M ${mm(startX - ox)} ${mm(startY - oy)} C ${mm(c1x - ox)} ${mm(c1y - oy)} ${mm(c2x - ox)} ${mm(c2y - oy)} ${mm(endX - ox)} ${mm(endY - oy)}`;
    return <g key={key}>
      {(layer === 'roadbed' || layer === 'both') && <path d={center} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />}
      {(layer === 'rails' || layer === 'both') && <>
        <path d={plus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <path d={minus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      </>}
    </g>;
  }

  function arcPath(centerRadius: number, angle: number, pathRadius = centerRadius) {
    const safePathRadius = Math.max(1, pathRadius);
    const startX = 0;
    const startY = centerRadius - safePathRadius;
    const endX = safePathRadius * Math.sin(degToRad(angle));
    const endY = centerRadius - safePathRadius * Math.cos(degToRad(angle));
    const large = Math.abs(angle) > 180 ? 1 : 0;
    const sweep = angle >= 0 ? 1 : 0;
    return `M ${mm(startX)} ${mm(startY)} A ${mm(safePathRadius)} ${mm(safePathRadius)} 0 ${large} ${sweep} ${mm(endX)} ${mm(endY)}`;
  }

  function viaductCurveWalls(centerRadius: number, angle: number, key: string) {
    if (!isViaduct || !(layer === 'roadbed' || layer === 'both')) return null;
    const edgeOffset = roadbedWidth / 2 - viaductWallWidth / 2;
    return <g key={`${key}-viaduct-walls`}>
      <path d={arcPath(centerRadius, angle, centerRadius + edgeOffset)} fill="none" stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
      <path d={arcPath(centerRadius, angle, Math.max(1, centerRadius - edgeOffset))} fill="none" stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
    </g>;
  }

  function viaductDoubleStraightWalls(length: number, trackCenters: number, key: string) {
    if (!isViaduct || !(layer === 'roadbed' || layer === 'both')) return null;
    const edgeOffset = trackCenters / 2 + roadbedWidth / 2 - viaductWallWidth / 2;
    return <g key={`${key}-viaduct-walls`}>
      <line x1={0} y1={mm(-edgeOffset)} x2={mm(length)} y2={mm(-edgeOffset)} stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
      <line x1={0} y1={mm(edgeOffset)} x2={mm(length)} y2={mm(edgeOffset)} stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
    </g>;
  }

  function viaductDoubleCurveWalls(centerRadius: number, angle: number, trackCenters: number, key: string) {
    if (!isViaduct || !(layer === 'roadbed' || layer === 'both')) return null;
    const edgeOffset = trackCenters / 2 + roadbedWidth / 2 - viaductWallWidth / 2;
    return <g key={`${key}-viaduct-walls`}>
      <path d={arcPath(centerRadius, angle, centerRadius + edgeOffset)} fill="none" stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
      <path d={arcPath(centerRadius, angle, Math.max(1, centerRadius - edgeOffset))} fill="none" stroke={viaductWallStroke} strokeWidth={viaductWallWidth} strokeLinecap={lineCap} />
    </g>;
  }

  function curveRails(radius: number, angle: number, centerRadius = radius, key = 'curve-rails') {
    const outerRadius = radius + railOffset;
    const innerRadius = radius - railOffset;
    return (layer === 'rails' || layer === 'both') ? <g key={key}>
      <path d={arcPath(centerRadius, angle, outerRadius)} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <path d={arcPath(centerRadius, angle, innerRadius)} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
    </g> : null;
  }

  function curveShape(radius: number, angle: number, centerRadius = radius, drawRoadbed = true) {
    return <>
      {drawRoadbed && (layer === 'roadbed' || layer === 'both') && <>
        <path d={arcPath(centerRadius, angle, radius)} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        {viaductCurveWalls(centerRadius, angle, 'curve')}
      </>}
      {curveRails(radius, angle, centerRadius)}
    </>;
  }

  function doubleCurveShape(radius1: number, radius2: number, angle: number) {
    const centerRadius = (radius1 + radius2) / 2;
    const trackCenters = Math.abs(radius2 - radius1) || (part.trackCenters ?? 33);
    const fillWidth = doubleTrackCenterFillWidth(trackCenters);
    return <>
      {(layer === 'roadbed' || layer === 'both') && <>
        {fillWidth > 0 && <path d={arcPath(centerRadius, angle, centerRadius)} fill="none" stroke={roadbedStroke} strokeWidth={fillWidth} strokeLinecap={lineCap} />}
        <path d={arcPath(centerRadius, angle, radius1)} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, radius2)} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        {viaductDoubleCurveWalls(centerRadius, angle, trackCenters, 'double-curve')}
      </>}
      {curveRails(radius1, angle, centerRadius, 'double-curve-track-1')}
      {curveRails(radius2, angle, centerRadius, 'double-curve-track-2')}
    </>;
  }

  function doubleStraightShape(length: number, trackCenters = 33) {
    const halfCenter = trackCenters / 2;
    const fillWidth = doubleTrackCenterFillWidth(trackCenters);
    return <>
      {(layer === 'roadbed' || layer === 'both') && <>
        {fillWidth > 0 && <line x1={0} y1={0} x2={mm(length)} y2={0} stroke={roadbedStroke} strokeWidth={fillWidth} strokeLinecap={lineCap} />}
        <line x1={0} y1={mm(-halfCenter)} x2={mm(length)} y2={mm(-halfCenter)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        <line x1={0} y1={mm(halfCenter)} x2={mm(length)} y2={mm(halfCenter)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        {viaductDoubleStraightWalls(length, trackCenters, 'double-straight')}
      </>}
      {railLine(0, -halfCenter, length, -halfCenter, 'double-straight-upper', false)}
      {railLine(0, halfCenter, length, halfCenter, 'double-straight-lower', false)}
    </>;
  }

  function bridgeStraightShape(length: number) {
    // Top-down bridge renderer. The truss style is drawn like the KATO
    // single-track truss bridge: compact rectangular frame, side chords,
    // repeated posts, and X bracing. Overall width is close to the viaduct.
    const trussChordStroke = 3;
    const trussOverallWidth = 30;
    const bridgeHalfWidth = bridgeStyle === 'truss' ? (trussOverallWidth - trussChordStroke) / 2 : roadbedWidth / 2 + 5;
    const innerOffset = bridgeStyle === 'truss' ? Math.max(railOffset + 2.5, bridgeHalfWidth - 4.5) : roadbedWidth / 2 - 2;
    const panelCount = Math.max(4, Math.round(length / (bridgeStyle === 'truss' ? 31 : 28)));
    const panelLength = length / panelCount;

    const trussPanels = [] as any[];
    if (bridgeStyle === 'truss') {
      for (let i = 0; i < panelCount; i++) {
        const x1 = i * panelLength;
        const x2 = (i + 1) * panelLength;
        const midX = x1 + panelLength / 2;
        trussPanels.push(
          <g key={`truss-panel-${i}`}>
            <line x1={mm(x1)} y1={mm(-bridgeHalfWidth)} x2={mm(x1)} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="1.6" strokeLinecap="butt" />
            <line x1={mm(x1)} y1={mm(-bridgeHalfWidth)} x2={mm(x2)} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="1.45" strokeLinecap="round" />
            <line x1={mm(x1)} y1={mm(bridgeHalfWidth)} x2={mm(x2)} y2={mm(-bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="1.45" strokeLinecap="round" />
            <line x1={mm(midX)} y1={mm(-bridgeHalfWidth)} x2={mm(midX)} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="1" strokeLinecap="butt" opacity="0.65" />
          </g>
        );
      }
      trussPanels.push(
        <line key="truss-end-post" x1={mm(length)} y1={mm(-bridgeHalfWidth)} x2={mm(length)} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="1.6" strokeLinecap="butt" />
      );
    }

    const girderRibs = [] as any[];
    if (bridgeStyle === 'plate-girder' || bridgeStyle === 'deck-girder') {
      const ribCount = Math.max(3, Math.round(length / 28));
      for (let i = 1; i < ribCount; i++) {
        const x = (length / ribCount) * i;
        girderRibs.push(
          <line key={`girder-rib-${i}`} x1={mm(x)} y1={mm(-bridgeHalfWidth)} x2={mm(x)} y2={mm(bridgeHalfWidth)} stroke={bridgeShadowStroke} strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        );
      }
    }

    return <>
      {(layer === 'roadbed' || layer === 'both') && <>
        <line x1={0} y1={0} x2={mm(length)} y2={0} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />

        {bridgeStyle === 'truss' && <>
          <line x1={0} y1={mm(-bridgeHalfWidth)} x2={mm(length)} y2={mm(-bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth={trussChordStroke} strokeLinecap={lineCap} />
          <line x1={0} y1={mm(bridgeHalfWidth)} x2={mm(length)} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth={trussChordStroke} strokeLinecap={lineCap} />
          <line x1={0} y1={mm(-bridgeHalfWidth)} x2={0} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="2.2" strokeLinecap={lineCap} />
          <line x1={mm(length)} y1={mm(-bridgeHalfWidth)} x2={mm(length)} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="2.2" strokeLinecap={lineCap} />
          <line x1={0} y1={mm(-innerOffset)} x2={mm(length)} y2={mm(-innerOffset)} stroke={bridgeShadowStroke} strokeWidth="1.3" strokeLinecap={lineCap} opacity="0.7" />
          <line x1={0} y1={mm(innerOffset)} x2={mm(length)} y2={mm(innerOffset)} stroke={bridgeShadowStroke} strokeWidth="1.3" strokeLinecap={lineCap} opacity="0.7" />
          {trussPanels}
        </>}

        {(bridgeStyle === 'plate-girder' || bridgeStyle === 'deck-girder') && <>
          <line x1={0} y1={mm(-bridgeHalfWidth)} x2={mm(length)} y2={mm(-bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="8" strokeLinecap={lineCap} />
          <line x1={0} y1={mm(bridgeHalfWidth)} x2={mm(length)} y2={mm(bridgeHalfWidth)} stroke={bridgeStructureStroke} strokeWidth="8" strokeLinecap={lineCap} />
          <line x1={0} y1={mm(-innerOffset)} x2={mm(length)} y2={mm(-innerOffset)} stroke={bridgeShadowStroke} strokeWidth="2" strokeLinecap={lineCap} opacity="0.7" />
          <line x1={0} y1={mm(innerOffset)} x2={mm(length)} y2={mm(innerOffset)} stroke={bridgeShadowStroke} strokeWidth="2" strokeLinecap={lineCap} opacity="0.7" />
          {girderRibs}
        </>}
      </>}
      {railLine(0, 0, length, 0, 'bridge-rails', false)}
    </>;
  }
  function turnoutBranch(ex: number, ey: number, len: number) {
    const cx = len * 0.45;
    const cy = ey * 0.15;
    const chordLen = Math.hypot(ex, ey) || 1;
    const ox = (-ey / chordLen) * railOffset;
    const oy = (ex / chordLen) * railOffset;
    const center = `M 0 0 Q ${mm(cx)} ${mm(cy)} ${mm(ex)} ${mm(ey)}`;
    const plus = `M ${mm(ox)} ${mm(oy)} Q ${mm(cx + ox)} ${mm(cy + oy)} ${mm(ex + ox)} ${mm(ey + oy)}`;
    const minus = `M ${mm(-ox)} ${mm(-oy)} Q ${mm(cx - ox)} ${mm(cy - oy)} ${mm(ex - ox)} ${mm(ey - oy)}`;
    return <>
      {(layer === 'roadbed' || layer === 'both') && <path d={center} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />}
      {(layer === 'rails' || layer === 'both') && <>
        <path d={plus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <path d={minus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      </>}
    </>;
  }

  function buildingShape(width = 80, depth = 50) {
    const fill = part.color || 'var(--building-fill)';
    const stroke = selected ? 'var(--selection-stroke)' : 'var(--building-stroke)';
    const ribStroke = 'var(--building-rib-stroke)';
    const w = width;
    const d = depth;
    const x = -w / 2;
    const y = -d / 2;
    const svgContent = item.buildingSvg?.trim();

    if (svgContent && part.buildingStyle !== 'platform') {
      const svgHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
      return <>
        {(layer === 'roadbed' || layer === 'both') && <g>
          <rect x={mm(x)} y={mm(y)} width={mm(w)} height={mm(d)} fill={fill} stroke={stroke} strokeWidth="2" opacity="0.18" />
          <image href={svgHref} x={mm(x)} y={mm(y)} width={mm(w)} height={mm(d)} preserveAspectRatio="xMidYMid meet" />
          <rect x={mm(x)} y={mm(y)} width={mm(w)} height={mm(d)} fill="none" stroke={stroke} strokeWidth="1.5" opacity={selected ? 1 : 0.45} />
        </g>}
      </>;
    }

    if (part.buildingStyle === 'platform') {
      const platformFill = 'var(--platform-fill)';
      const platformStroke = selected ? 'var(--selection-stroke)' : 'var(--platform-stroke)';
      const platformRibStroke = 'var(--platform-rib-stroke)';
      const platformSafetyLine = 'var(--platform-safety-line)';
      const isLeftEnd = part.id.includes('end-left');
      const isRightEnd = part.id.includes('end-right');
      const edgeInset = 4;
      const safetyLineInset = d * 0.28;

      // KATO 23-170A/D island-platform end sections have a 200 mm x 42 mm
      // footprint with one long edge gently curved in plan view.  Render those
      // end pieces with a curved side instead of the older straight tapered nose.
      // The curved 23-170 end sections are tuned against the EP718-15
      // geometry. Over a 200 mm platform end, an R718 curve rises about
      // 28 mm from its tangent, so the curved platform edge uses a moderate
      // 28-29 mm sweep across the 42 mm depth: enough to clear the diverging
      // route after an S64 + S248 ladder, but less aggressive than the prior
      // full-depth clearance shape.
      const curveLow = d * 0.68;
      const curveMid = d * 0.3;
      const curveNose = d * 0.05;
      const endPath = isLeftEnd
        ? `M ${mm(x)} ${mm(y + d)} L ${mm(x)} ${mm(y + curveLow)} C ${mm(x + w * 0.26)} ${mm(y + curveMid)} ${mm(x + w * 0.58)} ${mm(y + curveNose)} ${mm(x + w)} ${mm(y)} L ${mm(x + w)} ${mm(y + d)} Z`
        : isRightEnd
          ? `M ${mm(x)} ${mm(y)} C ${mm(x + w * 0.42)} ${mm(y + curveNose)} ${mm(x + w * 0.74)} ${mm(y + curveMid)} ${mm(x + w)} ${mm(y + curveLow)} L ${mm(x + w)} ${mm(y + d)} L ${mm(x)} ${mm(y + d)} Z`
          : '';

      const platformPoints = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]
        .map(([px, py]) => `${mm(px)},${mm(py)}`).join(' ');
      const safetyTop = isLeftEnd
        ? `M ${mm(x + edgeInset)} ${mm(y + d * 0.60)} C ${mm(x + w * 0.26)} ${mm(y + d * 0.46)} ${mm(x + w * 0.58)} ${mm(y + d * 0.22)} ${mm(x + w - edgeInset)} ${mm(y + safetyLineInset)}`
        : isRightEnd
          ? `M ${mm(x + edgeInset)} ${mm(y + safetyLineInset)} C ${mm(x + w * 0.42)} ${mm(y + d * 0.22)} ${mm(x + w * 0.74)} ${mm(y + d * 0.46)} ${mm(x + w - edgeInset)} ${mm(y + d * 0.60)}`
          : '';

      return <>
        {(layer === 'roadbed' || layer === 'both') && <g>
          {(isLeftEnd || isRightEnd)
            ? <path d={endPath} fill={platformFill} stroke={platformStroke} strokeWidth="2" />
            : <polygon points={platformPoints} fill={platformFill} stroke={platformStroke} strokeWidth="2" />}
          {safetyTop && <path d={safetyTop} fill="none" stroke={platformSafetyLine} strokeWidth="1.2" strokeDasharray="5 4" opacity="0.85" />}
          {!safetyTop && <line x1={mm(x + edgeInset)} y1={mm(y + safetyLineInset)} x2={mm(x + w - edgeInset)} y2={mm(y + safetyLineInset)} stroke={platformSafetyLine} strokeWidth="1.2" strokeDasharray="5 4" opacity="0.85" />}
          {!safetyTop && <line x1={mm(x + edgeInset)} y1={mm(y + d - safetyLineInset)} x2={mm(x + w - edgeInset)} y2={mm(y + d - safetyLineInset)} stroke={platformRibStroke} strokeWidth="0.9" opacity="0.55" />}
        </g>}
      </>;
    }

    const ribCount = Math.max(4, Math.round(w / 14));
    const ribs = [] as any[];
    for (let i = 1; i < ribCount; i++) {
      const rx = x + (w / ribCount) * i;
      ribs.push(<line key={`building-rib-${i}`} x1={mm(rx)} y1={mm(y + 5)} x2={mm(rx)} y2={mm(y + d - 5)} stroke={ribStroke} strokeWidth="3" strokeLinecap="butt" opacity="0.75" />);
    }
    return <>
      {(layer === 'roadbed' || layer === 'both') && <g>
        <rect x={mm(x)} y={mm(y)} width={mm(w)} height={mm(d)} rx="0" fill={fill} stroke={stroke} strokeWidth="2" />
        <rect x={mm(x + 4)} y={mm(y + 4)} width={mm(w - 8)} height={mm(d - 8)} fill="none" stroke={ribStroke} strokeWidth="1.2" opacity="0.7" />
        {ribs}
        {[ [x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + d - 5], [x + w - 5, y + d - 5] ].map(([cx, cy], idx) => (
          <rect key={`building-corner-${idx}`} x={mm(cx - 2.5)} y={mm(cy - 2.5)} width={mm(5)} height={mm(5)} fill="var(--building-detail-fill)" stroke={stroke} strokeWidth="0.8" />
        ))}
      </g>}
    </>;
  }


  function customShape() {
    const fill = item.shapeColor || part.color || 'var(--shape-fill)';
    const stroke = selected ? 'var(--selection-stroke)' : 'var(--shape-stroke)';
    const detailStroke = 'var(--shape-detail-stroke)';
    const shapeType = part.shapeType ?? 'rectangle';

    if (shapeType === 'circle') {
      const diameter = item.shapeDiameter ?? part.shapeDiameter ?? 75;
      const r = diameter / 2;
      return <>
        {(layer === 'roadbed' || layer === 'both') && <g>
          <circle cx="0" cy="0" r={mm(r)} fill={fill} stroke={stroke} strokeWidth="2" />
          <line x1={mm(-r * 0.7)} y1="0" x2={mm(r * 0.7)} y2="0" stroke={detailStroke} strokeWidth="1" opacity="0.55" />
          <line x1="0" y1={mm(-r * 0.7)} x2="0" y2={mm(r * 0.7)} stroke={detailStroke} strokeWidth="1" opacity="0.55" />
        </g>}
      </>;
    }

    if (shapeType === 'triangle') {
      const side = item.shapeSide ?? part.shapeSide ?? 80;
      const h = side * Math.sqrt(3) / 2;
      const pts = [
        [0, -h / 2],
        [-side / 2, h / 2],
        [side / 2, h / 2],
      ].map(([x, y]) => `${mm(x)},${mm(y)}`).join(' ');
      return <>
        {(layer === 'roadbed' || layer === 'both') && <g>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="2" />
          <line x1="0" y1={mm(-h / 2 + 6)} x2="0" y2={mm(h / 2 - 6)} stroke={detailStroke} strokeWidth="1" opacity="0.55" />
        </g>}
      </>;
    }

    const width = item.shapeWidth ?? part.shapeWidth ?? 100;
    const height = item.shapeHeight ?? part.shapeHeight ?? 60;
    return <>
      {(layer === 'roadbed' || layer === 'both') && <g>
        <rect x={mm(-width / 2)} y={mm(-height / 2)} width={mm(width)} height={mm(height)} fill={fill} stroke={stroke} strokeWidth="2" />
        <rect x={mm(-width / 2 + 5)} y={mm(-height / 2 + 5)} width={mm(Math.max(0, width - 10))} height={mm(Math.max(0, height - 10))} fill="none" stroke={detailStroke} strokeWidth="1" opacity="0.65" />
        <line x1={mm(-width / 2)} y1="0" x2={mm(width / 2)} y2="0" stroke={detailStroke} strokeWidth="1" opacity="0.35" />
        <line x1="0" y1={mm(-height / 2)} x2="0" y2={mm(height / 2)} stroke={detailStroke} strokeWidth="1" opacity="0.35" />
      </g>}
    </>;
  }

  let shape = <></>;

  if (rendererFamily === 'building') {
    shape = buildingShape(part.width ?? 80, part.depth ?? 50);
  } else if (rendererFamily === 'shape') {
    shape = customShape();
  } else if (part.kind === 'curve') {
    if (isDoubleTrack(part) && part.radius2) {
      shape = doubleCurveShape(part.radius ?? 0, part.radius2, part.angle ?? 0);
    } else {
      shape = curveShape(part.radius ?? 0, part.angle ?? 0);
    }
  } else if (rendererFamily === 'turnout' || rendererFamily === 'wye') {
    const len = part.length ?? 186;
    const r = part.radius ?? 718;
    const a = part.angle ?? 15;

    if (part.diverging === 'wye') {
      const ex = r * Math.sin(degToRad(a));
      const ey = r * (1 - Math.cos(degToRad(a)));
      shape = <>
        {(layer === 'roadbed' || layer === 'both') && <>
          {turnoutBranchRoadbedOnly(ex, -ey, len, 'wye-left')}
          {turnoutBranchRoadbedOnly(ex, ey, len, 'wye-right')}
        </>}
        {(layer === 'rails' || layer === 'both') && <>
          {turnoutBranchRailsOnly(ex, -ey, len, 'wye-left')}
          {turnoutBranchRailsOnly(ex, ey, len, 'wye-right')}
        </>}
      </>;
    } else {
      const sign = part.diverging === 'left' ? -1 : 1;
      const ex = r * Math.sin(degToRad(a));
      const ey = sign * r * (1 - Math.cos(degToRad(a)));
      shape = <>
        {(layer === 'roadbed' || layer === 'both') && <>
          {straightRoadbedOnly(0, 0, len, 0, 'turnout-straight')}
          {turnoutBranchRoadbedOnly(ex, ey, len, 'turnout-branch')}
        </>}
        {(layer === 'rails' || layer === 'both') && <>
          {straightRailsOnly(0, 0, len, 0, 'turnout-straight')}
          {turnoutBranchRailsOnly(ex, ey, len, 'turnout-branch')}
        </>}
      </>;
    }
  } else if (rendererFamily === 'crossing') {
    const len = part.length ?? 310;
    const halfCenter = (part.trackCenters ?? 33) / 2;

    if (!isDoubleTrack(part)) {
      const angle = part.angle ?? 90;
      const sign = part.diverging === 'right' ? -1 : 1;
      const a = sign * angle;
      const cx = len / 2;
      const half = len / 2;
      const dx = half * Math.cos(degToRad(a));
      const dy = half * Math.sin(degToRad(a));
      shape = <>
        {(layer === 'roadbed' || layer === 'both') && <>
          {straightRoadbedOnly(0, 0, len, 0, 'crossing-main')}
          {straightRoadbedOnly(cx - dx, -dy, cx + dx, dy, 'crossing-cross')}
        </>}
        {(layer === 'rails' || layer === 'both') && <>
          {straightRailsOnly(0, 0, len, 0, 'crossing-main')}
          {straightRailsOnly(cx - dx, -dy, cx + dx, dy, 'crossing-cross')}
        </>}
      </>;
    } else {
      const crossoverLeftToRight = part.diverging !== 'right';
      const crossoverRightToLeft = part.diverging !== 'left';
      const isDoubleCrossover = part.sku === '20-210' || part.id === 'double-crossover';
      const routeStart = isDoubleCrossover ? len * 0.18 : len * 0.34;
      const routeEnd = isDoubleCrossover ? len * 0.82 : len * 0.66;
      shape = <>
        {(layer === 'roadbed' || layer === 'both') && <>
          {(() => { const fillWidth = doubleTrackCenterFillWidth(part.trackCenters ?? 33); return fillWidth > 0 ? <line x1={0} y1={0} x2={mm(len)} y2={0} stroke={roadbedStroke} strokeWidth={fillWidth} strokeLinecap={lineCap} /> : null; })()}
          <line x1={0} y1={mm(-halfCenter)} x2={mm(len)} y2={mm(-halfCenter)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
          <line x1={0} y1={mm(halfCenter)} x2={mm(len)} y2={mm(halfCenter)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
          {viaductDoubleStraightWalls(len, part.trackCenters ?? 33, 'crossing-double')}
          {crossoverLeftToRight && crossoverRouteRoadbed(routeStart, -halfCenter, routeEnd, halfCenter, 'crossover-upper-to-lower')}
          {crossoverRightToLeft && crossoverRouteRoadbed(routeStart, halfCenter, routeEnd, -halfCenter, 'crossover-lower-to-upper')}
        </>}
        {(layer === 'rails' || layer === 'both') && <>
          {crossoverLeftToRight && crossoverRouteRails(routeStart, -halfCenter, routeEnd, halfCenter, 'crossover-upper-to-lower')}
          {crossoverRightToLeft && crossoverRouteRails(routeStart, halfCenter, routeEnd, -halfCenter, 'crossover-lower-to-upper')}
          {straightRailsOnly(0, -halfCenter, len, -halfCenter, 'crossing-upper')}
          {straightRailsOnly(0, halfCenter, len, halfCenter, 'crossing-lower')}
          {isDoubleCrossover && <circle cx={mm(len / 2)} cy="0" r="3.25" fill={railStroke} opacity="0.9" />}
        </>}
      </>;
    }
  } else {
    shape = rendererFamily === 'truss-bridge' || rendererFamily === 'deck-girder-bridge' || rendererFamily === 'plate-girder-bridge'
      ? bridgeStraightShape(effectiveLength)
      : rendererFamily === 'bumper'
        ? bumperStopShape(effectiveLength)
        : rendererFamily === 'double-track' || rendererFamily === 'double-viaduct' || rendererFamily === 'double-slab-track'
          ? doubleStraightShape(effectiveLength, part.trackCenters ?? 33)
          : railLine(0, 0, effectiveLength, 0, 'straight');
  }

  return <g transform={transform} onPointerDown={onPointerDown} className={className} opacity={opacity}>{shape}</g>;
}
