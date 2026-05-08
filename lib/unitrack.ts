export type TrackKind = 'straight' | 'curve' | 'turnout' | 'crossing' | 'building' | 'shape';
export type SecondaryTrackKind = 'Viaduct' | 'Double' | 'Bridge' | 'Concrete Tie' | 'Concrete Slab';

export type TrackPart = {
  id: string;
  sku: string;
  name: string;
  kind: TrackKind;
  secondaryKinds?: SecondaryTrackKind[];
  length?: number;
  minLength?: number;
  maxLength?: number;
  radius?: number;
  radius2?: number;
  angle?: number;
  diverging?: 'left' | 'right' | 'wye';
  trackCenters?: number;
  notes?: string;
  color?: string;
  bridgeStyle?: 'truss' | 'plate-girder' | 'deck-girder';
  isTerminal?: boolean;
  width?: number;
  depth?: number;
  buildingStyle?: 'station' | 'platform' | 'generic';
  shapeType?: 'rectangle' | 'triangle' | 'circle';
  shapeWidth?: number;
  shapeHeight?: number;
  shapeSide?: number;
  shapeDiameter?: number;
  connectionNodes?: { key: string; label?: string; x: number; y: number; heading: number; nodeKind?: 'track' | 'platform'; compatibilityTag?: string; compatibleTags?: string[] }[];
};

export const PRIMARY_TRACK_KINDS: TrackKind[] = ['straight', 'curve', 'turnout', 'crossing', 'building', 'shape'];
export const SECONDARY_TRACK_KINDS: SecondaryTrackKind[] = ['Viaduct', 'Double', 'Bridge', 'Concrete Tie', 'Concrete Slab'];

export const UNITRACK_PARTS: TrackPart[] = [
  { id: 'shape-rectangle', sku: 'SHAPE-RECT', name: 'Custom Rectangle', kind: 'shape', shapeType: 'rectangle', shapeWidth: 100, shapeHeight: 60, color: '#94a3b8', notes: 'Customizable top-down rectangle; edit width and height when selected' },
  { id: 'shape-triangle', sku: 'SHAPE-TRI', name: 'Custom Triangle', kind: 'shape', shapeType: 'triangle', shapeSide: 80, color: '#94a3b8', notes: 'Customizable equilateral triangle; edit side length when selected' },
  { id: 'shape-circle', sku: 'SHAPE-CIR', name: 'Custom Circle', kind: 'shape', shapeType: 'circle', shapeDiameter: 75, color: '#94a3b8', notes: 'Customizable top-down circle; edit diameter when selected' },
  { id: 'station-23-330', sku: '23-330', name: 'Local Station Building / Platform', kind: 'building', width: 124, depth: 72, color: '#9bd59a', buildingStyle: 'station', notes: 'Top-down building footprint; no track connection nodes by default' },

  { id: 'platform-23-170-end-left', sku: '23-170A', name: 'Island Platform 23-170 Left Curved End', kind: 'building', width: 200, depth: 42, color: '#cbd5e1', buildingStyle: 'platform', notes: 'KATO 23-170 modular island platform curved end; platform nodes connect only to other platform nodes', connectionNodes: [
    { key: 'platform-right', label: 'Platform connector', x: 100, y: 0, heading: 180, nodeKind: 'platform' }
  ] },
  { id: 'platform-23-170-center-a', sku: '23-170B', name: 'Island Platform 23-170 Center A', kind: 'building', width: 248, depth: 42, color: '#cbd5e1', buildingStyle: 'platform', notes: 'KATO 23-170 modular island platform center section; platform nodes connect only to other platform nodes', connectionNodes: [
    { key: 'platform-left', label: 'Platform connector', x: -124, y: 0, heading: 0, nodeKind: 'platform' },
    { key: 'platform-right', label: 'Platform connector', x: 124, y: 0, heading: 180, nodeKind: 'platform' }
  ] },
  { id: 'platform-23-170-center-b', sku: '23-170C', name: 'Island Platform 23-170 Center B', kind: 'building', width: 248, depth: 42, color: '#cbd5e1', buildingStyle: 'platform', notes: 'KATO 23-170 modular island platform center section; platform nodes connect only to other platform nodes', connectionNodes: [
    { key: 'platform-left', label: 'Platform connector', x: -124, y: 0, heading: 0, nodeKind: 'platform' },
    { key: 'platform-right', label: 'Platform connector', x: 124, y: 0, heading: 180, nodeKind: 'platform' }
  ] },
  { id: 'platform-23-170-end-right', sku: '23-170D', name: 'Island Platform 23-170 Right Curved End', kind: 'building', width: 200, depth: 42, color: '#cbd5e1', buildingStyle: 'platform', notes: 'KATO 23-170 modular island platform curved end; platform nodes connect only to other platform nodes', connectionNodes: [
    { key: 'platform-left', label: 'Platform connector', x: -100, y: 0, heading: 0, nodeKind: 'platform' }
  ] },
  { id: 's248', sku: '20-000', name: 'S248 Straight', kind: 'straight', length: 248 },
  { id: 'concrete-s248', sku: '20-875', name: 'Concrete Tie S248 Straight', kind: 'straight', secondaryKinds: ['Concrete Tie'], length: 248, notes: 'Concrete-tie straight track, 248mm' },
  { id: 'double-concrete-s248', sku: '20-004', name: 'Concrete Tie Double Track 248mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Tie'], length: 248, trackCenters: 33, notes: 'Concrete-tie double-track straight section on 33mm centers' },
  { id: 'double-concrete-slab-s248', sku: '20-006', name: 'Concrete Slab Double Track 248mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Slab'], length: 248, trackCenters: 33, notes: 'Concrete slab double-track straight section on 33mm centers' },
  { id: 's186', sku: '20-010', name: 'S186 Straight', kind: 'straight', length: 186 },
  { id: 'double-concrete-s186', sku: '20-012', name: 'Concrete Tie Double Track 186mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Tie'], length: 186, trackCenters: 33, notes: 'Concrete-tie double-track straight section on 33mm centers' },
  { id: 'double-concrete-slab-s186', sku: '20-014', name: 'Concrete Slab Double Track 186mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Slab'], length: 186, trackCenters: 33, notes: 'Concrete slab double-track straight section on 33mm centers' },
  { id: 's124', sku: '20-020', name: 'S124 Straight', kind: 'straight', length: 124 },
  { id: 'double-concrete-s124', sku: '20-023', name: 'Concrete Tie Double Track 124mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Tie'], length: 124, trackCenters: 33, notes: 'Concrete-tie double-track straight section on 33mm centers' },
  { id: 'double-concrete-slab-s124', sku: '20-025', name: 'Concrete Slab Double Track 124mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Slab'], length: 124, trackCenters: 33, notes: 'Concrete slab double-track straight section on 33mm centers' },
  { id: 's64', sku: '20-030', name: 'S64 Straight', kind: 'straight', length: 64 },
  { id: 's62', sku: '20-040', name: 'S62 Straight', kind: 'straight', length: 62 },
  { id: 's62f', sku: '20-041', name: 'S62 Feeder', kind: 'straight', length: 62 },
  { id: 'double-concrete-s62', sku: '20-042', name: 'Concrete Tie Double Track 62mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Tie'], length: 62, trackCenters: 33, notes: 'Concrete-tie double-track straight section on 33mm centers' },
  { id: 'double-concrete-s62f', sku: '20-043', name: 'Concrete Tie Double Track Feeder 62mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Tie'], length: 62, trackCenters: 33, notes: 'Concrete-tie double-track feeder straight section on 33mm centers' },
  { id: 'double-concrete-slab-s62', sku: '20-044', name: 'Concrete Slab Double Track 62mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Slab'], length: 62, trackCenters: 33, notes: 'Concrete slab double-track straight section on 33mm centers' },
  { id: 'double-concrete-slab-s62f', sku: '20-049', name: 'Concrete Slab Double Track Feeder 62mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Slab'], length: 62, trackCenters: 33, notes: 'Concrete slab double-track feeder straight section on 33mm centers' },
  { id: 'expansion-78-108', sku: '20-050', name: 'Expansion Track 78–108mm', kind: 'straight', length: 108, minLength: 78, maxLength: 108, notes: 'Adjustable straight expansion track; drag end handle to resize between 78mm and 108mm' },
  { id: 'double-widening-left-310', sku: '20-051', name: 'Concrete Tie Double Track Widening Left 310mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Tie'], length: 310, trackCenters: 33, diverging: 'left', notes: 'Concrete-tie double-track left-hand widening section, 310mm; left end centers are 33mm apart and right end centers are 66mm apart', connectionNodes: [
    { key: 'upper-left', label: 'Upper left', x: 0, y: -16.5, heading: 0 },
    { key: 'upper-right', label: 'Upper right', x: 310, y: -49.5, heading: 180 },
    { key: 'lower-left', label: 'Lower left', x: 0, y: 16.5, heading: 0 },
    { key: 'lower-right', label: 'Lower right', x: 310, y: 16.5, heading: 180 },
  ] },
  { id: 'double-widening-right-310', sku: '20-052', name: 'Concrete Tie Double Track Widening Right 310mm', kind: 'straight', secondaryKinds: ['Double', 'Concrete Tie'], length: 310, trackCenters: 33, diverging: 'right', notes: 'Concrete-tie double-track right-hand widening section, 310mm; left end centers are 66mm apart and right end centers are 33mm apart', connectionNodes: [
    { key: 'upper-left', label: 'Upper left', x: 0, y: -49.5, heading: 0 },
    { key: 'upper-right', label: 'Upper right', x: 310, y: -16.5, heading: 180 },
    { key: 'lower-left', label: 'Lower left', x: 0, y: 16.5, heading: 0 },
    { key: 'lower-right', label: 'Lower right', x: 310, y: 16.5, heading: 180 },
  ] },
  { id: 'bumper-20-046', sku: '20-046', name: 'Bumper Type A', kind: 'straight', length: 95, isTerminal: true, notes: 'Long bumper with concrete stop.' },
  { id: 'bumper-20-047', sku: '20-047', name: 'Bumper Type B', kind: 'straight', length: 95, isTerminal: true, notes: 'Long bumper with rock filled wood stop.' },
  { id: 'bumper-20-048', sku: '20-048', name: 'Bumper Type C', kind: 'straight', length: 50, isTerminal: true, notes: 'Short bumper with posts stop.' },
  { id: 'bumper-20-060', sku: '20-060', name: 'Short Bumpber D', kind: 'straight', length: 35, isTerminal: true, notes: 'Compact bumper.' },
  { id: 'bumper-20-063', sku: '20-063', name: 'Illuminated Bumper Block', kind: 'straight', length: 66, isTerminal: true, notes: 'Illuminated Bumpber with concrete stop.' },
  { id: 'bumper-20-064', sku: '20-064', name: 'Illuminated Bumper Posts', kind: 'straight', length: 66, isTerminal: true, notes: 'Illuminated Bumpber with posts stop.' },
  { id: 's29', sku: '20-091', name: 'S29 Straight', kind: 'straight', length: 29 },
  { id: 's45.5', sku: '20-091', name: 'S45.5 Straight', kind: 'straight', length: 45.5 },
  { id: 's33', sku: '20-092', name: 'S33 Straight', kind: 'straight', length: 33 },
  { id: 's38', sku: '20-092', name: 'S38 Straight', kind: 'straight', length: 38 },
  { id: 'r249-45', sku: '20-100', name: 'R249-45 Curve', kind: 'curve', radius: 249, angle: 45 },
  { id: 'r249-15', sku: '20-101', name: 'R249-15 Curve', kind: 'curve', radius: 249, angle: 15 },
  { id: 'r282-45', sku: '20-110', name: 'R282-45 Curve', kind: 'curve', radius: 282, angle: 45 },
  { id: 'r282-15', sku: '20-111', name: 'R282-15 Curve', kind: 'curve', radius: 282, angle: 15 },
  { id: 'r315-45', sku: '20-120', name: 'R315-45 Curve', kind: 'curve', radius: 315, angle: 45 },
  { id: 'r315-15', sku: '20-121', name: 'R315-15 Curve', kind: 'curve', radius: 315, angle: 15 },
  { id: 'r348-30', sku: '20-130', name: 'R348-30 Curve', kind: 'curve', radius: 348, angle: 30 },
  { id: 'r348-45', sku: '20-132', name: 'R348-45 Curve', kind: 'curve', radius: 348, angle: 45 },
  { id: 'r381-30', sku: '20-140', name: 'R381-30 Curve', kind: 'curve', radius: 381, angle: 30 },
  { id: 'r381-10', sku: '20-141', name: 'R381-10 Curve', kind: 'curve', radius: 381, angle: 10 },
  { id: 'r718-15', sku: '20-150', name: 'R718-15 Curve', kind: 'curve', radius: 718, angle: 15 },
  { id: 'r481-15', sku: '20-160', name: 'R481-15 Curve', kind: 'curve', radius: 481, angle: 15 },
  { id: 'double-concrete-r414-381-45', sku: '20-181', name: 'Concrete Tie Double Track Curve R414/381-45', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 414, radius2: 381, angle: 45, notes: 'Concrete-tie double-track 45° curve with 414mm/381mm radii' },
  { id: 'double-concrete-r414-381-22.5-left', sku: '20-182L', name: 'Concrete Tie Double Track Curve R414/381-22.5 Left', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 414, radius2: 381, angle: 22.5, diverging: 'left', notes: 'Concrete-tie double-track 22.5° left transition curve; right-side nodes only connect with 20-181, 20-183, or 20-185' },
  { id: 'double-concrete-r414-381-22.5-right', sku: '20-182R', name: 'Concrete Tie Double Track Curve R414/381-22.5 Right', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 414, radius2: 381, angle: 22.5, diverging: 'right', notes: 'Concrete-tie double-track 22.5° right transition curve; left-side nodes only connect with 20-181, 20-183, or 20-185' },
  { id: 'double-concrete-r315-282-45', sku: '20-183', name: 'Concrete Tie Double Track Curve R315/282-45', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 315, radius2: 282, angle: 45, notes: 'Concrete-tie double-track 45° curve with 315mm/282mm radii' },
  { id: 'double-concrete-r315-282-22.5-left', sku: '20-184L', name: 'Concrete Tie Double Track Curve R315/282-22.5 Left', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 315, radius2: 282, angle: 22.5, diverging: 'left', notes: 'Concrete-tie double-track 22.5° left transition curve; right-side nodes only connect with 20-181, 20-183, or 20-185' },
  { id: 'double-concrete-r315-282-22.5-right', sku: '20-184R', name: 'Concrete Tie Double Track Curve R315/282-22.5 Right', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 315, radius2: 282, angle: 22.5, diverging: 'right', notes: 'Concrete-tie double-track 22.5° right transition curve; left-side nodes only connect with 20-181, 20-183, or 20-185' },
  { id: 'double-concrete-r480-447-45', sku: '20-185', name: 'Concrete Tie Double Track Curve R480/447-45', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 480, radius2: 447, angle: 45, notes: 'Concrete-tie double-track 45° curve with 480mm/447mm radii' },
  { id: 'double-concrete-r480-447-22.5-left', sku: '20-186L', name: 'Concrete Tie Double Track Curve R480/447-22.5 Left', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 480, radius2: 447, angle: 22.5, diverging: 'left', notes: 'Concrete-tie double-track 22.5° left transition curve; right-side nodes only connect with 20-181, 20-183, or 20-185' },
  { id: 'double-concrete-r480-447-22.5-right', sku: '20-186R', name: 'Concrete Tie Double Track Curve R480/447-22.5 Right', kind: 'curve', secondaryKinds: ['Double', 'Concrete Tie'], radius: 480, radius2: 447, angle: 22.5, diverging: 'right', notes: 'Concrete-tie double-track 22.5° right transition curve; left-side nodes only connect with 20-181, 20-183, or 20-185' },
  { id: 'double-concrete-slab-r414-381-45', sku: '20-187', name: 'Concrete Slab Double Track Curve R414/381-45', kind: 'curve', secondaryKinds: ['Double', 'Concrete Slab'], radius: 414, radius2: 381, angle: 45, notes: 'Concrete slab double-track 45° curve with 414mm/381mm radii; special nodes compatible with the concrete double-curve family' },
  { id: 'double-concrete-slab-r414-381-22.5-left', sku: '20-188L', name: 'Concrete Slab Double Track Curve R414/381-22.5 Left', kind: 'curve', secondaryKinds: ['Double', 'Concrete Slab'], radius: 414, radius2: 381, angle: 22.5, diverging: 'left', notes: 'Concrete slab double-track 22.5° left transition curve; right-side nodes only connect with the concrete double-curve family' },
  { id: 'double-concrete-slab-r414-381-22.5-right', sku: '20-188R', name: 'Concrete Slab Double Track Curve R414/381-22.5 Right', kind: 'curve', secondaryKinds: ['Double', 'Concrete Slab'], radius: 414, radius2: 381, angle: 22.5, diverging: 'right', notes: 'Concrete slab double-track 22.5° right transition curve; left-side nodes only connect with the concrete double-curve family' },
  { id: 'double-concrete-slab-viaduct-r414-381-45', sku: '20-544', name: 'Concrete Slab Double Track Viaduct Curve R414/381-45', kind: 'curve', secondaryKinds: ['Double', 'Viaduct', 'Concrete Slab'], radius: 414, radius2: 381, angle: 45, color: '#8f9499', notes: 'Concrete slab double-track viaduct 45° curve with 414mm/381mm radii; special nodes compatible with the concrete double-curve family' },
  { id: 'double-concrete-slab-viaduct-r414-381-22.5-left', sku: '20-545L', name: 'Concrete Slab Double Track Viaduct Curve R414/381-22.5 Left', kind: 'curve', secondaryKinds: ['Double', 'Viaduct', 'Concrete Slab'], radius: 414, radius2: 381, angle: 22.5, diverging: 'left', color: '#8f9499', notes: 'Concrete slab double-track viaduct 22.5° left transition curve; right-side nodes only connect with the concrete double-curve family' },
  { id: 'double-concrete-slab-viaduct-r414-381-22.5-right', sku: '20-545R', name: 'Concrete Slab Double Track Viaduct Curve R414/381-22.5 Right', kind: 'curve', secondaryKinds: ['Double', 'Viaduct', 'Concrete Slab'], radius: 414, radius2: 381, angle: 22.5, diverging: 'right', color: '#8f9499', notes: 'Concrete slab double-track viaduct 22.5° right transition curve; left-side nodes only connect with the concrete double-curve family' },
  { id: 'r216-45', sku: '20-170', name: 'R216-45 Curve', kind: 'curve', radius: 216, angle: 45 },
  { id: 'r216-15', sku: '20-171', name: 'R216-15 Curve', kind: 'curve', radius: 216, angle: 15 },
  { id: 'r183-45', sku: '20-172', name: 'R183-45 Compact Curve', kind: 'curve', radius: 183, angle: 45, notes: 'Compact 183mm radius curve' },
  { id: 'r150-45', sku: '20-174', name: 'R150-45 Curve', kind: 'curve', radius: 150, angle: 45 },
  { id: 'r117-45', sku: '20-176', name: 'R117-45 Compact Curve', kind: 'curve', radius: 117, angle: 45, notes: 'Compact 117mm radius curve' },
  { id: 'ep718-15l', sku: '20-202', name: '#6 Left Turnout', kind: 'turnout', length: 186, radius: 718, angle: 15, diverging: 'left' },
  { id: 'ep718-15r', sku: '20-203', name: '#6 Right Turnout', kind: 'turnout', length: 186, radius: 718, angle: 15, diverging: 'right' },
  { id: 'ep481-15l', sku: '20-220', name: '#4 Left Turnout', kind: 'turnout', length: 124, radius: 481, angle: 15, diverging: 'left', notes: 'Compact #4 turnout; three connection points' },
  { id: 'ep481-15r', sku: '20-221', name: '#4 Right Turnout', kind: 'turnout', length: 124, radius: 481, angle: 15, diverging: 'right', notes: 'Compact #4 turnout; three connection points' },
  { id: 'wy481-15', sku: '20-222', name: '#2 Wye Turnout', kind: 'turnout', radius: 481, angle: 15, diverging: 'wye', notes: 'Wye turnout with two R481 15° diverging routes' },
  { id: 'ep150-45l', sku: '20-240', name: 'Compact R150-45 Left Turnout', kind: 'turnout', length: 124, radius: 150, angle: 45, diverging: 'left', notes: 'Compact EP150-45L left turnout with 124mm straight route and R150 45° diverging route' },
  { id: 'ep150-45r', sku: '20-241', name: 'Compact R150-45 Right Turnout', kind: 'turnout', length: 124, radius: 150, angle: 45, diverging: 'right', notes: 'Compact EP150-45R right turnout with 124mm straight route and R150 45° diverging route' },
  { id: 'single-crossover-left', sku: '20-230', name: 'Double Track Single Crossover Left', kind: 'crossing', secondaryKinds: ['Double'], length: 248, trackCenters: 33, diverging: 'left', notes: '#4 single crossover, left, 248mm overall length' },
  { id: 'single-crossover-right', sku: '20-231', name: 'Double Track Single Crossover Right', kind: 'crossing', secondaryKinds: ['Double'], length: 248, trackCenters: 33, diverging: 'right', notes: '#4 single crossover, right, 248mm overall length' },
  { id: 'crossing-15-left', sku: '20-300', name: '15° Crossing Left', kind: 'crossing', length: 186, angle: 15, diverging: 'left', notes: 'Single-track 15° left crossing, 186mm' },
  { id: 'crossing-15-right', sku: '20-301', name: '15° Crossing Right', kind: 'crossing', length: 186, angle: 15, diverging: 'right', notes: 'Single-track 15° right crossing, 186mm' },
  { id: 'crossing-90', sku: '20-320', name: '90° Crossing', kind: 'crossing', length: 33, angle: 90, notes: 'Single-track 90° crossing, 33mm x 33mm' },
  { id: 'double-crossover', sku: '20-210', name: 'Double Crossover', kind: 'crossing', secondaryKinds: ['Double'], length: 310, trackCenters: 33, notes: 'Four main connection points on 33mm track centers' },
  { id: 'viaduct-s248', sku: '20-400', name: 'S248 Single Track Viaduct', kind: 'straight', secondaryKinds: ['Viaduct'], length: 248, color: '#8f9499', notes: 'Single-track straight viaduct, 248mm' },
  { id: 'double-viaduct-s248', sku: '20-401', name: 'Concrete Slab Double Track Straight Viaduct 248mm', kind: 'straight', secondaryKinds: ['Double', 'Viaduct', 'Concrete Slab'], length: 248, trackCenters: 33, color: '#8f9499', notes: 'Concrete slab double-track straight viaduct section on 33mm centers with edge walls' },
  { id: 'viaduct-s186', sku: '20-410', name: 'S186 Single Track Viaduct', kind: 'straight', secondaryKinds: ['Viaduct'], length: 186, color: '#8f9499', notes: 'Single-track straight viaduct, 186mm' },
  { id: 'double-viaduct-s186', sku: '20-411', name: 'Concrete Slab Double Track Straight Viaduct 186mm', kind: 'straight', secondaryKinds: ['Double', 'Viaduct', 'Concrete Slab'], length: 186, trackCenters: 33, color: '#8f9499', notes: 'Concrete slab double-track straight viaduct section on 33mm centers with edge walls' },
  { id: 'viaduct-s124', sku: '20-420', name: 'S124 Single Track Viaduct', kind: 'straight', secondaryKinds: ['Viaduct'], length: 124, color: '#8f9499', notes: 'Single-track straight viaduct, 124mm' },
  { id: 'double-viaduct-s124', sku: '20-422', name: 'Concrete Slab Double Track Straight Viaduct 124mm', kind: 'straight', secondaryKinds: ['Double', 'Viaduct', 'Concrete Slab'], length: 124, trackCenters: 33, color: '#8f9499', notes: 'Concrete slab double-track straight viaduct section on 33mm centers with edge walls' },
  { id: 'viaduct-s62', sku: '20-440', name: 'S62 Single Track Viaduct', kind: 'straight', secondaryKinds: ['Viaduct'], length: 62, color: '#8f9499', notes: 'Single-track straight viaduct, 62mm' },
  { id: 'viaduct-r249-45', sku: '20-505', name: 'R249-45 Single Track Viaduct Curve', kind: 'curve', secondaryKinds: ['Viaduct'], radius: 249, angle: 45, color: '#8f9499', notes: 'Single-track viaduct curve, R249 45°' },
  { id: 'viaduct-r282-45', sku: '20-510', name: 'R282-45 Single Track Viaduct Curve', kind: 'curve', secondaryKinds: ['Viaduct'], radius: 282, angle: 45, color: '#8f9499', notes: 'Single-track viaduct curve, R282 45°' },
  { id: 'viaduct-r315-45', sku: '20-520', name: 'R315-45 Viaduct Curve', kind: 'curve', secondaryKinds: ['Viaduct'], radius: 315, angle: 45, color: '#8f9499', notes: 'Elevated viaduct curve section with side walls' },
  { id: 'viaduct-r348-45', sku: '20-530', name: 'R348-45 Single Track Viaduct Curve', kind: 'curve', secondaryKinds: ['Viaduct'], radius: 348, angle: 45, color: '#8f9499', notes: 'Single-track viaduct curve, R348 45°' },
  { id: 'viaduct-r348-30', sku: '20-531', name: 'R348-30 Single Track Viaduct Curve', kind: 'curve', secondaryKinds: ['Viaduct'], radius: 348, angle: 30, color: '#8f9499', notes: 'Single-track viaduct curve, R348 30°' },
  { id: 'viaduct-r381-30', sku: '20-540', name: 'R381-30 Single Track Viaduct Curve', kind: 'curve', secondaryKinds: ['Viaduct'], radius: 381, angle: 30, color: '#8f9499', notes: 'Single-track viaduct curve, R381 30°' },
  { id: 'truss-bridge-red-brown-s248', sku: '20-429', name: 'S248 Single Track Truss Bridge Red Brown', kind: 'straight', secondaryKinds: ['Bridge'], length: 248, color: '#7a3f2a', bridgeStyle: 'truss', notes: 'Single-track truss bridge, reddish brown, 248mm' },
  { id: 'truss-bridge-red-s248', sku: '20-430', name: 'S248 Single Track Truss Bridge Red', kind: 'straight', secondaryKinds: ['Bridge'], length: 248, color: '#a53b32', bridgeStyle: 'truss', notes: 'Single-track truss bridge, red, 248mm' },
  { id: 'truss-bridge-green-s248', sku: '20-431', name: 'S248 Single Track Truss Bridge Green', kind: 'straight', secondaryKinds: ['Bridge'], length: 248, color: '#4f7f4f', bridgeStyle: 'truss', notes: 'Single-track truss bridge, green, 248mm' },
  { id: 'truss-bridge-gray-s248', sku: '20-432', name: 'S248 Single Track Truss Bridge Gray', kind: 'straight', secondaryKinds: ['Bridge'], length: 248, color: '#777777', bridgeStyle: 'truss', notes: 'Single-track truss bridge, gray, 248mm' },
  { id: 'truss-bridge-silver-s248', sku: '20-433', name: 'S248 Single Track Truss Bridge Silver', kind: 'straight', secondaryKinds: ['Bridge'], length: 248, color: '#9ca3af', bridgeStyle: 'truss', notes: 'Single-track truss bridge, silver, 248mm' },
  { id: 'truss-bridge-black-s248', sku: '20-434', name: 'S248 Single Track Truss Bridge Black', kind: 'straight', secondaryKinds: ['Bridge'], length: 248, color: '#333333', bridgeStyle: 'truss', notes: 'Single-track truss bridge, black, 248mm' },
  { id: 'double-truss-bridge-light-blue-s248', sku: '20-436', name: 'Double Track Truss Bridge Light Blue 248mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 248, trackCenters: 33, color: '#9bdcf4', bridgeStyle: 'truss', notes: 'Double-track light blue truss bridge, 248mm' },
  { id: 'double-truss-bridge-gray-s248', sku: '20-437', name: 'Double Track Truss Bridge Gray 248mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 248, trackCenters: 33, color: '#9ca3af', bridgeStyle: 'truss', notes: 'Double-track gray truss bridge, 248mm' },
  { id: 'double-truss-bridge-black-s248', sku: '20-438', name: 'Double Track Truss Bridge Black 248mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 248, trackCenters: 33, color: '#262b2f', bridgeStyle: 'truss', notes: 'Double-track dark gray black truss bridge, 248mm' },
  { id: 'double-truss-bridge-light-green-s248', sku: '20-439', name: 'Double Track Truss Bridge Light Green 248mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 248, trackCenters: 33, color: '#a8d8b4', bridgeStyle: 'truss', notes: 'Double-track light green truss bridge, 248mm' },
  { id: 'double-plate-girder-bridge-light-blue-s186', sku: '20-455', name: 'Double Track Plate Girder Bridge Light Blue 186mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 186, trackCenters: 33, color: '#9bdcf4', bridgeStyle: 'plate-girder', notes: 'Double-track light blue plate girder bridge, 186mm' },
  { id: 'double-plate-girder-bridge-light-green-s186', sku: '20-456', name: 'Double Track Plate Girder Bridge Light Green 186mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 186, trackCenters: 33, color: '#a8d8b4', bridgeStyle: 'plate-girder', notes: 'Double-track light green plate girder bridge, 186mm' },
  { id: 'double-plate-girder-bridge-gray-s186', sku: '20-457', name: 'Double Track Plate Girder Bridge Gray 186mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 186, trackCenters: 33, color: '#9ca3af', bridgeStyle: 'plate-girder', notes: 'Double-track gray plate girder bridge, 186mm' },
  { id: 'double-plate-girder-bridge-black-s186', sku: '20-458', name: 'Double Track Plate Girder Bridge Black 186mm', kind: 'straight', secondaryKinds: ['Double', 'Bridge'], length: 186, trackCenters: 33, color: '#262b2f', bridgeStyle: 'plate-girder', notes: 'Double-track dark gray black plate girder bridge, 186mm' },
  { id: 'plate-girder-bridge-red-s186', sku: '20-450', name: 'S186 Single Track Plate Girder Bridge Red', kind: 'straight', secondaryKinds: ['Bridge'], length: 186, color: '#a53b32', bridgeStyle: 'plate-girder', notes: 'Single-track plate girder bridge, red, 186mm' },
  { id: 'plate-girder-bridge-green-s186', sku: '20-451', name: 'S186 Single Track Plate Girder Bridge Green', kind: 'straight', secondaryKinds: ['Bridge'], length: 186, color: '#4f7f4f', bridgeStyle: 'plate-girder', notes: 'Single-track plate girder bridge, green, 186mm' },
  { id: 'plate-girder-bridge-gray-s186', sku: '20-452', name: 'S186 Single Track Plate Girder Bridge Gray', kind: 'straight', secondaryKinds: ['Bridge'], length: 186, color: '#777777', bridgeStyle: 'plate-girder', notes: 'Single-track plate girder bridge, gray, 186mm' },
  { id: 'plate-girder-bridge-silver-s186', sku: '20-453', name: 'S186 Single Track Plate Girder Bridge Silver', kind: 'straight', secondaryKinds: ['Bridge'], length: 186, color: '#9ca3af', bridgeStyle: 'plate-girder', notes: 'Single-track plate girder bridge, silver, 186mm' },
  { id: 'plate-girder-bridge-black-s186', sku: '20-454', name: 'S186 Single Track Plate Girder Bridge Black', kind: 'straight', secondaryKinds: ['Bridge'], length: 186, color: '#333333', bridgeStyle: 'plate-girder', notes: 'Single-track plate girder bridge, black, 186mm' },
  { id: 'deck-girder-bridge-red-s124', sku: '20-460', name: 'S124 Single Track Deck Girder Bridge Red', kind: 'straight', secondaryKinds: ['Bridge'], length: 124, color: '#a53b32', bridgeStyle: 'deck-girder', notes: 'Single-track deck girder bridge, red, 124mm' },
  { id: 'deck-girder-bridge-green-s124', sku: '20-461', name: 'S124 Single Track Deck Girder Bridge Green', kind: 'straight', secondaryKinds: ['Bridge'], length: 124, color: '#4f7f4f', bridgeStyle: 'deck-girder', notes: 'Single-track deck girder bridge, green, 124mm' },
  { id: 'deck-girder-bridge-gray-s124', sku: '20-462', name: 'S124 Single Track Deck Girder Bridge Gray', kind: 'straight', secondaryKinds: ['Bridge'], length: 124, color: '#777777', bridgeStyle: 'deck-girder', notes: 'Single-track deck girder bridge, gray, 124mm' },
  { id: 'deck-girder-bridge-black-s124', sku: '20-464', name: 'S124 Single Track Deck Girder Bridge Black', kind: 'straight', secondaryKinds: ['Bridge'], length: 124, color: '#333333', bridgeStyle: 'deck-girder', notes: 'Single-track deck girder bridge, black, 124mm' },
  { id: 'bridge-r448-15-red', sku: '20-465', name: 'R448-15 Curved Deck Girder Bridge Red', kind: 'curve', secondaryKinds: ['Bridge'], radius: 448, angle: 15, color: '#a53b32', bridgeStyle: 'deck-girder', notes: 'Single-track curved deck girder bridge, red' },
  { id: 'bridge-r448-15-green', sku: '20-466', name: 'R448-15 Curved Deck Girder Bridge Green', kind: 'curve', secondaryKinds: ['Bridge'], radius: 448, angle: 15, color: '#4f7f4f', bridgeStyle: 'deck-girder', notes: 'Single-track curved deck girder bridge, green' },
  { id: 'bridge-r448-15-gray', sku: '20-467', name: 'R448-15 Curved Deck Girder Bridge Gray', kind: 'curve', secondaryKinds: ['Bridge'], radius: 448, angle: 15, color: '#777777', bridgeStyle: 'deck-girder', notes: 'Single-track curved deck girder bridge, gray' },
  { id: 'bridge-r481-15-red', sku: '20-470', name: 'R481-15 Curved Deck Girder Bridge Red', kind: 'curve', secondaryKinds: ['Bridge'], radius: 481, angle: 15, color: '#a53b32', bridgeStyle: 'deck-girder', notes: 'Single-track curved deck girder bridge, red' },
  { id: 'bridge-r481-15-green', sku: '20-471', name: 'R481-15 Curved Deck Girder Bridge Green', kind: 'curve', secondaryKinds: ['Bridge'], radius: 481, angle: 15, color: '#4f7f4f', bridgeStyle: 'deck-girder', notes: 'Single-track curved deck girder bridge, green' },
  { id: 'bridge-r481-15-gray', sku: '20-472', name: 'R481-15 Curved Deck Girder Bridge Gray', kind: 'curve', secondaryKinds: ['Bridge'], radius: 481, angle: 15, color: '#777777', bridgeStyle: 'deck-girder', notes: 'Single-track curved deck girder bridge, gray' },
  { id: 'bridge-s248', sku: '20-435', name: 'S248 Truss Bridge', kind: 'straight', secondaryKinds: ['Bridge'], length: 248, color: '#777777', bridgeStyle: 'truss', notes: 'Bridge section with straight truss connection geometry' }
];

export function partLabel(p: TrackPart) {
  const secondary = p.secondaryKinds?.length ? ` • ${p.secondaryKinds.join('/')}` : '';
  if (p.kind === 'straight') {
    const terminal = p.isTerminal ? ' • bumper stop' : '';
    if (p.minLength !== undefined && p.maxLength !== undefined) return `${p.name} • ${p.minLength}-${p.maxLength}mm${terminal}${secondary}`;
    return `${p.name} • ${p.length ?? 0}mm${terminal}${secondary}`;
  }
  if (p.kind === 'curve') {
    const radiusLabel = p.radius2 ? `R${p.radius}/${p.radius2}` : `R${p.radius}`;
    return `${p.name} • ${radiusLabel}/${p.angle}°${secondary}`;
  }
  if (p.kind === 'turnout') return `${p.name} • ${p.diverging} • 3 connection points${secondary}`;
  if (p.kind === 'crossing') return `${p.name} • 4 connection points${secondary}`;
  if (p.kind === 'building') return `${p.name} • ${p.width ?? 0}×${p.depth ?? 0}mm footprint${secondary}`;
  if (p.kind === 'shape') {
    if (p.shapeType === 'rectangle') return `${p.name} • ${p.shapeWidth ?? 100}×${p.shapeHeight ?? 60}mm rectangle`;
    if (p.shapeType === 'triangle') return `${p.name} • ${p.shapeSide ?? 80}mm triangle`;
    if (p.shapeType === 'circle') return `${p.name} • ${p.shapeDiameter ?? 75}mm circle`;
    return `${p.name} • custom shape`;
  }
  return `${p.name}${secondary}`;
}
