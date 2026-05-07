import type { TrackPart } from '@/lib/unitrack';
import { isDoubleTrack } from '@/lib/geometry';

export type RendererFamily =
  | 'standard-track'
  | 'turnout'
  | 'wye'
  | 'crossing'
  | 'double-track'
  | 'single-viaduct'
  | 'double-viaduct'
  | 'double-slab-track'
  | 'truss-bridge'
  | 'deck-girder-bridge'
  | 'plate-girder-bridge'
  | 'bumper'
  | 'building'
  | 'shape';

export function getRendererFamily(part: TrackPart): RendererFamily {
  if (part.kind === 'building') return 'building';
  if (part.kind === 'shape') return 'shape';
  if (part.isTerminal) return 'bumper';
  if (part.kind === 'turnout') return part.diverging === 'wye' ? 'wye' : 'turnout';
  if (part.kind === 'crossing') return 'crossing';
  if (part.secondaryKinds?.includes('Bridge')) {
    if (part.bridgeStyle === 'truss') return 'truss-bridge';
    if (part.bridgeStyle === 'plate-girder') return 'plate-girder-bridge';
    return 'deck-girder-bridge';
  }
  if (part.secondaryKinds?.includes('Viaduct')) {
    if (isDoubleTrack(part) && (part.secondaryKinds?.includes('Concrete Slab') || part.notes?.toLowerCase().includes('slab'))) return 'double-slab-track';
    return isDoubleTrack(part) ? 'double-viaduct' : 'single-viaduct';
  }
  if (isDoubleTrack(part)) return part.secondaryKinds?.includes('Concrete Slab') || part.notes?.toLowerCase().includes('slab') ? 'double-slab-track' : 'double-track';
  return 'standard-track';
}
