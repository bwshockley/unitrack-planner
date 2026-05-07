import { TrackPart } from './unitrack';

export type Pose = { x: number; y: number; heading: number; key?: string; label?: string; nodeKind?: 'track' | 'platform'; partSku?: string; compatibilityTag?: string; compatibleTags?: string[] };
export type NodeHeights = Record<string, number>;
export type PlacedTrack = { uid: string; partId: string; x: number; y: number; rotation: number; flip?: boolean; layerId?: string; customLength?: number; nodeHeights?: NodeHeights; shapeWidth?: number; shapeHeight?: number; shapeSide?: number; shapeDiameter?: number; shapeColor?: string; buildingSvg?: string };
export function nodeHeight(item: Pick<PlacedTrack, 'nodeHeights'>, key?: string) { return item.nodeHeights?.[key ?? ''] ?? 0; }
export const degToRad = (d: number) => (d * Math.PI) / 180;
export const radToDeg = (r: number) => (r * 180) / Math.PI;
export const snap = (v: number, grid: number) => Math.round(v / grid) * grid;
export const norm = (d: number) => ((d % 360) + 360) % 360;
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function partLength(part: TrackPart, placed?: Pick<PlacedTrack, 'customLength'>) {
  const base = placed?.customLength ?? part.length ?? part.maxLength ?? part.minLength ?? 0;
  return part.minLength !== undefined && part.maxLength !== undefined ? clamp(base, part.minLength, part.maxLength) : base;
}
export function isExpansionTrack(part: TrackPart) {
  return part.kind === 'straight' && part.minLength !== undefined && part.maxLength !== undefined;
}

export function transformLocalPose(port: Pose, placed: Pick<PlacedTrack, 'x' | 'y' | 'rotation' | 'flip'>): Pose {
  const flip = placed.flip ? -1 : 1;
  const localX = port.x;
  const localY = port.y * flip;
  const localHeading = port.heading * flip;
  const r = degToRad(placed.rotation);
  return {
    ...port,
    x: placed.x + localX * Math.cos(r) - localY * Math.sin(r),
    y: placed.y + localX * Math.sin(r) + localY * Math.cos(r),
    heading: norm(localHeading + placed.rotation),
  };
}

export function isDoubleTrack(part: TrackPart) {
  return part.secondaryKinds?.includes('Double') ?? false;
}

export function localConnectors(part: TrackPart, flip = false, placed?: Pick<PlacedTrack, 'customLength'>): Pose[] {
  if (part.connectionNodes) {
    return part.connectionNodes;
  }

  if (part.kind === 'building') {
    return part.connectionNodes ?? [];
  }

  if (part.kind === 'shape') {
    return [];
  }

  if (part.kind === 'straight') {
    const len = partLength(part, placed);
    if (isDoubleTrack(part)) {
      const halfCenter = (part.trackCenters ?? 33) / 2;
      return [
        { key: 'upper-left', label: 'Upper left', x: 0, y: -halfCenter, heading: 0 },
        { key: 'upper-right', label: 'Upper right', x: len, y: -halfCenter, heading: 180 },
        { key: 'lower-left', label: 'Lower left', x: 0, y: halfCenter, heading: 0 },
        { key: 'lower-right', label: 'Lower right', x: len, y: halfCenter, heading: 180 },
      ];
    }
    if (part.isTerminal) {
      return [{ key: 'a', label: 'Open connection', x: 0, y: 0, heading: 0 }];
    }
    return [
      { key: 'a', label: 'A', x: 0, y: 0, heading: 0 },
      { key: 'b', label: 'B', x: len, y: 0, heading: 180 },
    ];
  }

  if (part.kind === 'curve') {
    const r1 = part.radius ?? 0;
    const r2 = part.radius2;
    const signedAngle = (part.angle ?? 0) * (flip ? -1 : 1);

    if (isDoubleTrack(part) && r2) {
      const concreteDoubleCurveSkus = ['20-181', '20-183', '20-185', '20-187', '20-544'];
      const concreteDoubleTransitionSkus = ['20-182', '20-184', '20-186', '20-188', '20-545'];
      const coreTag = 'concrete-double-curve-core';
      const transitionTag = 'concrete-double-curve-transition';
      const compatibilityForPort = (key: string): Pick<Pose, 'compatibilityTag' | 'compatibleTags'> => {
        if (concreteDoubleCurveSkus.includes(part.sku)) return { compatibilityTag: coreTag, compatibleTags: [coreTag, transitionTag] };
        const transitionBaseSku = part.sku.slice(0, -1);
        if (concreteDoubleTransitionSkus.includes(transitionBaseSku) && part.sku.endsWith('L') && key.endsWith('-b')) return { compatibilityTag: transitionTag, compatibleTags: [coreTag, transitionTag] };
        if (concreteDoubleTransitionSkus.includes(transitionBaseSku) && part.sku.endsWith('R') && key.endsWith('-a')) return { compatibilityTag: transitionTag, compatibleTags: [coreTag, transitionTag] };
        return {};
      };
      const centerRadius = (r1 + r2) / 2;
      const portsForRadius = (radius: number, prefix: string): Pose[] => {
        const startY = centerRadius - radius;
        const ex = radius * Math.sin(degToRad(signedAngle));
        const ey = centerRadius - radius * Math.cos(degToRad(signedAngle));
        const startKey = `${prefix}-a`;
        const endKey = `${prefix}-b`;
        return [
          { key: startKey, label: `${prefix} A`, x: 0, y: startY, heading: 0, ...compatibilityForPort(startKey) },
          { key: endKey, label: `${prefix} B`, x: ex, y: ey, heading: norm(180 + signedAngle), ...compatibilityForPort(endKey) },
        ];
      };
      return [...portsForRadius(r1, 'track-1'), ...portsForRadius(r2, 'track-2')];
    }

    const r = r1;
    const ex = r * Math.sin(degToRad(signedAngle));
    const ey = r * (1 - Math.cos(degToRad(signedAngle)));
    return [
      { key: 'a', label: 'A', x: 0, y: 0, heading: 0 },
      { key: 'b', label: 'B', x: ex, y: ey, heading: norm(180 + signedAngle) },
    ];
  }

  if (part.kind === 'turnout') {
    const len = part.length ?? 186;
    const r = part.radius ?? 718;
    const a = part.angle ?? 15;

    if (part.diverging === 'wye') {
      const ex = r * Math.sin(degToRad(a));
      const ey = r * (1 - Math.cos(degToRad(a)));
      return [
        { key: 'common', label: 'Common', x: 0, y: 0, heading: 0 },
        { key: 'left', label: 'Left route', x: ex, y: -ey, heading: norm(180 - a) },
        { key: 'right', label: 'Right route', x: ex, y: ey, heading: norm(180 + a) },
      ];
    }

    const side = part.diverging === 'left' ? -1 : 1;
    const ex = r * Math.sin(degToRad(a));
    const ey = side * r * (1 - Math.cos(degToRad(a)));
    return [
      { key: 'common', label: 'Common', x: 0, y: 0, heading: 0 },
      { key: 'straight', label: 'Straight', x: len, y: 0, heading: 180 },
      { key: 'diverging', label: 'Diverging', x: ex, y: ey, heading: norm(180 + side * a) },
    ];
  }

  if (part.kind === 'crossing' && !isDoubleTrack(part)) {
    const len = part.length ?? 124;
    const angle = part.angle ?? 90;
    const side = part.diverging === 'right' ? -1 : 1;
    const a = side * angle;
    const cx = len / 2;
    const half = len / 2;
    const dx = half * Math.cos(degToRad(a));
    const dy = half * Math.sin(degToRad(a));
    return [
      { key: 'main-left', label: 'Main left', x: 0, y: 0, heading: 0 },
      { key: 'main-right', label: 'Main right', x: len, y: 0, heading: 180 },
      { key: 'cross-a', label: 'Cross A', x: cx - dx, y: -dy, heading: norm(a) },
      { key: 'cross-b', label: 'Cross B', x: cx + dx, y: dy, heading: norm(180 + a) },
    ];
  }

  // KATO double crossover/single crossover: four connection points on two parallel tracks.
  const len = part.length ?? 310;
  const halfCenter = (part.trackCenters ?? 33) / 2;
  return [
    { key: 'upper-left', label: 'Upper left', x: 0, y: -halfCenter, heading: 0 },
    { key: 'upper-right', label: 'Upper right', x: len, y: -halfCenter, heading: 180 },
    { key: 'lower-left', label: 'Lower left', x: 0, y: halfCenter, heading: 0 },
    { key: 'lower-right', label: 'Lower right', x: len, y: halfCenter, heading: 180 },
  ];
}

export function connectors(part: TrackPart, placed: PlacedTrack): Pose[] {
  const local = localConnectors(part, false, placed);
  return local.map(p => transformLocalPose({ ...p, partSku: part.sku }, placed));
}
