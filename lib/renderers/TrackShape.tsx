import type { PointerEvent, ReactElement } from 'react';
import { connectors, degToRad, isDoubleTrack, partLength, radToDeg } from '@/lib/geometry';
import type { PlacedTrack } from '@/lib/geometry';
import type { TrackPart } from '@/lib/unitrack';
import { getRendererFamily } from './rendererRegistry';

const PX_PER_MM = 1.15;
function mm(v: number) { return v * PX_PER_MM; }

type TrackShapeLayer = 'roadbed' | 'rails' | 'markers' | 'both';
type TrackRenderDetail = 'high' | 'low';

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
  renderDetail = 'high',
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
  renderDetail?: TrackRenderDetail;
}) {
  const railStroke = ghost ? 'var(--rail-ghost-stroke)' : selected ? 'var(--rail-selected-stroke)' : 'var(--rail-stroke)';
  const isConcreteSlabPart = part.secondaryKinds?.includes('Concrete Slab') || /\bslab\b/i.test(`${part.name} ${part.notes ?? ''}`);
  const isConcreteTiePart = /\bconcrete\b/i.test(`${part.name} ${part.notes ?? ''}`) && !isConcreteSlabPart;
  const roadbedStroke = part.color || (isConcreteTiePart ? 'var(--concrete-tie-stroke)' : 'var(--roadbed-stroke)');
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
    const seamOverlap = 3;
    const roadbedGap = Math.max(0, trackCenters - roadbedWidth);
    const railGuard = railOffset * 2 + railWidth / 2;
    return Math.max(roadbedGap + seamOverlap * 2, railGuard + seamOverlap);
  }
  const viaductWallStroke = 'var(--viaduct-wall-stroke)';
  const viaductWallWidth = 4;
  const railWidth = 2;
  const railOffset = 4.5; // two rails 9mm apart, centered on track centerline
  const concreteTieBedWidth = 58;
  const slabDeckWidth = 58;
  const lineCap = 'butt' as const;
  const effectiveLength = partLength(part, item);
  const transform = `translate(${mm(item.x)} ${mm(item.y)}) rotate(${item.rotation}) scale(${item.flip ? '1 -1' : '1 1'})`;
  const opacity = ghost ? 0.55 : 1;
  const className = onPointerDown ? 'cursor-grab' : 'pointer-events-none';
  const useLowDetail = renderDetail === 'low';

  const connectorPorts = !ghost
    ? connectors(part, { uid: item.uid ?? 'shape', partId: part.id, x: item.x, y: item.y, rotation: item.rotation, flip: item.flip })
    : [];

  const specialNodeRampMarkers = connectorPorts.reduce<ReactElement[]>((markers, c) => {
    const key = c.key ?? '';
    const specialPair = key.match(/^track-1-(a|b)$/);
    if (!c.compatibilityTag || !specialPair) return markers;
    const siblingKey = `track-2-${specialPair[1]}`;
    const sibling = connectorPorts.find(port => port.key === siblingKey && port.compatibilityTag === c.compatibilityTag);
    if (!sibling) return markers;

    const cx = (c.x + sibling.x) / 2;
    const cy = (c.y + sibling.y) / 2;
    const angle = radToDeg(Math.atan2(sibling.y - c.y, sibling.x - c.x));
    markers.push(
      <g
        key={`special-ramp-${key}`}
        transform={`translate(${mm(cx)} ${mm(cy)}) rotate(${angle})`}
        pointerEvents="none"
      >
        <path
          d="M -22 7 L -20 3 L -13 -2 C -10 -3.5 -7 -3 -4 0 L 0 3 L 4 0 C 7 -3 10 -3.5 13 -2 L 20 3 L 22 7 Z"
          fill="var(--special-node-ramp-fill)"
          stroke="var(--special-node-ramp-stroke)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <line x1="-14" y1="-4" x2="-14" y2="-1.5" stroke="var(--special-node-ramp-fill)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="-5" y1="-3" x2="-5" y2="0.5" stroke="var(--special-node-ramp-fill)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="5" y1="-3" x2="5" y2="0.5" stroke="var(--special-node-ramp-fill)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="14" y1="-4" x2="14" y2="-1.5" stroke="var(--special-node-ramp-fill)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="-19" y1="-13" x2="-4" y2="-10" stroke="var(--special-node-ramp-rail)" strokeWidth="3.3" strokeLinecap="butt" />
        <line x1="4" y1="-13" x2="19" y2="-10" stroke="var(--special-node-ramp-rail)" strokeWidth="3.3" strokeLinecap="butt" />
      </g>
    );
    return markers;
  }, []);

  const markerPorts = connectorPorts.length
    ? connectorPorts.map((c, idx) => {
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

  if (layer === 'markers') return <>{specialNodeRampMarkers}{markerPorts}</>;

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
      {!useLowDetail && viaductStraightWalls(x1, y1, x2, y2, key)}
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

  function lowDetailRailLine(x1: number, y1: number, x2: number, y2: number, key: string, drawRoadbed = true) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * railOffset;
    const oy = (dx / len) * railOffset;
    return <g key={key}>
      {drawRoadbed && (layer === 'roadbed' || layer === 'both') && <line x1={mm(x1)} y1={mm(y1)} x2={mm(x2)} y2={mm(y2)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />}
      {(layer === 'rails' || layer === 'both') && <>
        <line x1={mm(x1 + ox)} y1={mm(y1 + oy)} x2={mm(x2 + ox)} y2={mm(y2 + oy)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <line x1={mm(x1 - ox)} y1={mm(y1 - oy)} x2={mm(x2 - ox)} y2={mm(y2 - oy)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      </>}
    </g>;
  }

  function standardSingleTrackShape(length: number) {
    const halfBed = roadbedWidth / 2;
    const edgeStrokeWidth = 1.1;
    const edgeInset = (edgeStrokeWidth / 2) / PX_PER_MM;
    const dotInset = 0.55 / PX_PER_MM;
    const tieCount = Math.max(10, Math.floor(length / 5));
    const ties = Array.from({ length: tieCount }, (_, idx) => ((idx + 0.5) * length) / tieCount);
    const dotCount = Math.max(50, Math.floor(length * halfBed / 16));
    const dots = Array.from({ length: dotCount }, (_, idx) => {
      const x = ((idx * 37) % Math.max(1, Math.round(length * 10))) / 10;
      const dotHalfSpan = Math.max(0, halfBed - dotInset);
      const y = ((((idx * 53) % Math.max(1, Math.round(dotHalfSpan * 20))) / 10) - dotHalfSpan);
      const opacity = 0.15 + ((idx * 7) % 10) / 80;
      return <circle key={`standard-ballast-dot-${idx}`} cx={mm(x)} cy={mm(y)} r={idx % 3 === 0 ? '0.55' : '0.38'} fill="var(--standard-ballast-dot)" opacity={opacity} />;
    });

    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="standard-single-roadbed">
        <rect x={0} y={mm(-halfBed)} width={mm(length)} height={mm(halfBed * 2)} fill="var(--standard-ballast-fill)" />
        <line x1={0} y1={mm(-halfBed + edgeInset)} x2={mm(length)} y2={mm(-halfBed + edgeInset)} stroke="var(--standard-ballast-edge)" strokeWidth={edgeStrokeWidth} />
        <line x1={0} y1={mm(halfBed - edgeInset)} x2={mm(length)} y2={mm(halfBed - edgeInset)} stroke="var(--standard-ballast-edge)" strokeWidth={edgeStrokeWidth} />
        {dots}
      </g>}
      {(layer === 'rails' || layer === 'both') && <g key="standard-single-rails">
        {ties.map((x, idx) => (
          <g key={`standard-tie-${idx}`}>
            <line x1={mm(x)} y1={mm(-10.5)} x2={mm(x)} y2={mm(10.5)} stroke="var(--standard-tie-fill)" strokeWidth={idx % 6 === 0 ? '2.1' : '1.7'} strokeLinecap="butt" />
            <line x1={mm(x - 0.7)} y1={mm(-10)} x2={mm(x - 0.7)} y2={mm(10)} stroke="var(--standard-tie-highlight)" strokeWidth="0.4" opacity="0.55" />
          </g>
        ))}
        <line x1={0} y1={mm(-railOffset)} x2={mm(length)} y2={mm(-railOffset)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <line x1={0} y1={mm(railOffset)} x2={mm(length)} y2={mm(railOffset)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <line x1={0} y1={mm(-railOffset - 2.1)} x2={mm(length)} y2={mm(-railOffset - 2.1)} stroke="var(--standard-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.8" />
        <line x1={0} y1={mm(railOffset + 2.1)} x2={mm(length)} y2={mm(railOffset + 2.1)} stroke="var(--standard-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.8" />
      </g>}
    </>;
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

  function standardTurnoutShape(ex: number, ey: number, len: number, key: string, drawStraight = true) {
    const halfBed = roadbedWidth / 2;
    const branch = turnoutBranchGeometry(ex, ey, len);
    const branchPoint = (t: number) => {
      const cx = len * 0.45;
      const cy = ey * 0.15;
      const omt = 1 - t;
      const x = omt * omt * 0 + 2 * omt * t * cx + t * t * ex;
      const y = omt * omt * 0 + 2 * omt * t * cy + t * t * ey;
      const dx = 2 * omt * cx + 2 * t * (ex - cx);
      const dy = 2 * omt * cy + 2 * t * (ey - cy);
      return { x, y, angle: radToDeg(Math.atan2(dy, dx)) + 90 };
    };
    const distanceToBranch = (x: number, y: number) => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i <= 24; i++) {
        const p = branchPoint(i / 24);
        best = Math.min(best, Math.hypot(x - p.x, y - p.y));
      }
      return best;
    };
    const minY = Math.min(-halfBed, ey - halfBed);
    const maxY = Math.max(halfBed, ey + halfBed);
    const dotCount = Math.max(70, Math.floor((len * (maxY - minY)) / 80));
    const dots = Array.from({ length: dotCount }, (_, idx) => {
      const x = ((idx * 37) % Math.max(1, Math.round(len * 10))) / 10;
      const y = minY + (((idx * 53) % Math.max(1, Math.round((maxY - minY) * 10))) / 10);
      const inStraight = drawStraight && Math.abs(y) <= halfBed - 0.5;
      const inBranch = distanceToBranch(x, y) <= halfBed - 0.5;
      if (!inStraight && !inBranch) return null;
      const opacity = 0.15 + ((idx * 7) % 10) / 80;
      return <circle key={`standard-turnout-ballast-dot-${idx}`} cx={mm(x)} cy={mm(y)} r={idx % 3 === 0 ? '0.55' : '0.38'} fill="var(--standard-ballast-dot)" opacity={opacity} />;
    });
    const straightTieCount = Math.max(18, Math.floor(len / 5));
    const straightTies = Array.from({ length: straightTieCount }, (_, idx) => ((idx + 0.5) * len) / straightTieCount);
    const branchTieCount = Math.max(12, Math.floor(Math.hypot(ex, ey) / 6));
    const branchTies = Array.from({ length: branchTieCount }, (_, idx) => branchPoint((idx + 0.5) / branchTieCount));
    const throwbarX = len * 0.25;
    const frogX = len * 0.56;
    const frogY = ey * 0.23;
    const frogFill = 'var(--standard-turnout-metal)';

    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key={`${key}-roadbed`}>
        <path d={branch.center} fill="none" stroke="var(--standard-ballast-fill)" strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        {drawStraight && <>
          <rect x={0} y={mm(-halfBed)} width={mm(len)} height={mm(roadbedWidth)} fill="var(--standard-ballast-fill)" />
          <line x1={0} y1={mm(-halfBed + 0.48)} x2={mm(len)} y2={mm(-halfBed + 0.48)} stroke="var(--standard-ballast-edge)" strokeWidth="1.1" />
          <line x1={0} y1={mm(halfBed - 0.48)} x2={mm(len)} y2={mm(halfBed - 0.48)} stroke="var(--standard-ballast-edge)" strokeWidth="1.1" />
        </>}
        {dots}
      </g>}
      {(layer === 'rails' || layer === 'both') && <g key={`${key}-rails`}>
        {drawStraight && straightTies.map((x, idx) => (
          <g key={`standard-turnout-straight-tie-${idx}`}>
            <line x1={mm(x)} y1={mm(-10.5)} x2={mm(x)} y2={mm(10.5)} stroke="var(--standard-tie-fill)" strokeWidth={idx % 6 === 0 ? '2.1' : '1.7'} strokeLinecap="butt" />
            <line x1={mm(x - 0.7)} y1={mm(-10)} x2={mm(x - 0.7)} y2={mm(10)} stroke="var(--standard-tie-highlight)" strokeWidth="0.4" opacity="0.55" />
          </g>
        ))}
        {(drawStraight ? branchTies.slice(3) : branchTies).map((p, idx) => (
          <rect
            key={`standard-turnout-branch-tie-${idx}`}
            x={mm(-10.5)}
            y={mm(-0.85)}
            width={mm(21)}
            height={mm(idx % 6 === 0 ? 2.1 : 1.7)}
            transform={`translate(${mm(p.x)} ${mm(p.y)}) rotate(${p.angle})`}
            fill="var(--standard-tie-fill)"
          />
        ))}
        {drawStraight && straightRailsOnly(0, 0, len, 0, `${key}-straight`)}
        {turnoutBranchRailsOnly(ex, ey, len, `${key}-branch`)}
        <path d={`M ${mm(len * 0.08)} ${mm(-railOffset)} C ${mm(len * 0.24)} ${mm(-railOffset)} ${mm(len * 0.42)} ${mm(frogY - 2.5)} ${mm(len * 0.58)} ${mm(frogY)}`} fill="none" stroke={railStroke} strokeWidth="1.65" strokeLinecap={lineCap} />
        <path d={`M ${mm(len * 0.12)} ${mm(railOffset)} C ${mm(len * 0.3)} ${mm(railOffset)} ${mm(len * 0.44)} ${mm(frogY + 2.5)} ${mm(len * 0.6)} ${mm(frogY + 1.5)}`} fill="none" stroke={railStroke} strokeWidth="1.65" strokeLinecap={lineCap} />
        <rect x={mm(frogX - 5)} y={mm(frogY - 4)} width={mm(10)} height={mm(8)} fill={frogFill} stroke="var(--standard-fastener)" strokeWidth="0.9" />
        <circle cx={mm(frogX)} cy={mm(frogY)} r="1.6" fill="var(--standard-fastener)" opacity="0.75" />
        <rect x={mm(throwbarX - 8)} y={mm(railOffset + 3.2)} width={mm(16)} height={mm(2.2)} fill={frogFill} stroke="var(--standard-fastener)" strokeWidth="0.7" />
        <circle cx={mm(throwbarX - 10)} cy={mm(railOffset + 5.8)} r="2.2" fill="none" stroke="var(--standard-fastener)" strokeWidth="1" />
      </g>}
    </>;
  }

  function standardWyeTurnoutShape(ex: number, ey: number, len: number) {
    return <>
      {standardTurnoutShape(ex, -ey, len, 'wye-standard-left-detail', false)}
      {standardTurnoutShape(ex, ey, len, 'wye-standard-right-detail', false)}
    </>;
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

  function lowDetailSingleCurveShape(radius: number, angle: number, centerRadius = radius) {
    return <>
      {(layer === 'roadbed' || layer === 'both') && <path d={arcPath(centerRadius, angle, radius)} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />}
      {curveRails(radius, angle, centerRadius)}
    </>;
  }

  function standardSingleCurveShape(radius: number, angle: number, centerRadius = radius) {
    const halfBed = roadbedWidth / 2;
    const edgeStrokeWidth = 1.1;
    const edgeInset = (edgeStrokeWidth / 2) / PX_PER_MM;
    const dotInset = 0.55 / PX_PER_MM;
    const arcLength = Math.abs(degToRad(angle) * radius);
    const tieCount = Math.max(10, Math.round(arcLength / 5));
    const tieAngles = Array.from({ length: tieCount }, (_, idx) => (angle * (idx + 0.5)) / tieCount);
    const dotHalfSpan = Math.max(0, halfBed - dotInset);
    const dotCount = Math.max(50, Math.round((arcLength * roadbedWidth) / 80));
    const dots = Array.from({ length: dotCount }, (_, idx) => {
      const a = (angle * ((idx * 37) % dotCount)) / dotCount;
      const r = radius + ((((idx * 53) % Math.max(1, Math.round(dotHalfSpan * 20))) / 10) - dotHalfSpan);
      const p = arcPoint(centerRadius, Math.max(1, r), a);
      const opacity = 0.15 + ((idx * 7) % 10) / 80;
      return <circle key={`standard-curve-ballast-dot-${idx}`} cx={mm(p.x)} cy={mm(p.y)} r={idx % 3 === 0 ? '0.55' : '0.38'} fill="var(--standard-ballast-dot)" opacity={opacity} />;
    });

    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="standard-single-curve-roadbed">
        <path d={arcPath(centerRadius, angle, radius)} fill="none" stroke="var(--standard-ballast-fill)" strokeWidth={mm(roadbedWidth)} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, radius + halfBed - edgeInset)} fill="none" stroke="var(--standard-ballast-edge)" strokeWidth={edgeStrokeWidth} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, Math.max(1, radius - halfBed + edgeInset))} fill="none" stroke="var(--standard-ballast-edge)" strokeWidth={edgeStrokeWidth} strokeLinecap={lineCap} />
        {dots}
      </g>}
      {(layer === 'rails' || layer === 'both') && <g key="standard-single-curve-rails">
        {tieAngles.map((a, idx) => {
          const p = arcPoint(centerRadius, radius, a);
          const tieAngle = radToDeg(Math.atan2(p.ny, p.nx));
          const tieWidth = idx % 6 === 0 ? 2.1 : 1.7;
          const tieLength = 21;
          return <g key={`standard-curve-tie-${idx}`}>
            <rect
              x={mm(-tieLength / 2)}
              y={mm(-tieWidth / 2)}
              width={mm(tieLength)}
              height={mm(tieWidth)}
              transform={`translate(${mm(p.x)} ${mm(p.y)}) rotate(${tieAngle})`}
              fill="var(--standard-tie-fill)"
            />
            <line
              x1={mm(-tieLength / 2 + 0.5)}
              y1="0"
              x2={mm(tieLength / 2 - 0.5)}
              y2="0"
              transform={`translate(${mm(p.x)} ${mm(p.y)}) rotate(${tieAngle}) translate(0 -0.35)`}
              stroke="var(--standard-tie-highlight)"
              strokeWidth="0.4"
              opacity="0.55"
            />
          </g>;
        })}
        <path d={arcPath(centerRadius, angle, radius + railOffset)} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, Math.max(1, radius - railOffset))} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, radius + railOffset + 2.1)} fill="none" stroke="var(--standard-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.8" />
        <path d={arcPath(centerRadius, angle, Math.max(1, radius - railOffset - 2.1))} fill="none" stroke="var(--standard-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.8" />
      </g>}
    </>;
  }

  function doubleCurveShape(radius1: number, radius2: number, angle: number) {
    const centerRadius = (radius1 + radius2) / 2;
    const trackCenters = Math.abs(radius2 - radius1) || (part.trackCenters ?? 33);
    const fillWidth = doubleTrackCenterFillWidth(trackCenters);
    if (isConcreteTiePart && !isViaduct && !isBridge) return doubleConcreteTieCurveShape(radius1, radius2, angle);
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

  function lowDetailDoubleCurveShape(radius1: number, radius2: number, angle: number) {
    const centerRadius = (radius1 + radius2) / 2;
    const trackCenters = Math.abs(radius2 - radius1) || (part.trackCenters ?? 33);
    const fillWidth = doubleTrackCenterFillWidth(trackCenters);
    return <>
      {(layer === 'roadbed' || layer === 'both') && <>
        {fillWidth > 0 && <path d={arcPath(centerRadius, angle, centerRadius)} fill="none" stroke={roadbedStroke} strokeWidth={fillWidth} strokeLinecap={lineCap} />}
        <path d={arcPath(centerRadius, angle, radius1)} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, radius2)} fill="none" stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
      </>}
      {curveRails(radius1, angle, centerRadius, 'low-double-curve-track-1')}
      {curveRails(radius2, angle, centerRadius, 'low-double-curve-track-2')}
    </>;
  }

  function concreteTieCurveTrackDetails(centerRadius: number, radius: number, angle: number, key: string) {
    const tieSpacing = 33 / 7;
    const arcLength = Math.abs(degToRad(angle) * radius);
    const tieCount = Math.max(10, Math.round(arcLength / tieSpacing));
    const tieAngles = Array.from({ length: tieCount }, (_, idx) => (angle * (idx + 0.5)) / tieCount);
    return <g key={`${key}-details`}>
      {tieAngles.map((a, idx) => {
        const p = arcPoint(centerRadius, radius, a);
        const capEvery = idx % 6 === 0;
        const tieAngle = radToDeg(Math.atan2(p.ny, p.nx));
        const tieWidth = capEvery ? 2.5 : 2;
        const tieLength = 23;
        return <g key={`${key}-tie-${idx}`}>
          <rect
            x={mm(-tieLength / 2)}
            y={mm(-tieWidth / 2)}
            width={mm(tieLength)}
            height={mm(tieWidth)}
            transform={`translate(${mm(p.x)} ${mm(p.y)}) rotate(${tieAngle})`}
            fill="var(--concrete-tie-fill)"
            stroke="var(--concrete-tie-shadow)"
            strokeWidth="0.45"
          />
        </g>;
      })}
      <path d={arcPath(centerRadius, angle, radius + railOffset)} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <path d={arcPath(centerRadius, angle, Math.max(1, radius - railOffset))} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <path d={arcPath(centerRadius, angle, radius + railOffset + 2.1)} fill="none" stroke="var(--concrete-tie-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.75" />
      <path d={arcPath(centerRadius, angle, Math.max(1, radius - railOffset - 2.1))} fill="none" stroke="var(--concrete-tie-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.75" />
    </g>;
  }

  function concreteCurveBallastTexture(centerRadius: number, angle: number, halfWidth: number) {
    const dotCount = Math.max(80, Math.round(Math.abs(angle) * centerRadius / 18));
    return Array.from({ length: dotCount }, (_, idx) => {
      const a = (angle * ((idx * 37) % dotCount)) / dotCount;
      const r = centerRadius + ((((idx * 53) % Math.max(1, Math.round(halfWidth * 20))) / 10) - halfWidth);
      const p = arcPoint(centerRadius, Math.max(1, r), a);
      const opacity = 0.18 + ((idx * 7) % 10) / 70;
      return <circle key={`concrete-curve-ballast-dot-${idx}`} cx={mm(p.x)} cy={mm(p.y)} r={idx % 3 === 0 ? '0.55' : '0.38'} fill="var(--concrete-ballast-dot)" opacity={opacity} />;
    });
  }

  function doubleConcreteTieCurveShape(radius1: number, radius2: number, angle: number) {
    const centerRadius = (radius1 + radius2) / 2;
    const deckHalfWidth = concreteTieBedWidth / 2;
    const panelCount = Math.max(3, Math.round(Math.abs(angle) / 7.5));
    const panelAngles = Array.from({ length: panelCount - 1 }, (_, idx) => (angle * (idx + 1)) / panelCount);
    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="double-concrete-tie-curve-roadbed">
        <path d={arcPath(centerRadius, angle, centerRadius)} fill="none" stroke="var(--concrete-ballast-fill)" strokeWidth={mm(deckHalfWidth * 2)} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, centerRadius)} fill="none" stroke="var(--concrete-ballast-center)" strokeWidth={mm(7)} strokeLinecap={lineCap} opacity="0.45" />
        <path d={arcPath(centerRadius, angle, centerRadius + deckHalfWidth)} fill="none" stroke="var(--concrete-ballast-edge)" strokeWidth="1.2" strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, Math.max(1, centerRadius - deckHalfWidth))} fill="none" stroke="var(--concrete-ballast-edge)" strokeWidth="1.2" strokeLinecap={lineCap} />
        {concreteCurveBallastTexture(centerRadius, angle, deckHalfWidth)}
        {panelAngles.map((a, idx) => {
          const outer = arcPoint(centerRadius, centerRadius + deckHalfWidth, a);
          const inner = arcPoint(centerRadius, Math.max(1, centerRadius - deckHalfWidth), a);
          return <line key={`concrete-curve-panel-${idx}`} x1={mm(inner.x)} y1={mm(inner.y)} x2={mm(outer.x)} y2={mm(outer.y)} stroke="var(--concrete-ballast-panel)" strokeWidth="0.8" opacity="0.45" />;
        })}
      </g>}
      {(layer === 'rails' || layer === 'both') && <>
        {concreteTieCurveTrackDetails(centerRadius, radius1, angle, 'concrete-curve-track-1')}
        {concreteTieCurveTrackDetails(centerRadius, radius2, angle, 'concrete-curve-track-2')}
      </>}
    </>;
  }

  function arcPoint(centerRadius: number, radius: number, angle: number) {
    const theta = degToRad(angle);
    return {
      x: radius * Math.sin(theta),
      y: centerRadius - radius * Math.cos(theta),
      nx: Math.sin(theta),
      ny: -Math.cos(theta),
    };
  }

  function doubleSlabCurveShape(radius1: number, radius2: number, angle: number) {
    const centerRadius = (radius1 + radius2) / 2;
    const deckHalfWidth = slabDeckWidth / 2;
    const panelCount = Math.max(3, Math.round(Math.abs(angle) / 7.5));
    const tieCount = Math.max(10, Math.round(Math.abs(angle) * centerRadius / 65));
    const signedStep = angle / panelCount;
    const panelAngles = Array.from({ length: panelCount - 1 }, (_, idx) => signedStep * (idx + 1));
    const tieAngles = Array.from({ length: tieCount }, (_, idx) => (angle * (idx + 0.5)) / tieCount);
    const wallRibCount = Math.max(10, Math.round(Math.abs(angle) * centerRadius / 48));
    const wallRibAngles = Array.from({ length: wallRibCount - 1 }, (_, idx) => (angle * (idx + 1)) / wallRibCount);
    const trackDetailRadiusOffset = 10.5;
    const wallHeight = 10;

    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="double-slab-curve-roadbed">
        <path d={arcPath(centerRadius, angle, centerRadius)} fill="none" stroke="var(--slab-track-fill)" strokeWidth={deckHalfWidth * 2} strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, centerRadius)} fill="none" stroke="var(--slab-track-center-fill)" strokeWidth="16" strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, centerRadius + deckHalfWidth - 6)} fill="none" stroke="var(--slab-track-edge-fill)" strokeWidth="10" strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, Math.max(1, centerRadius - deckHalfWidth + 6))} fill="none" stroke="var(--slab-track-edge-fill)" strokeWidth="10" strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, centerRadius + deckHalfWidth)} fill="none" stroke="var(--slab-track-edge-stroke)" strokeWidth="1.8" strokeLinecap={lineCap} />
        <path d={arcPath(centerRadius, angle, Math.max(1, centerRadius - deckHalfWidth))} fill="none" stroke="var(--slab-track-edge-stroke)" strokeWidth="1.8" strokeLinecap={lineCap} />
        {isViaduct && <>
          <path d={arcPath(centerRadius, angle, centerRadius + deckHalfWidth + wallHeight / 2 - 1)} fill="none" stroke="var(--slab-viaduct-wall-fill)" strokeWidth={wallHeight} strokeLinecap={lineCap} />
          <path d={arcPath(centerRadius, angle, Math.max(1, centerRadius - deckHalfWidth - wallHeight / 2 + 1))} fill="none" stroke="var(--slab-viaduct-wall-fill)" strokeWidth={wallHeight} strokeLinecap={lineCap} />
          <path d={arcPath(centerRadius, angle, centerRadius + deckHalfWidth + wallHeight - 2)} fill="none" stroke="var(--slab-viaduct-wall-cap)" strokeWidth="2.4" strokeLinecap={lineCap} />
          <path d={arcPath(centerRadius, angle, Math.max(1, centerRadius - deckHalfWidth - wallHeight + 2))} fill="none" stroke="var(--slab-viaduct-wall-cap)" strokeWidth="2.4" strokeLinecap={lineCap} />
          {wallRibAngles.map((a, idx) => {
            const outerA = arcPoint(centerRadius, centerRadius + deckHalfWidth + 1, a);
            const outerB = arcPoint(centerRadius, centerRadius + deckHalfWidth + wallHeight - 1, a);
            const innerA = arcPoint(centerRadius, Math.max(1, centerRadius - deckHalfWidth - wallHeight + 1), a);
            const innerB = arcPoint(centerRadius, Math.max(1, centerRadius - deckHalfWidth - 1), a);
            return <g key={`slab-viaduct-curve-rib-${idx}`}>
              <line x1={mm(outerA.x)} y1={mm(outerA.y)} x2={mm(outerB.x)} y2={mm(outerB.y)} stroke="var(--slab-viaduct-wall-rib)" strokeWidth="0.8" opacity="0.65" />
              <line x1={mm(innerA.x)} y1={mm(innerA.y)} x2={mm(innerB.x)} y2={mm(innerB.y)} stroke="var(--slab-viaduct-wall-rib)" strokeWidth="0.8" opacity="0.65" />
            </g>;
          })}
        </>}
        {panelAngles.map((a, idx) => {
          const outer = arcPoint(centerRadius, centerRadius + deckHalfWidth, a);
          const inner = arcPoint(centerRadius, Math.max(1, centerRadius - deckHalfWidth), a);
          return <line key={`slab-curve-panel-${idx}`} x1={mm(inner.x)} y1={mm(inner.y)} x2={mm(outer.x)} y2={mm(outer.y)} stroke="var(--slab-track-panel-stroke)" strokeWidth="1.1" />;
        })}
        {panelAngles.map((a, idx) => (
          <g key={`slab-curve-bolt-${idx}`}>
            {[radius1, radius2].map((radius, trackIdx) => {
              const p = arcPoint(centerRadius, radius, a);
              return <circle key={trackIdx} cx={mm(p.x)} cy={mm(p.y)} r="3" fill="none" stroke="var(--slab-track-detail-stroke)" strokeWidth="1" />;
            })}
          </g>
        ))}
      </g>}
      {(layer === 'rails' || layer === 'both') && <g key="double-slab-curve-rails">
        {[radius1, radius2].map((radius, trackIdx) => (
          <g key={`slab-curve-track-${trackIdx}`}>
            <path d={arcPath(centerRadius, angle, radius + trackDetailRadiusOffset)} fill="none" stroke="var(--slab-track-detail-stroke)" strokeWidth="1.1" strokeLinecap={lineCap} />
            <path d={arcPath(centerRadius, angle, Math.max(1, radius - trackDetailRadiusOffset))} fill="none" stroke="var(--slab-track-detail-stroke)" strokeWidth="1.1" strokeLinecap={lineCap} />
            <path d={arcPath(centerRadius, angle, radius + railOffset)} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
            <path d={arcPath(centerRadius, angle, Math.max(1, radius - railOffset))} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
            {tieAngles.map((a, tieIdx) => {
              const p = arcPoint(centerRadius, radius, a);
              return (
                <line
                  key={`slab-curve-tie-${trackIdx}-${tieIdx}`}
                  x1={mm(p.x - p.nx * 8)}
                  y1={mm(p.y - p.ny * 8)}
                  x2={mm(p.x + p.nx * 8)}
                  y2={mm(p.y + p.ny * 8)}
                  stroke="var(--slab-track-tie-stroke)"
                  strokeWidth="1.05"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              );
            })}
          </g>
        ))}
      </g>}
    </>;
  }

  function doubleStraightShape(length: number, trackCenters = 33) {
    const halfCenter = trackCenters / 2;
    const fillWidth = doubleTrackCenterFillWidth(trackCenters);
    if (isConcreteTiePart && !isViaduct && !isBridge) return doubleConcreteTieStraightShape(length, trackCenters);
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

  function lowDetailDoubleStraightShape(length: number, trackCenters = 33) {
    const halfCenter = trackCenters / 2;
    const fillWidth = doubleTrackCenterFillWidth(trackCenters);
    return <>
      {(layer === 'roadbed' || layer === 'both') && <>
        {fillWidth > 0 && <line x1={0} y1={0} x2={mm(length)} y2={0} stroke={roadbedStroke} strokeWidth={fillWidth} strokeLinecap={lineCap} />}
        <line x1={0} y1={mm(-halfCenter)} x2={mm(length)} y2={mm(-halfCenter)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
        <line x1={0} y1={mm(halfCenter)} x2={mm(length)} y2={mm(halfCenter)} stroke={roadbedStroke} strokeWidth={roadbedWidth} strokeLinecap={lineCap} />
      </>}
      {railLine(0, -halfCenter, length, -halfCenter, 'low-double-straight-upper', false)}
      {railLine(0, halfCenter, length, halfCenter, 'low-double-straight-lower', false)}
    </>;
  }

  function concreteTieTrackDetails(length: number, centerY: number, key: string) {
    const tieCount = Math.max(10, Math.floor(length / 5));
    const ties = Array.from({ length: tieCount }, (_, idx) => {
      const x = ((idx + 0.5) * length) / tieCount;
      const capEvery = idx % 6 === 0;
      return (
        <g key={`${key}-tie-${idx}`}>
          <line x1={mm(x)} y1={mm(centerY - 11)} x2={mm(x)} y2={mm(centerY + 11)} stroke="var(--concrete-tie-fill)" strokeWidth={capEvery ? '2.1' : '1.7'} strokeLinecap="butt" />
          <line x1={mm(x - 0.7)} y1={mm(centerY - 10.5)} x2={mm(x - 0.7)} y2={mm(centerY + 10.5)} stroke="var(--concrete-tie-highlight)" strokeWidth="0.45" opacity="0.8" />
        </g>
      );
    });
    return <g key={`${key}-details`}>
      {ties}
      <line x1={0} y1={mm(centerY - railOffset)} x2={mm(length)} y2={mm(centerY - railOffset)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <line x1={0} y1={mm(centerY + railOffset)} x2={mm(length)} y2={mm(centerY + railOffset)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <line x1={0} y1={mm(centerY - railOffset - 2.1)} x2={mm(length)} y2={mm(centerY - railOffset - 2.1)} stroke="var(--concrete-tie-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.75" />
      <line x1={0} y1={mm(centerY + railOffset + 2.1)} x2={mm(length)} y2={mm(centerY + railOffset + 2.1)} stroke="var(--concrete-tie-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.75" />
    </g>;
  }

  function concreteBallastTexture(length: number, halfWidth: number) {
    const dotCount = Math.max(80, Math.floor(length * halfWidth / 18));
    return Array.from({ length: dotCount }, (_, idx) => {
      const x = ((idx * 37) % Math.max(1, Math.round(length * 10))) / 10;
      const y = ((((idx * 53) % Math.max(1, Math.round(halfWidth * 20))) / 10) - halfWidth);
      const opacity = 0.18 + ((idx * 7) % 10) / 70;
      return <circle key={`concrete-ballast-dot-${idx}`} cx={mm(x)} cy={mm(y)} r={idx % 3 === 0 ? '0.55' : '0.38'} fill="var(--concrete-ballast-dot)" opacity={opacity} />;
    });
  }

  function doubleConcreteTieStraightShape(length: number, trackCenters = 33) {
    const halfCenter = trackCenters / 2;
    const deckHalfHeight = concreteTieBedWidth / 2;
    const panelCount = Math.max(2, Math.round(length / 31));
    const panelLines = Array.from({ length: panelCount - 1 }, (_, idx) => ((idx + 1) * length) / panelCount);
    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="double-concrete-tie-roadbed">
        <rect x={0} y={mm(-deckHalfHeight)} width={mm(length)} height={mm(deckHalfHeight * 2)} fill="var(--concrete-ballast-fill)" stroke="var(--concrete-ballast-edge)" strokeWidth="1.2" />
        {concreteBallastTexture(length, deckHalfHeight)}
        <rect x={0} y={mm(-3.5)} width={mm(length)} height={mm(7)} fill="var(--concrete-ballast-center)" opacity="0.45" />
        {panelLines.map((x, idx) => (
          <line key={`concrete-ballast-panel-${idx}`} x1={mm(x)} y1={mm(-deckHalfHeight)} x2={mm(x)} y2={mm(deckHalfHeight)} stroke="var(--concrete-ballast-panel)" strokeWidth="0.8" opacity="0.45" />
        ))}
      </g>}
      {(layer === 'rails' || layer === 'both') && <>
        {concreteTieTrackDetails(length, -halfCenter, 'concrete-upper')}
        {concreteTieTrackDetails(length, halfCenter, 'concrete-lower')}
      </>}
    </>;
  }

  function slabTrackDetails(length: number, centerY: number, key: string) {
    const tieCount = Math.max(8, Math.floor(length / 8));
    const ties = Array.from({ length: tieCount }, (_, idx) => {
      const x = ((idx + 0.5) * length) / tieCount;
      return (
        <line
          key={`${key}-tie-${idx}`}
          x1={mm(x)}
          y1={mm(centerY - 8)}
          x2={mm(x)}
          y2={mm(centerY + 8)}
          stroke="var(--slab-track-tie-stroke)"
          strokeWidth="1.05"
          strokeLinecap="round"
          opacity="0.85"
        />
      );
    });
    return <g key={`${key}-details`}>
      <line x1={0} y1={mm(centerY - 10.5)} x2={mm(length)} y2={mm(centerY - 10.5)} stroke="var(--slab-track-detail-stroke)" strokeWidth="1.1" />
      <line x1={0} y1={mm(centerY + 10.5)} x2={mm(length)} y2={mm(centerY + 10.5)} stroke="var(--slab-track-detail-stroke)" strokeWidth="1.1" />
      <line x1={0} y1={mm(centerY - railOffset)} x2={mm(length)} y2={mm(centerY - railOffset)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      <line x1={0} y1={mm(centerY + railOffset)} x2={mm(length)} y2={mm(centerY + railOffset)} stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
      {ties}
    </g>;
  }

  function slabViaductStraightWalls(length: number, deckHalfHeight: number, panelCount: number) {
    const wallHeight = 10;
    const wallTopY = -deckHalfHeight - wallHeight + 1;
    const wallBottomY = deckHalfHeight - 1;
    const ribCount = Math.max(12, Math.floor(length / 4));
    const ribs = Array.from({ length: ribCount - 1 }, (_, idx) => ((idx + 1) * length) / ribCount);
    const brackets = Array.from({ length: panelCount + 1 }, (_, idx) => (idx * length) / panelCount);

    return <g key="slab-viaduct-walls">
      <rect x={0} y={mm(wallTopY)} width={mm(length)} height={mm(wallHeight)} fill="var(--slab-viaduct-wall-fill)" stroke="var(--slab-viaduct-wall-stroke)" strokeWidth="1" />
      <rect x={0} y={mm(wallBottomY)} width={mm(length)} height={mm(wallHeight)} fill="var(--slab-viaduct-wall-fill)" stroke="var(--slab-viaduct-wall-stroke)" strokeWidth="1" />
      <line x1={0} y1={mm(wallTopY + 1.2)} x2={mm(length)} y2={mm(wallTopY + 1.2)} stroke="var(--slab-viaduct-wall-cap)" strokeWidth="2.4" strokeLinecap={lineCap} />
      <line x1={0} y1={mm(wallBottomY + wallHeight - 1.2)} x2={mm(length)} y2={mm(wallBottomY + wallHeight - 1.2)} stroke="var(--slab-viaduct-wall-cap)" strokeWidth="2.4" strokeLinecap={lineCap} />
      <line x1={0} y1={mm(wallTopY + wallHeight - 1)} x2={mm(length)} y2={mm(wallTopY + wallHeight - 1)} stroke="var(--slab-track-shadow)" strokeWidth="1.2" opacity="0.75" />
      <line x1={0} y1={mm(wallBottomY + 1)} x2={mm(length)} y2={mm(wallBottomY + 1)} stroke="var(--slab-track-highlight)" strokeWidth="1.2" opacity="0.55" />
      {ribs.map((x, idx) => (
        <g key={`slab-viaduct-rib-${idx}`}>
          <line x1={mm(x)} y1={mm(wallTopY + 2)} x2={mm(x)} y2={mm(wallTopY + wallHeight - 2)} stroke="var(--slab-viaduct-wall-rib)" strokeWidth="0.8" opacity="0.65" />
          <line x1={mm(x)} y1={mm(wallBottomY + 2)} x2={mm(x)} y2={mm(wallBottomY + wallHeight - 2)} stroke="var(--slab-viaduct-wall-rib)" strokeWidth="0.8" opacity="0.65" />
        </g>
      ))}
      {brackets.map((x, idx) => (
        <g key={`slab-viaduct-bracket-${idx}`}>
          <rect x={mm(x - 0.75)} y={mm(wallTopY - 1)} width={mm(1.5)} height={mm(3)} fill="var(--slab-viaduct-bracket-fill)" stroke="var(--slab-viaduct-wall-stroke)" strokeWidth="0.5" />
          <rect x={mm(x - 0.75)} y={mm(wallBottomY + wallHeight - 2)} width={mm(1.5)} height={mm(3)} fill="var(--slab-viaduct-bracket-fill)" stroke="var(--slab-viaduct-wall-stroke)" strokeWidth="0.5" />
        </g>
      ))}
    </g>;
  }

  function doubleSlabStraightShape(length: number, trackCenters = 33) {
    const halfCenter = trackCenters / 2;
    const deckHalfHeight = slabDeckWidth / 2;
    const panelCount = Math.max(2, Math.round(length / 31));
    const panelLines = Array.from({ length: panelCount - 1 }, (_, idx) => {
      const x = ((idx + 1) * length) / panelCount;
      return <line key={`slab-panel-${idx}`} x1={mm(x)} y1={mm(-deckHalfHeight)} x2={mm(x)} y2={mm(deckHalfHeight)} stroke="var(--slab-track-panel-stroke)" strokeWidth="1.1" />;
    });
    const boltCenters = Array.from({ length: panelCount - 1 }, (_, idx) => ((idx + 1) * length) / panelCount);

    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="double-slab-roadbed">
        <rect x={0} y={mm(-deckHalfHeight)} width={mm(length)} height={mm(deckHalfHeight * 2)} fill="var(--slab-track-fill)" stroke="var(--slab-track-edge-stroke)" strokeWidth="1.8" />
        {!isViaduct && <>
          <rect x={0} y={mm(-deckHalfHeight + 5)} width={mm(length)} height={mm(10)} fill="var(--slab-track-edge-fill)" stroke="var(--slab-track-panel-stroke)" strokeWidth="0.8" />
          <rect x={0} y={mm(deckHalfHeight - 15)} width={mm(length)} height={mm(10)} fill="var(--slab-track-edge-fill)" stroke="var(--slab-track-panel-stroke)" strokeWidth="0.8" />
        </>}
        <rect x={0} y={mm(-8)} width={mm(length)} height={mm(16)} fill="var(--slab-track-center-fill)" stroke="var(--slab-track-panel-stroke)" strokeWidth="0.8" />
        <line x1={0} y1={mm(-deckHalfHeight + 3)} x2={mm(length)} y2={mm(-deckHalfHeight + 3)} stroke="var(--slab-track-highlight)" strokeWidth="1" opacity="0.7" />
        <line x1={0} y1={mm(deckHalfHeight - 3)} x2={mm(length)} y2={mm(deckHalfHeight - 3)} stroke="var(--slab-track-shadow)" strokeWidth="1" opacity="0.7" />
        {panelLines}
        {boltCenters.map((x, idx) => (
          <g key={`slab-bolt-${idx}`}>
            <circle cx={mm(x)} cy={mm(-halfCenter)} r="3" fill="none" stroke="var(--slab-track-detail-stroke)" strokeWidth="1" />
            <circle cx={mm(x)} cy={mm(halfCenter)} r="3" fill="none" stroke="var(--slab-track-detail-stroke)" strokeWidth="1" />
          </g>
        ))}
        {isViaduct && slabViaductStraightWalls(length, deckHalfHeight, panelCount)}
      </g>}
      {(layer === 'rails' || layer === 'both') && <>
        {slabTrackDetails(length, -halfCenter, 'slab-upper')}
        {slabTrackDetails(length, halfCenter, 'slab-lower')}
      </>}
    </>;
  }

  function doubleWideningShape(length: number, mirror = false) {
    const leftHalfCenter = 16.5;
    const lowerY = leftHalfCenter;
    const wideUpperY = lowerY - 66;
    const upperStartY = mirror ? wideUpperY : -leftHalfCenter;
    const upperEndY = mirror ? -leftHalfCenter : wideUpperY;
    const centerC1X = length * 0.36;
    const centerC2X = length * 0.64;
    const halfBed = roadbedWidth / 2;
    const topEdgeStartY = Math.min(upperStartY, lowerY) - halfBed;
    const topEdgeEndY = Math.min(upperEndY, lowerY) - halfBed;
    const bottomEdgeStartY = Math.max(upperStartY, lowerY) + halfBed;
    const bottomEdgeEndY = Math.max(upperEndY, lowerY) + halfBed;
    const ballastPath = [
      `M 0 ${mm(topEdgeStartY)}`,
      `C ${mm(centerC1X)} ${mm(topEdgeStartY)} ${mm(centerC2X)} ${mm(topEdgeEndY)} ${mm(length)} ${mm(topEdgeEndY)}`,
      `L ${mm(length)} ${mm(bottomEdgeEndY)}`,
      `C ${mm(centerC2X)} ${mm(bottomEdgeEndY)} ${mm(centerC1X)} ${mm(bottomEdgeStartY)} 0 ${mm(bottomEdgeStartY)}`,
      'Z',
    ].join(' ');
    const upperCenterPath = `M 0 ${mm(upperStartY)} C ${mm(centerC1X)} ${mm(upperStartY)} ${mm(centerC2X)} ${mm(upperEndY)} ${mm(length)} ${mm(upperEndY)}`;
    const upperTrackArcLength = Math.hypot(length, upperEndY - upperStartY) * 1.08;
    const upperTieCount = Math.max(10, Math.round(upperTrackArcLength / (33 / 7)));
    const upperTieSamples = Array.from({ length: upperTieCount }, (_, idx) => (idx + 0.5) / upperTieCount);
    const panelCount = Math.max(2, Math.round(length / 31));
    const panelSamples = Array.from({ length: panelCount - 1 }, (_, idx) => (idx + 1) / panelCount);
    const dx = length;
    const dy = upperEndY - upperStartY;
    const chordLen = Math.hypot(dx, dy) || 1;
    const ox = (-dy / chordLen) * railOffset;
    const oy = (dx / chordLen) * railOffset;
    const upperPlus = `M ${mm(ox)} ${mm(upperStartY + oy)} C ${mm(centerC1X + ox)} ${mm(upperStartY + oy)} ${mm(centerC2X + ox)} ${mm(upperEndY + oy)} ${mm(length + ox)} ${mm(upperEndY + oy)}`;
    const upperMinus = `M ${mm(-ox)} ${mm(upperStartY - oy)} C ${mm(centerC1X - ox)} ${mm(upperStartY - oy)} ${mm(centerC2X - ox)} ${mm(upperEndY - oy)} ${mm(length - ox)} ${mm(upperEndY - oy)}`;
    const sPoint = (t: number) => {
      const x = length * t;
      const smooth = t * t * (3 - 2 * t);
      const y = upperStartY + (upperEndY - upperStartY) * smooth;
      const slope = (upperEndY - upperStartY) * 6 * t * (1 - t) / Math.max(1, length);
      const tangentAngle = Math.atan2(slope, 1);
      return { x, y, tieAngle: radToDeg(tangentAngle) + 90 };
    };
    return <>
      {(layer === 'roadbed' || layer === 'both') && <>
        <path d={ballastPath} fill="var(--concrete-ballast-fill)" stroke="var(--concrete-ballast-edge)" strokeWidth="1.2" />
        {concreteBallastTexture(length, Math.max(Math.abs(topEdgeStartY), Math.abs(bottomEdgeEndY)))}
        <path d={upperCenterPath} fill="none" stroke="var(--concrete-ballast-center)" strokeWidth={mm(7)} strokeLinecap={lineCap} opacity="0.38" />
        <line x1={0} y1={mm(lowerY)} x2={mm(length)} y2={mm(lowerY)} stroke="var(--concrete-ballast-center)" strokeWidth={mm(7)} strokeLinecap={lineCap} opacity="0.38" />
        {panelSamples.map((t, idx) => {
          const top = sPoint(t);
          const bottomY = lowerY + halfBed;
          return <line key={`double-widening-panel-${idx}`} x1={mm(top.x)} y1={mm(topEdgeStartY + (topEdgeEndY - topEdgeStartY) * t)} x2={mm(top.x)} y2={mm(bottomY)} stroke="var(--concrete-ballast-panel)" strokeWidth="0.8" opacity="0.42" />;
        })}
      </>}
      {(layer === 'rails' || layer === 'both') && <>
        <g key="double-widening-upper-ties">
          {upperTieSamples.map((t, idx) => {
            const p = sPoint(t);
            const tieWidth = idx % 6 === 0 ? 2.5 : 2;
            const tieLength = 23;
            return <rect
              key={`double-widening-upper-tie-${idx}`}
              x={mm(-tieLength / 2)}
              y={mm(-tieWidth / 2)}
              width={mm(tieLength)}
              height={mm(tieWidth)}
              transform={`translate(${mm(p.x)} ${mm(p.y)}) rotate(${p.tieAngle})`}
              fill="var(--concrete-tie-fill)"
              stroke="var(--concrete-tie-shadow)"
              strokeWidth="0.45"
            />;
          })}
        </g>
        <g key="double-widening-upper-rails">
          <path d={upperPlus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
          <path d={upperMinus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
          <path d={`M ${mm(ox * 1.45)} ${mm(upperStartY + oy * 1.45)} C ${mm(centerC1X + ox * 1.45)} ${mm(upperStartY + oy * 1.45)} ${mm(centerC2X + ox * 1.45)} ${mm(upperEndY + oy * 1.45)} ${mm(length + ox * 1.45)} ${mm(upperEndY + oy * 1.45)}`} fill="none" stroke="var(--concrete-tie-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.75" />
          <path d={`M ${mm(-ox * 1.45)} ${mm(upperStartY - oy * 1.45)} C ${mm(centerC1X - ox * 1.45)} ${mm(upperStartY - oy * 1.45)} ${mm(centerC2X - ox * 1.45)} ${mm(upperEndY - oy * 1.45)} ${mm(length - ox * 1.45)} ${mm(upperEndY - oy * 1.45)}`} fill="none" stroke="var(--concrete-tie-fastener)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.75" />
        </g>
        {concreteTieTrackDetails(length, lowerY, 'double-widening-lower')}
        <path d={`M ${mm(length * 0.08)} ${mm(lowerY - 21)} C ${mm(length * 0.28)} ${mm(lowerY - 12)} ${mm(length * 0.56)} ${mm(lowerY - 15)} ${mm(length * 0.78)} ${mm(lowerY - 18)} S ${mm(length * 0.93)} ${mm(lowerY - 17)} ${mm(length * 0.96)} ${mm(lowerY - 8)}`} fill="none" stroke="var(--concrete-tie-cable)" strokeWidth="1.7" strokeLinecap="round" opacity="0.8" />
      </>}
    </>;
  }

  function lowDetailDoubleWideningShape(length: number, mirror = false) {
    const leftHalfCenter = 16.5;
    const lowerY = leftHalfCenter;
    const wideUpperY = lowerY - 66;
    const upperStartY = mirror ? wideUpperY : -leftHalfCenter;
    const upperEndY = mirror ? -leftHalfCenter : wideUpperY;
    const centerC1X = length * 0.36;
    const centerC2X = length * 0.64;
    const halfBed = roadbedWidth / 2;
    const topEdgeStartY = Math.min(upperStartY, lowerY) - halfBed;
    const topEdgeEndY = Math.min(upperEndY, lowerY) - halfBed;
    const bottomEdgeStartY = Math.max(upperStartY, lowerY) + halfBed;
    const bottomEdgeEndY = Math.max(upperEndY, lowerY) + halfBed;
    const ballastPath = [
      `M 0 ${mm(topEdgeStartY)}`,
      `C ${mm(centerC1X)} ${mm(topEdgeStartY)} ${mm(centerC2X)} ${mm(topEdgeEndY)} ${mm(length)} ${mm(topEdgeEndY)}`,
      `L ${mm(length)} ${mm(bottomEdgeEndY)}`,
      `C ${mm(centerC2X)} ${mm(bottomEdgeEndY)} ${mm(centerC1X)} ${mm(bottomEdgeStartY)} 0 ${mm(bottomEdgeStartY)}`,
      'Z',
    ].join(' ');
    const dx = length;
    const dy = upperEndY - upperStartY;
    const chordLen = Math.hypot(dx, dy) || 1;
    const ox = (-dy / chordLen) * railOffset;
    const oy = (dx / chordLen) * railOffset;
    const upperPlus = `M ${mm(ox)} ${mm(upperStartY + oy)} C ${mm(centerC1X + ox)} ${mm(upperStartY + oy)} ${mm(centerC2X + ox)} ${mm(upperEndY + oy)} ${mm(length + ox)} ${mm(upperEndY + oy)}`;
    const upperMinus = `M ${mm(-ox)} ${mm(upperStartY - oy)} C ${mm(centerC1X - ox)} ${mm(upperStartY - oy)} ${mm(centerC2X - ox)} ${mm(upperEndY - oy)} ${mm(length - ox)} ${mm(upperEndY - oy)}`;

    return <>
      {(layer === 'roadbed' || layer === 'both') && <path d={ballastPath} fill={roadbedStroke} stroke={roadbedStroke} strokeWidth="1" />}
      {(layer === 'rails' || layer === 'both') && <>
        <path d={upperPlus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        <path d={upperMinus} fill="none" stroke={railStroke} strokeWidth={railWidth} strokeLinecap={lineCap} />
        {straightRailsOnly(0, lowerY, length, lowerY, 'low-double-widening-lower')}
      </>}
    </>;
  }

  function doubleTrussBridgeShape(length: number, trackCenters = 33) {
    const halfCenter = trackCenters / 2;
    const bridgeHalfWidth = 29;
    const portalWidth = 17;
    const chordWidth = 6;
    const panelCount = Math.max(4, Math.round(length / 62));
    const panelStart = portalWidth;
    const panelEnd = Math.max(panelStart, length - portalWidth);
    const panelLength = (panelEnd - panelStart) / panelCount;
    const bridgeFill = part.color || 'var(--double-truss-bridge-fill)';
    const bridgeStroke = 'var(--double-truss-bridge-stroke)';
    const bridgeShadow = 'var(--double-truss-bridge-shadow)';
    const blackDeck = 'var(--double-truss-bridge-deck)';
    const detailStroke = 'var(--double-truss-bridge-detail)';
    const panelLines = Array.from({ length: panelCount - 1 }, (_, idx) => panelStart + panelLength * (idx + 1));
    const tieCount = Math.max(18, Math.floor(length / 5.5));
    const ties = Array.from({ length: tieCount }, (_, idx) => ((idx + 0.5) * length) / tieCount);
    const bridgeWallRibCount = Math.max(10, Math.floor(length / 8));
    const bridgeWallRibs = Array.from({ length: bridgeWallRibCount - 1 }, (_, idx) => ((idx + 1) * length) / bridgeWallRibCount);

    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="double-truss-bridge-roadbed">
        <rect x={0} y={mm(-bridgeHalfWidth)} width={mm(length)} height={mm(bridgeHalfWidth * 2)} fill="var(--double-truss-bridge-bg)" stroke={bridgeStroke} strokeWidth="1.6" />
        <rect x={0} y={mm(-bridgeHalfWidth)} width={mm(length)} height={mm(chordWidth)} fill={bridgeFill} stroke={bridgeStroke} strokeWidth="0.9" />
        <rect x={0} y={mm(bridgeHalfWidth - chordWidth)} width={mm(length)} height={mm(chordWidth)} fill={bridgeFill} stroke={bridgeStroke} strokeWidth="0.9" />
        <rect x={0} y={mm(-bridgeHalfWidth)} width={mm(portalWidth)} height={mm(bridgeHalfWidth * 2)} fill={bridgeFill} stroke={bridgeStroke} strokeWidth="1.2" />
        <rect x={mm(length - portalWidth)} y={mm(-bridgeHalfWidth)} width={mm(portalWidth)} height={mm(bridgeHalfWidth * 2)} fill={bridgeFill} stroke={bridgeStroke} strokeWidth="1.2" />
        <rect x={mm(panelStart)} y={mm(-bridgeHalfWidth + chordWidth)} width={mm(panelEnd - panelStart)} height={mm(bridgeHalfWidth * 2 - chordWidth * 2)} fill="none" stroke={bridgeFill} strokeWidth="5.2" />
        {[panelStart, ...panelLines, panelEnd].map((x, idx) => (
          <line key={`double-truss-post-${idx}`} x1={mm(x)} y1={mm(-bridgeHalfWidth + chordWidth)} x2={mm(x)} y2={mm(bridgeHalfWidth - chordWidth)} stroke={bridgeFill} strokeWidth="4.6" strokeLinecap="butt" />
        ))}
        {Array.from({ length: panelCount }, (_, idx) => {
          const x1 = panelStart + panelLength * idx;
          const x2 = x1 + panelLength;
          return <g key={`double-truss-x-${idx}`}>
            <line x1={mm(x1)} y1={mm(-bridgeHalfWidth + chordWidth)} x2={mm(x2)} y2={mm(bridgeHalfWidth - chordWidth)} stroke={bridgeFill} strokeWidth="4.5" strokeLinecap="round" />
            <line x1={mm(x1)} y1={mm(bridgeHalfWidth - chordWidth)} x2={mm(x2)} y2={mm(-bridgeHalfWidth + chordWidth)} stroke={bridgeFill} strokeWidth="4.5" strokeLinecap="round" />
          </g>;
        })}
        {[-halfCenter, halfCenter].map((centerY, trackIdx) => (
          <g key={`double-truss-track-bed-${trackIdx}`}>
            <rect x={0} y={mm(centerY - 8.5)} width={mm(length)} height={mm(17)} fill={blackDeck} opacity="0.92" />
            {ties.map((x, idx) => (
              <line key={`double-truss-tie-${trackIdx}-${idx}`} x1={mm(x)} y1={mm(centerY - 10)} x2={mm(x)} y2={mm(centerY + 10)} stroke={bridgeShadow} strokeWidth="1.4" opacity="0.85" />
            ))}
          </g>
        ))}
        {bridgeWallRibs.map((x, idx) => (
          <g key={`double-truss-wall-rib-${idx}`}>
            <line x1={mm(x)} y1={mm(-bridgeHalfWidth + 2)} x2={mm(x)} y2={mm(-bridgeHalfWidth + chordWidth - 1)} stroke={detailStroke} strokeWidth="0.8" opacity="0.7" />
            <line x1={mm(x)} y1={mm(bridgeHalfWidth - chordWidth + 1)} x2={mm(x)} y2={mm(bridgeHalfWidth - 2)} stroke={detailStroke} strokeWidth="0.8" opacity="0.7" />
          </g>
        ))}
        {[0, length].map((x, idx) => (
          <g key={`double-truss-portal-detail-${idx}`}>
            <rect x={mm(x + (idx === 0 ? 3 : -9))} y={mm(-halfCenter - 8)} width={mm(6)} height={mm(16)} fill="none" stroke={bridgeStroke} strokeWidth="1" />
            <rect x={mm(x + (idx === 0 ? 3 : -9))} y={mm(halfCenter - 8)} width={mm(6)} height={mm(16)} fill="none" stroke={bridgeStroke} strokeWidth="1" />
          </g>
        ))}
      </g>}
      {(layer === 'rails' || layer === 'both') && <>
        {railLine(0, -halfCenter, length, -halfCenter, 'double-truss-upper', false)}
        {railLine(0, halfCenter, length, halfCenter, 'double-truss-lower', false)}
      </>}
    </>;
  }

  function doublePlateGirderBridgeShape(length: number, trackCenters = 33) {
    const halfCenter = trackCenters / 2;
    const bridgeHalfWidth = 29;
    const girderWidth = 8;
    const bridgeFill = part.color || 'var(--double-plate-bridge-fill)';
    const bridgeStroke = 'var(--double-plate-bridge-stroke)';
    const bridgeShadow = 'var(--double-plate-bridge-shadow)';
    const deckFill = 'var(--double-plate-bridge-deck)';
    const tieStroke = 'var(--double-plate-bridge-tie)';
    const detailStroke = 'var(--double-plate-bridge-detail)';
    const tieCount = Math.max(22, Math.floor(length / 4.2));
    const ties = Array.from({ length: tieCount }, (_, idx) => ((idx + 0.5) * length) / tieCount);
    const panelCount = Math.max(4, Math.round(length / 31));
    const panelLines = Array.from({ length: panelCount - 1 }, (_, idx) => ((idx + 1) * length) / panelCount);
    const ribCount = Math.max(18, Math.floor(length / 4));
    const girderRibs = Array.from({ length: ribCount - 1 }, (_, idx) => ((idx + 1) * length) / ribCount);

    return <>
      {(layer === 'roadbed' || layer === 'both') && <g key="double-plate-bridge-roadbed">
        <rect x={0} y={mm(-bridgeHalfWidth)} width={mm(length)} height={mm(bridgeHalfWidth * 2)} fill="var(--double-plate-bridge-bg)" stroke={bridgeStroke} strokeWidth="1.4" />
        <rect x={0} y={mm(-bridgeHalfWidth)} width={mm(length)} height={mm(girderWidth)} fill={bridgeFill} stroke={bridgeStroke} strokeWidth="1" />
        <rect x={0} y={mm(bridgeHalfWidth - girderWidth)} width={mm(length)} height={mm(girderWidth)} fill={bridgeFill} stroke={bridgeStroke} strokeWidth="1" />
        <rect x={0} y={mm(-5.5)} width={mm(length)} height={mm(11)} fill={bridgeFill} stroke={bridgeStroke} strokeWidth="0.8" opacity="0.92" />
        <line x1={0} y1={mm(-bridgeHalfWidth + 2)} x2={mm(length)} y2={mm(-bridgeHalfWidth + 2)} stroke="var(--double-plate-bridge-highlight)" strokeWidth="1" opacity="0.7" />
        <line x1={0} y1={mm(bridgeHalfWidth - 2)} x2={mm(length)} y2={mm(bridgeHalfWidth - 2)} stroke={bridgeShadow} strokeWidth="1" opacity="0.55" />
        {panelLines.map((x, idx) => (
          <line key={`double-plate-panel-${idx}`} x1={mm(x)} y1={mm(-bridgeHalfWidth)} x2={mm(x)} y2={mm(bridgeHalfWidth)} stroke={detailStroke} strokeWidth="0.9" opacity="0.6" />
        ))}
        {girderRibs.map((x, idx) => (
          <g key={`double-plate-rib-${idx}`}>
            <line x1={mm(x)} y1={mm(-bridgeHalfWidth + 1.5)} x2={mm(x)} y2={mm(-bridgeHalfWidth + girderWidth - 1.5)} stroke={detailStroke} strokeWidth="0.65" opacity="0.65" />
            <line x1={mm(x)} y1={mm(bridgeHalfWidth - girderWidth + 1.5)} x2={mm(x)} y2={mm(bridgeHalfWidth - 1.5)} stroke={detailStroke} strokeWidth="0.65" opacity="0.65" />
          </g>
        ))}
        {[-halfCenter, halfCenter].map((centerY, trackIdx) => (
          <g key={`double-plate-track-bed-${trackIdx}`}>
            <rect x={0} y={mm(centerY - 9.5)} width={mm(length)} height={mm(19)} fill={deckFill} opacity="0.94" />
            {ties.map((x, idx) => (
              <line key={`double-plate-tie-${trackIdx}-${idx}`} x1={mm(x)} y1={mm(centerY - 11)} x2={mm(x)} y2={mm(centerY + 11)} stroke={tieStroke} strokeWidth="1.5" opacity="0.9" />
            ))}
          </g>
        ))}
      </g>}
      {(layer === 'rails' || layer === 'both') && <>
        {railLine(0, -halfCenter, length, -halfCenter, 'double-plate-upper', false)}
        {railLine(0, halfCenter, length, halfCenter, 'double-plate-lower', false)}
      </>}
    </>;
  }

  function bridgeStraightShape(length: number) {
    // Top-down bridge renderer. The truss style is drawn like the KATO
    // single-track truss bridge: compact rectangular frame, side chords,
    // repeated posts, and X bracing. Overall width is close to the viaduct.
    if (bridgeStyle === 'truss' && isDouble) return doubleTrussBridgeShape(length, part.trackCenters ?? 33);
    if (bridgeStyle === 'plate-girder' && isDouble) return doublePlateGirderBridgeShape(length, part.trackCenters ?? 33);

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
      shape = useLowDetail
        ? lowDetailDoubleCurveShape(part.radius ?? 0, part.radius2, part.angle ?? 0)
        : rendererFamily === 'double-slab-track'
        ? doubleSlabCurveShape(part.radius ?? 0, part.radius2, part.angle ?? 0)
        : doubleCurveShape(part.radius ?? 0, part.radius2, part.angle ?? 0);
    } else if (useLowDetail) {
      shape = lowDetailSingleCurveShape(part.radius ?? 0, part.angle ?? 0);
    } else if (rendererFamily === 'standard-track' && !isConcreteTiePart) {
      shape = standardSingleCurveShape(part.radius ?? 0, part.angle ?? 0);
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
      shape = !useLowDetail && part.sku === '20-222'
        ? standardWyeTurnoutShape(ex, ey, len)
        : <>
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
      shape = !useLowDetail && ['20-202', '20-203', '20-220', '20-221'].includes(part.sku)
        ? standardTurnoutShape(ex, ey, len, 'turnout-standard-detail')
        : <>
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
          {!useLowDetail && viaductDoubleStraightWalls(len, part.trackCenters ?? 33, 'crossing-double')}
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
      ? (useLowDetail && isDouble ? lowDetailDoubleStraightShape(effectiveLength, part.trackCenters ?? 33) : useLowDetail ? lowDetailRailLine(0, 0, effectiveLength, 0, 'low-bridge-straight') : bridgeStraightShape(effectiveLength))
      : rendererFamily === 'bumper'
        ? (useLowDetail ? lowDetailRailLine(0, 0, effectiveLength, 0, 'low-bumper-straight') : bumperStopShape(effectiveLength))
        : part.id === 'double-widening-left-310' || part.id === 'double-widening-right-310'
          ? (useLowDetail ? lowDetailDoubleWideningShape(effectiveLength, part.id === 'double-widening-right-310') : doubleWideningShape(effectiveLength, part.id === 'double-widening-right-310'))
          : rendererFamily === 'double-slab-track'
            ? (useLowDetail ? lowDetailDoubleStraightShape(effectiveLength, part.trackCenters ?? 33) : doubleSlabStraightShape(effectiveLength, part.trackCenters ?? 33))
          : rendererFamily === 'double-track' || rendererFamily === 'double-viaduct'
            ? (useLowDetail ? lowDetailDoubleStraightShape(effectiveLength, part.trackCenters ?? 33) : doubleStraightShape(effectiveLength, part.trackCenters ?? 33))
          : rendererFamily === 'standard-track' && part.kind === 'straight' && !isConcreteTiePart
            ? (useLowDetail ? lowDetailRailLine(0, 0, effectiveLength, 0, 'low-standard-straight') : standardSingleTrackShape(effectiveLength))
          : useLowDetail
            ? lowDetailRailLine(0, 0, effectiveLength, 0, 'low-straight')
          : railLine(0, 0, effectiveLength, 0, 'straight');
  }

  return <g transform={transform} onPointerDown={onPointerDown} className={className} opacity={opacity}>{shape}</g>;
}
