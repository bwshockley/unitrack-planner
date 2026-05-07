'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Clipboard, ClipboardPaste, Download, Eye, EyeOff, FileSpreadsheet, FlipHorizontal2, FolderOpen, Grid3X3, Lock, Maximize2, Moon, MousePointer2, Plus, RotateCcw, RotateCw, Save, Sun, Trash2, Unlock, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { PRIMARY_TRACK_KINDS, SECONDARY_TRACK_KINDS, UNITRACK_PARTS, partLabel, SecondaryTrackKind, TrackKind, TrackPart } from '@/lib/unitrack';
import { clamp, connectors, degToRad, isDoubleTrack, isExpansionTrack, nodeHeight, norm, partLength, PlacedTrack, Pose, snap } from '@/lib/geometry';
import { TrackShape } from '@/lib/renderers/TrackShape';

const PX_PER_MM = 1.15;
const BOARD_W = 1800;
const BOARD_H = 1000;
const GRID = 33;
const SNAP_DISTANCE_MM = 24;
type Tool = 'select' | 'place';
type Theme = 'dark' | 'light';
type RenderDetail = 'high' | 'low';
type PartFilter = 'all' | TrackKind | SecondaryTrackKind;
type PartFilterMode = 'and' | 'or';
type GhostTrack = { partId: string; x: number; y: number; rotation: number; flip?: boolean; layerId?: string } | null;
type RunSuggestion = { label: string; gap: number; error: number; parts: { partId: string; length: number }[] };
type LayoutLayer = { id: string; name: string; visible: boolean; locked: boolean };
type LayoutSnapshot = { items: PlacedTrack[]; layers: LayoutLayer[]; activeLayerId: string; selectedUids: string[] };
type StockRow = { sku: string; name: string; required: number; owned: number; purchase: number; kind: string };
type DialogState =
  | { kind: 'save-layout'; fileName: string }
  | { kind: 'save-palette'; fileName: string }
  | null;
const BASE_LAYER_ID = 'base';

function uid() { return Math.random().toString(36).slice(2, 10); }
function mm(v: number) { return v * PX_PER_MM; }
function fromPx(v: number) { return v / PX_PER_MM; }

export default function Page() {
  const [tool, setTool] = useState<Tool>('place');
  const [selectedPartId, setSelectedPartId] = useState('s248');
  const [theme, setTheme] = useState<Theme>('light');
  const [renderDetail, setRenderDetail] = useState<RenderDetail>('high');
  const [mounted, setMounted] = useState(false);
  const [shapeColors, setShapeColors] = useState<string[]>([]);
  const [partFilters, setPartFilters] = useState<PartFilter[]>([]);
  const [partFilterMode, setPartFilterMode] = useState<PartFilterMode>('or');
  const [parts, setParts] = useState<TrackPart[]>(UNITRACK_PARTS);
  const [items, setItems] = useState<PlacedTrack[]>([]);
  const [ownedStock, setOwnedStock] = useState<Record<string, number>>({});
  const [layers, setLayers] = useState<LayoutLayer[]>([{ id: BASE_LAYER_ID, name: 'Layer 1', visible: true, locked: false }]);
  const [activeLayerId, setActiveLayerId] = useState(BASE_LAYER_ID);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<{ uid: string; key: string } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showHeightProfile, setShowHeightProfile] = useState(false);
  const [gradeStartHeight, setGradeStartHeight] = useState('0');
  const [gradeEndHeight, setGradeEndHeight] = useState('0');
  const [frameSize, setFrameSize] = useState({ width: 900, height: 600 });
  const [message, setMessage] = useState('Drag a part from the palette onto the grid. Turnouts and crossovers now expose every connection point.');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [zoom, setZoom] = useState(1);
  const [ghost, setGhost] = useState<GhostTrack>(null);
  const [runSuggestions, setRunSuggestions] = useState<RunSuggestion[]>([]);
  const [dropPartId, setDropPartId] = useState<string | null>(null);
  const drag = useRef<{ uids: string[]; startX: number; startY: number; origins: Record<string, { x: number; y: number }> } | null>(null);
  const resizeDrag = useRef<{ uid: string; handle: 'start' | 'end'; startLength: number; startX: number; startY: number; startItemX: number; startItemY: number; rotation: number; flip?: boolean; min: number; max: number } | null>(null);
  const boxDrag = useRef<{ x: number; y: number } | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const paletteFileRef = useRef<HTMLInputElement | null>(null);
  const stockFileRef = useRef<HTMLInputElement | null>(null);
  const copiedItemsRef = useRef<PlacedTrack[]>([]);
  const historyPastRef = useRef<LayoutSnapshot[]>([]);
  const historyFutureRef = useRef<LayoutSnapshot[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  function makeSnapshot(): LayoutSnapshot {
    return {
      items: items.map(item => ({ ...item })),
      layers: layers.map(layer => ({ ...layer })),
      activeLayerId,
      selectedUids: [...selectedUids],
    };
  }

  function recordHistory() {
    historyPastRef.current = [...historyPastRef.current.slice(-79), makeSnapshot()];
    historyFutureRef.current = [];
    setHistoryTick(t => t + 1);
  }

  function restoreSnapshot(snapshot: LayoutSnapshot) {
    setItems(snapshot.items.map(item => ({ ...item })));
    setLayers(snapshot.layers.map(layer => ({ ...layer })));
    setActiveLayerId(snapshot.activeLayerId);
    setSelectedUids([...snapshot.selectedUids]);
  }

  function undoChange() {
    const previous = historyPastRef.current.pop();
    if (!previous) { setMessage('Nothing to undo.'); return; }
    historyFutureRef.current = [makeSnapshot(), ...historyFutureRef.current.slice(0, 79)];
    restoreSnapshot(previous);
    setRunSuggestions([]);
    setMessage('Undid last change.');
    setHistoryTick(t => t + 1);
  }

  function redoChange() {
    const next = historyFutureRef.current.shift();
    if (!next) { setMessage('Nothing to redo.'); return; }
    historyPastRef.current = [...historyPastRef.current.slice(-79), makeSnapshot()];
    restoreSnapshot(next);
    setRunSuggestions([]);
    setMessage('Redid last undone change.');
    setHistoryTick(t => t + 1);
  }

  const canUndo = historyPastRef.current.length > 0;
  const canRedo = historyFutureRef.current.length > 0;


  useEffect(() => {
    setMounted(true);
    const rootStyle = getComputedStyle(document.documentElement);
    const cssShapeColors = Array.from({ length: 16 }, (_, i) =>
      rootStyle.getPropertyValue(`--shape-color-${i + 1}`).trim()
    ).filter(Boolean);
    setShapeColors(cssShapeColors);
  }, []);
  useEffect(() => {
    const frame = canvasFrameRef.current;
    if (!frame) return;
    const update = () => setFrameSize({ width: frame.clientWidth || 900, height: frame.clientHeight || 600 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!selectedNode) return;
    const item = items.find(i => i.uid === selectedNode.uid);
    if (!item || !selectedUids.includes(selectedNode.uid)) setSelectedNode(null);
  }, [items, selectedUids, selectedNode]);

  const partMap = useMemo(() => new Map(parts.map(p => [p.id, p])), [parts]);
  const layerMap = useMemo(() => new Map(layers.map(layer => [layer.id, layer])), [layers]);
  const getItemLayer = (item: Pick<PlacedTrack, 'layerId'>) => layerMap.get(item.layerId ?? BASE_LAYER_ID) ?? layers[0];
  const isItemVisible = (item: Pick<PlacedTrack, 'layerId'>) => getItemLayer(item)?.visible !== false;
  const isItemLocked = (item: Pick<PlacedTrack, 'layerId'>) => getItemLayer(item)?.locked === true;
  const visibleItems = useMemo(() => items.filter(item => isItemVisible(item)), [items, layerMap]);
  const editableVisibleItems = useMemo(() => visibleItems.filter(item => !isItemLocked(item)), [visibleItems, layerMap]);
  const layoutBounds = useMemo(() => {
    const points = visibleItems.flatMap(item => itemSelectionPoints(item));
    if (!points.length) return null;
    return points.reduce((bounds, pt) => ({
      minX: Math.min(bounds.minX, pt.x),
      minY: Math.min(bounds.minY, pt.y),
      maxX: Math.max(bounds.maxX, pt.x),
      maxY: Math.max(bounds.maxY, pt.y),
    }), { minX: points[0].x, minY: points[0].y, maxX: points[0].x, maxY: points[0].y });
  }, [visibleItems, partMap]);
  const canvasSize = useMemo(() => {
    const visibleWidthMm = frameSize.width / Math.max(PX_PER_MM * zoom, 0.01);
    const visibleHeightMm = frameSize.height / Math.max(PX_PER_MM * zoom, 0.01);
    const padding = GRID * 4;
    const contentWidth = layoutBounds ? Math.max(0, layoutBounds.maxX) + padding : GRID * 20;
    const contentHeight = layoutBounds ? Math.max(0, layoutBounds.maxY) + padding : GRID * 14;
    return {
      width: Math.ceil(Math.max(visibleWidthMm, contentWidth, GRID * 20) / GRID) * GRID,
      height: Math.ceil(Math.max(visibleHeightMm, contentHeight, GRID * 14) / GRID) * GRID,
    };
  }, [frameSize.width, frameSize.height, zoom, layoutBounds]);
  const filteredParts = useMemo(() => {
    if (partFilters.length === 0 || partFilters.includes('all')) return parts;
    const selectedFilters = partFilters.filter(filter => filter !== 'all');
    const partHasFilter = (part: TrackPart, filter: PartFilter) => part.kind === filter || part.secondaryKinds?.includes(filter as SecondaryTrackKind);
    return parts.filter(part => partFilterMode === 'and'
      ? selectedFilters.every(filter => partHasFilter(part, filter))
      : selectedFilters.some(filter => partHasFilter(part, filter)));
  }, [parts, partFilters, partFilterMode]);
  const isDark = theme === 'dark';
  const selectedUid = selectedUids[selectedUids.length - 1] ?? null;
  const selectedItem = items.find(i => i.uid === selectedUid);
  const inventory = useMemo(() => items.reduce<Record<string, number>>((a, i) => { a[i.partId] = (a[i.partId] ?? 0) + 1; return a; }, {}), [items]);
  const stockComparisonRows = useMemo<StockRow[]>(() => {
    const bySku = new Map<string, StockRow>();
    for (const [id, count] of Object.entries(inventory)) {
      const part = partMap.get(id);
      if (!part) continue;
      const sku = part.sku.trim();
      const existing = bySku.get(sku);
      if (existing) {
        existing.required += count;
        existing.purchase = Math.max(0, existing.required - existing.owned);
      } else {
        const owned = ownedStock[sku] ?? 0;
        bySku.set(sku, { sku, name: part.name, required: count, owned, purchase: Math.max(0, count - owned), kind: part.kind });
      }
    }
    return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
  }, [inventory, partMap, ownedStock]);
  const purchaseRows = useMemo(() => stockComparisonRows.filter(row => row.purchase > 0), [stockComparisonRows]);
  const connectionStatesByUid = useMemo(() => {
    const states = new Map<string, boolean[]>();
    const allPorts = visibleItems.flatMap(item => {
      const part = partMap.get(item.partId);
      if (!part) return [];
      const itemPorts = connectors(part, item).map((connector, index) => ({
        uid: item.uid,
        index,
        key: connector.key ?? String(index),
        x: connector.x,
        y: connector.y,
        heading: connector.heading,
        nodeKind: connector.nodeKind,
        partSku: connector.partSku,
        compatibilityTag: connector.compatibilityTag,
        compatibleTags: connector.compatibleTags,
        height: nodeHeight(item, connector.key ?? String(index)),
      }));
      states.set(item.uid, itemPorts.map(() => false));
      return itemPorts;
    });

    for (let a = 0; a < allPorts.length; a++) {
      for (let b = a + 1; b < allPorts.length; b++) {
        const pa = allPorts[a];
        const pb = allPorts[b];
        if (pa.uid === pb.uid) continue;
        if (!nodesCompatible(pa, pb)) continue;
        const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        const headingDelta = Math.abs(norm(pa.heading - pb.heading));
        const oppositeDelta = Math.min(Math.abs(headingDelta - 180), Math.abs(headingDelta + 180));
        const sameHeight = Math.abs((pa.height ?? 0) - (pb.height ?? 0)) <= 0.01;
        if (dist <= 3 && oppositeDelta <= 12 && sameHeight) {
          const aStates = states.get(pa.uid);
          const bStates = states.get(pb.uid);
          if (aStates) aStates[pa.index] = true;
          if (bStates) bStates[pb.index] = true;
        }
      }
    }

    return states;
  }, [visibleItems, partMap]);

  function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
    const rect = svg.getBoundingClientRect();
    const viewW = mm(canvasSize.width);
    const viewH = mm(canvasSize.height);
    const svgX = (clientX - rect.left) * (viewW / rect.width);
    const svgY = (clientY - rect.top) * (viewH / rect.height);
    return { x: fromPx(svgX), y: fromPx(svgY) };
  }

  function svgPoint(e: React.PointerEvent<SVGSVGElement>) {
    return svgPointFromClient(e.currentTarget, e.clientX, e.clientY);
  }

  function worldToItemLocal(point: { x: number; y: number }, item: Pick<PlacedTrack, 'x' | 'y' | 'rotation' | 'flip'>) {
    const dx = point.x - item.x;
    const dy = point.y - item.y;
    const r = degToRad(-item.rotation);
    const x = dx * Math.cos(r) - dy * Math.sin(r);
    const y = dx * Math.sin(r) + dy * Math.cos(r);
    return { x, y: item.flip ? -y : y };
  }

  function rotatePoint(point: Pose, angleDeg: number) {
    const r = degToRad(angleDeg);
    return {
      ...point,
      x: point.x * Math.cos(r) - point.y * Math.sin(r),
      y: point.x * Math.sin(r) + point.y * Math.cos(r),
      heading: norm(point.heading + angleDeg),
    };
  }

  function nodesCompatible(a: Pose, b: Pose) {
    // Platform/building connector nodes intentionally only mate with other platform nodes.
    // Track nodes have no nodeKind, so platform connectors are excluded from track snapping/validation.
    if (a.nodeKind === 'platform' || b.nodeKind === 'platform') {
      return a.nodeKind === 'platform' && b.nodeKind === 'platform';
    }
    if (a.compatibleTags && (!b.compatibilityTag || !a.compatibleTags.includes(b.compatibilityTag))) return false;
    if (b.compatibleTags && (!a.compatibilityTag || !b.compatibleTags.includes(a.compatibilityTag))) return false;
    return true;
  }

  function withUniformNodeHeight(part: TrackPart, item: PlacedTrack, height: number): PlacedTrack {
    const localPorts = connectors(part, { ...item, x: 0, y: 0, rotation: 0, flip: false });
    if (!localPorts.length) return item;
    const nodeHeights = { ...(item.nodeHeights ?? {}) };
    for (const [index, port] of localPorts.entries()) {
      nodeHeights[port.key ?? String(index)] = Number(height.toFixed(2));
    }
    return { ...item, nodeHeights };
  }

  function endpointSnap(candidate: PlacedTrack, sourceItems = visibleItems) {
    const part = partMap.get(candidate.partId)!;
    let best: { item: PlacedTrack; dist: number; portLabel?: string; targetHeight?: number } | null = null;

    for (const target of sourceItems.filter(i => i.uid !== candidate.uid && isItemVisible(i))) {
      const targetPart = partMap.get(target.partId)!;
      const targetConnectors = connectors(targetPart, target);
      const localCandidateConnectors = connectors(part, { ...candidate, x: 0, y: 0, rotation: 0 });

      for (const candidateConnector of localCandidateConnectors) {
        for (const [targetIndex, targetConnector] of targetConnectors.entries()) {
          if (!nodesCompatible(candidateConnector, targetConnector)) continue;
          const desiredRotation = norm(targetConnector.heading + 180 - candidateConnector.heading);
          const rotatedConnector = rotatePoint(candidateConnector, desiredRotation);
          const targetHeight = nodeHeight(target, targetConnector.key ?? String(targetIndex));
          const aligned = withUniformNodeHeight(part, {
            ...candidate,
            rotation: desiredRotation,
            x: targetConnector.x - rotatedConnector.x,
            y: targetConnector.y - rotatedConnector.y,
          }, targetHeight);
          const currentRotatedConnector = rotatePoint(candidateConnector, candidate.rotation);
          const currentConnector = {
            x: candidate.x + currentRotatedConnector.x,
            y: candidate.y + currentRotatedConnector.y,
          };
          const dist = Math.hypot(currentConnector.x - targetConnector.x, currentConnector.y - targetConnector.y);
          if (dist <= SNAP_DISTANCE_MM && (!best || dist < best.dist)) {
            best = { item: aligned, dist, portLabel: `${candidateConnector.label ?? 'port'} → ${targetConnector.label ?? 'port'}`, targetHeight };
          }
        }
      }
    }

    return best?.item ?? candidate;
  }

  function gridOrEndpointSnap(candidate: PlacedTrack, sourceItems = visibleItems, gridSnap = false) {
    const snapped = endpointSnap(candidate, sourceItems);
    if (snapped !== candidate) return snapped;
    return gridSnap ? { ...candidate, x: snap(candidate.x, GRID), y: snap(candidate.y, GRID) } : candidate;
  }

  function previewPart(partId: string, x: number, y: number, rotation = 0) {
    return gridOrEndpointSnap({ uid: 'ghost', partId, x, y, rotation, layerId: activeLayerId }, visibleItems, true);
  }

  function placePart(partId: string, x: number, y: number) {
    const activeLayer = layerMap.get(activeLayerId);
    if (!activeLayer || activeLayer.locked || activeLayer.visible === false) {
      setMessage("Choose a visible, unlocked active layer before placing track.");
      return;
    }
    const item = { ...previewPart(partId, x, y, 0), uid: uid(), layerId: activeLayerId };
    recordHistory();
    setItems(prev => [...prev, item]);
    setSelectedUids([item.uid]);
    setTool('select');
    setMessage('Piece placed. If it snapped to existing track, all of its nodes were set to the target elevation.');
  }

  function controlCopy() {
    if (selectedUids.length === 0) {
      setMessage('Select one or more placed track pieces before copying.');
      return;
    }
    const selected = new Set(selectedUids);
    copiedItemsRef.current = items.filter(item => selected.has(item.uid) && !isItemLocked(item)).map(item => ({ ...item }));
    setMessage(`Copied ${copiedItemsRef.current.length} track piece${copiedItemsRef.current.length === 1 ? '' : 's'}.`);
  }

  function controlPaste() {
    const copied = copiedItemsRef.current;
    if (!copied.length) {
      setMessage('Nothing copied yet. Select track pieces and use Copy first.');
      return;
    }
    const pasted = copied.map(item => ({ ...item, uid: uid(), x: item.x + GRID, y: item.y + GRID, layerId: activeLayerId }));
    recordHistory();
    setItems(prev => [...prev, ...pasted]);
    setSelectedUids(pasted.map(item => item.uid));
    setTool('select');
    setMessage(`Pasted ${pasted.length} copied track piece${pasted.length === 1 ? '' : 's'}.`);
  }


  function isPortConnected(port: Pose, ownerUid: string) {
    return visibleItems.some(other => {
      if (other.uid === ownerUid) return false;
      const otherPart = partMap.get(other.partId);
      if (!otherPart) return false;
      return connectors(otherPart, other).some(otherPort => {
        if (!nodesCompatible(port, otherPort)) return false;
        const dist = Math.hypot(port.x - otherPort.x, port.y - otherPort.y);
        const headingDelta = Math.abs(norm(port.heading - otherPort.heading));
        const oppositeDelta = Math.min(Math.abs(headingDelta - 180), Math.abs(headingDelta + 180));
        return dist <= 3 && oppositeDelta <= 12;
      });
    });
  }

  function straightSuggestionParts() {
    return parts
      .filter(part => part.kind === 'straight' && !part.isTerminal && !isDoubleTrack(part) && !part.secondaryKinds?.includes('Bridge') && !part.secondaryKinds?.includes('Viaduct'))
      .filter(part => (part.length && part.length > 0) || (part.minLength !== undefined && part.maxLength !== undefined))
      .sort((a, b) => (partLength(b) || 0) - (partLength(a) || 0));
  }

  function buildRunSuggestions(gap: number): RunSuggestion[] {
    const usable = straightSuggestionParts();
    const fixed = usable.filter(p => !(p.minLength !== undefined && p.maxLength !== undefined) && p.length).slice(0, 14);
    const expansion = usable.find(p => p.minLength !== undefined && p.maxLength !== undefined);
    const seen = new Set<string>();
    const suggestions: RunSuggestion[] = [];

    function add(partsToAdd: { partId: string; length: number }[]) {
      if (!partsToAdd.length) return;
      const total = partsToAdd.reduce((sum, part) => sum + part.length, 0);
      const error = Math.abs(total - gap);
      const key = partsToAdd.map(p => `${p.partId}:${p.length.toFixed(2)}`).join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const label = partsToAdd.map(({ partId, length }) => {
        const part = partMap.get(partId);
        const lengthLabel = Math.abs((part?.length ?? length) - length) > 0.1 ? ` @ ${length.toFixed(1)}mm` : '';
        return `${part?.sku ?? partId}${lengthLabel}`;
      }).join(' + ');
      suggestions.push({ label, gap, error, parts: partsToAdd });
    }

    const fixedLengths = fixed.map(part => ({ part, length: part.length ?? 0 }));
    for (const a of fixedLengths) add([{ partId: a.part.id, length: a.length }]);
    for (const a of fixedLengths) for (const b of fixedLengths) add([{ partId: a.part.id, length: a.length }, { partId: b.part.id, length: b.length }]);
    for (const a of fixedLengths) for (const b of fixedLengths) for (const c of fixedLengths) add([{ partId: a.part.id, length: a.length }, { partId: b.part.id, length: b.length }, { partId: c.part.id, length: c.length }]);

    if (expansion && expansion.minLength !== undefined && expansion.maxLength !== undefined) {
      const min = expansion.minLength;
      const max = expansion.maxLength;
      const expansionLength = clamp(gap, min, max);
      add([{ partId: expansion.id, length: expansionLength }]);
      for (const a of fixedLengths) {
        const remaining = gap - a.length;
        if (remaining >= min && remaining <= max) add([{ partId: a.part.id, length: a.length }, { partId: expansion.id, length: remaining }]);
      }
      for (const a of fixedLengths) for (const b of fixedLengths) {
        const remaining = gap - a.length - b.length;
        if (remaining >= min && remaining <= max) add([{ partId: a.part.id, length: a.length }, { partId: b.part.id, length: b.length }, { partId: expansion.id, length: remaining }]);
      }
    }

    return suggestions
      .sort((a, b) => a.error - b.error || a.parts.length - b.parts.length)
      .slice(0, 8);
  }

  function suggestGapFill() {
    const selected = new Set(selectedUids);
    const selectedPorts = visibleItems.flatMap(item => {
      if (!selected.has(item.uid) || isItemLocked(item)) return [];
      const part = partMap.get(item.partId);
      if (!part || part.kind === 'building' || part.kind === 'shape') return [];
      return connectors(part, item)
        .filter(port => port.nodeKind !== 'platform' && !isPortConnected(port, item.uid))
        .map(port => ({ ...port, uid: item.uid }));
    });

    if (selectedPorts.length < 2) {
      setRunSuggestions([]);
      setMessage('Select a chain with at least two open track endpoints, then try Suggest Gap Fill again.');
      return;
    }

    let bestPair: { a: Pose & { uid: string }; b: Pose & { uid: string }; score: number; gap: number; headingError: number } | null = null;
    for (let i = 0; i < selectedPorts.length; i++) {
      for (let j = i + 1; j < selectedPorts.length; j++) {
        const a = selectedPorts[i];
        const b = selectedPorts[j];
        if (!nodesCompatible(a, b)) continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        const headingDelta = Math.abs(norm(a.heading - b.heading));
        const headingError = Math.min(Math.abs(headingDelta - 180), Math.abs(headingDelta + 180));
        const score = headingError * 10 + gap;
        if (!bestPair || score < bestPair.score) bestPair = { a, b, score, gap, headingError };
      }
    }

    if (!bestPair) {
      setRunSuggestions([]);
      setMessage('No compatible pair of open track endpoints was found.');
      return;
    }

    const suggestions = buildRunSuggestions(bestPair.gap);
    setRunSuggestions(suggestions);
    setMessage(suggestions.length
      ? `Found ${suggestions.length} gap-fill suggestion${suggestions.length === 1 ? '' : 's'} for a ${bestPair.gap.toFixed(1)}mm gap${bestPair.headingError > 8 ? `; heading mismatch is ${bestPair.headingError.toFixed(1)}°` : ''}.`
      : `No straight-track combination found for the ${bestPair.gap.toFixed(1)}mm gap.`);
  }

  function insertRunSuggestion(suggestion: RunSuggestion) {
    const selected = new Set(selectedUids);
    const openPorts = visibleItems.flatMap(item => {
      if (!selected.has(item.uid) || isItemLocked(item)) return [];
      const part = partMap.get(item.partId);
      if (!part || part.kind === 'building' || part.kind === 'shape') return [];
      return connectors(part, item)
        .filter(port => port.nodeKind !== 'platform' && !isPortConnected(port, item.uid))
        .map(port => ({ ...port, uid: item.uid }));
    });
    if (openPorts.length < 2) { setMessage('Select the same open-ended chain before inserting a suggestion.'); return; }
    const start = openPorts[0];
    const heading = norm(start.heading + 180);
    const r = degToRad(heading);
    let cursorX = start.x;
    let cursorY = start.y;
    const newItems = suggestion.parts.map(({ partId, length }) => {
      const part = partMap.get(partId);
      const item: PlacedTrack = { uid: uid(), partId, x: cursorX, y: cursorY, rotation: heading, layerId: activeLayerId };
      if (part?.minLength !== undefined && part.maxLength !== undefined) item.customLength = clamp(length, part.minLength, part.maxLength);
      const actualLength = part ? partLength(part, item) : length;
      cursorX += actualLength * Math.cos(r);
      cursorY += actualLength * Math.sin(r);
      return item;
    });
    recordHistory();
    setItems(prev => [...prev, ...newItems]);
    setSelectedUids(newItems.map(item => item.uid));
    setRunSuggestions([]);
    setMessage(`Inserted ${newItems.length} suggested part${newItems.length === 1 ? '' : 's'} for the selected gap.`);
  }

  function rotateSelected(delta = 15) {
    if (selectedUids.length === 0) return;
    const selected = new Set(selectedUids);
    recordHistory();
    setItems(prev => prev.map(i => selected.has(i.uid) && !isItemLocked(i) ? gridOrEndpointSnap({ ...i, rotation: norm(i.rotation + delta) }, prev) : i));
  }

  function flipSelected() {
    if (selectedUids.length === 0) {
      setMessage('Select a part before flipping.');
      return;
    }
    const selected = new Set(selectedUids);
    const editableCount = items.filter(item => selected.has(item.uid) && !isItemLocked(item)).length;
    if (editableCount === 0) {
      setMessage('Selected pieces are locked and were not flipped.');
      return;
    }
    recordHistory();
    setItems(prev => prev.map(i => selected.has(i.uid) && !isItemLocked(i) ? gridOrEndpointSnap({ ...i, flip: !i.flip }, prev) : i));
    setMessage(`Flipped ${editableCount} selected piece${editableCount === 1 ? '' : 's'}.`);
  }

  function performDeleteSelected() {
    if (selectedUids.length === 0) return;
    const selected = new Set(selectedUids);
    const beforeCount = items.length;
    recordHistory();
    setItems(prev => prev.filter(i => !(selected.has(i.uid) && !isItemLocked(i))));
    setSelectedUids([]);
    setDialog(null);
    setMessage(beforeCount === items.length ? 'Selected pieces are locked and were not deleted.' : 'Deleted selected pieces.');
  }

  function deleteSelected() {
    performDeleteSelected();
  }

  function selectAllPlaced() {
    setSelectedUids(editableVisibleItems.map(i => i.uid));
    setTool('select');
    setMessage(editableVisibleItems.length ? `Selected all ${editableVisibleItems.length} editable visible pieces.` : 'No editable visible pieces to select.');
  }


  function nextLayerName(existingLayers: LayoutLayer[]) {
    const used = new Set(existingLayers.map(layer => layer.name));
    let index = 1;
    while (used.has(`Layer ${index}`)) index++;
    return `Layer ${index}`;
  }

  function addLayer() {
    const id = uid();
    recordHistory();
    setLayers(prev => {
      const nextName = nextLayerName(prev);
      setActiveLayerId(id);
      return [...prev, { id, name: nextName, visible: true, locked: false }];
    });
    setMessage("Added a new active layer.");
  }

  function removeLayer(layerId: string) {
    if (layers.length <= 1) { setMessage("At least one layer is required."); return; }
    const layer = layerMap.get(layerId);
    if (!layer) return;
    performRemoveLayer(layerId);
  }

  function performRemoveLayer(layerId: string) {
    if (layers.length <= 1) { setDialog(null); setMessage("At least one layer is required."); return; }
    recordHistory();
    const nextLayers = layers.filter(l => l.id !== layerId);
    if (!nextLayers.length) { setDialog(null); return; }
    const nextActive = activeLayerId === layerId ? nextLayers[0].id : activeLayerId;
    setLayers(nextLayers);
    setActiveLayerId(nextActive);
    setItems(prev => prev.filter(item => (item.layerId ?? BASE_LAYER_ID) !== layerId));
    setSelectedUids([]);
    setDialog(null);
    setMessage("Layer removed.");
  }

  function updateLayer(layerId: string, patch: Partial<LayoutLayer>) {
    recordHistory();
    setLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer));
    if (patch.visible === false || patch.locked === true) setSelectedUids(prev => prev.filter(uid => { const item = items.find(i => i.uid === uid); return item ? (item.layerId ?? BASE_LAYER_ID) !== layerId : false; }));
  }

  function moveLayer(layerId: string, direction: -1 | 1) {
    recordHistory();
    setLayers(prev => {
      const index = prev.findIndex(layer => layer.id === layerId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [layer] = next.splice(index, 1);
      next.splice(nextIndex, 0, layer);
      return next;
    });
  }

  function assignSelectedToLayer(layerId: string) {
    const targetLayer = layerMap.get(layerId);
    if (!targetLayer || targetLayer.locked) { setMessage("Cannot move parts to a locked layer."); return; }
    const selected = new Set(selectedUids);
    recordHistory();
    setItems(prev => prev.map(item => selected.has(item.uid) && !isItemLocked(item) ? { ...item, layerId } : item));
    setMessage(`Moved ${selectedUids.length} selected piece${selectedUids.length === 1 ? "" : "s"} to ${targetLayer.name}.`);
  }


  function updateSelectedShapeGeometry(patch: Partial<Pick<PlacedTrack, 'shapeWidth' | 'shapeHeight' | 'shapeSide' | 'shapeDiameter' | 'shapeColor'>>) {
    if (!selectedItem || isItemLocked(selectedItem)) return;
    recordHistory();
    setItems(prev => prev.map(item => item.uid === selectedItem.uid ? { ...item, ...patch } : item));
  }


  function trackRunLength(part: TrackPart, item?: PlacedTrack) {
    if (part.kind === 'building' || part.kind === 'shape') return 0;
    if (part.kind === 'curve') {
      const primary = (Math.PI * (part.radius ?? 0) * (part.angle ?? 0)) / 180;
      const secondary = isDoubleTrack(part) && part.radius2 ? (Math.PI * part.radius2 * (part.angle ?? 0)) / 180 : 0;
      return secondary ? (primary + secondary) / 2 : primary;
    }
    return partLength(part, item);
  }

  function updateNodeHeight(uid: string, key: string, height: number) {
    recordHistory();
    setItems(prev => prev.map(item => item.uid === uid && !isItemLocked(item)
      ? { ...item, nodeHeights: { ...(item.nodeHeights ?? {}), [key]: height } }
      : item));
  }

  function selectNodeForElevation(uid: string, key: string) {
    const item = items.find(i => i.uid === uid);
    if (!item || isItemLocked(item)) return;
    setSelectedUids([uid]);
    setSelectedNode({ uid, key });
    setTool('select');
    const part = partMap.get(item.partId);
    const port = part ? connectors(part, item).find((connector, index) => (connector.key ?? String(index)) === key) : undefined;
    setMessage(`Selected node ${port?.label ?? key} for elevation editing.`);
  }

  function nodeProgressWithinItem(part: TrackPart, item: PlacedTrack, connector: Pose) {
    const ports = connectors(part, item);
    if (ports.length <= 1) return 0;
    const theta = degToRad(item.rotation);
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const projections = ports.map(port => (port.x - item.x) * ux + (port.y - item.y) * uy);
    const min = Math.min(...projections);
    const max = Math.max(...projections);
    const span = Math.max(1, max - min);
    const projection = (connector.x - item.x) * ux + (connector.y - item.y) * uy;
    return clamp((projection - min) / span, 0, 1);
  }

  function applyLinearHeightToSelectedChain() {
    if (selectedUids.length < 2) {
      setMessage('Select a chain of at least two track parts before applying a height grade.');
      return;
    }
    const start = Number(gradeStartHeight);
    const end = Number(gradeEndHeight);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setMessage('Enter valid beginning and ending heights in millimeters.');
      return;
    }
    const chainItems = selectedUids
      .map(id => items.find(item => item.uid === id))
      .filter((item): item is PlacedTrack => !!item && !isItemLocked(item));
    const trackItems = chainItems.filter(item => {
      const part = partMap.get(item.partId);
      return part && part.kind !== 'building' && part.kind !== 'shape';
    });
    if (trackItems.length < 2) {
      setMessage('The selected chain needs at least two editable track parts.');
      return;
    }
    const lengths = trackItems.map(item => trackRunLength(partMap.get(item.partId)!, item));
    const total = Math.max(1, lengths.reduce((sum, length) => sum + length, 0));
    const baseByUid = new Map<string, number>();
    let running = 0;
    trackItems.forEach((item, index) => {
      baseByUid.set(item.uid, running);
      running += lengths[index];
    });
    recordHistory();
    setItems(prev => prev.map(item => {
      const base = baseByUid.get(item.uid);
      const part = partMap.get(item.partId);
      if (base === undefined || !part || isItemLocked(item)) return item;
      const length = trackRunLength(part, item);
      const nodeHeights = { ...(item.nodeHeights ?? {}) };
      connectors(part, item).forEach((connector, index) => {
        const key = connector.key ?? String(index);
        const progress = clamp((base + nodeProgressWithinItem(part, item, connector) * length) / total, 0, 1);
        nodeHeights[key] = Number((start + (end - start) * progress).toFixed(2));
      });
      return { ...item, nodeHeights };
    }));
    setMessage(`Applied a linear height grade from ${start}mm to ${end}mm across ${trackItems.length} selected track parts.`);
  }

  function visibleTrackPorts() {
    return visibleItems.flatMap(item => {
      const part = partMap.get(item.partId);
      if (!part || part.kind === 'building' || part.kind === 'shape') return [];
      return connectors(part, item).map((connector, index) => ({ item, part, connector, index, height: nodeHeight(item, connector.key ?? String(index)) }));
    });
  }

  function heightProfileView() {
    if (!showHeightProfile) return null;
    const ports = visibleTrackPorts();
    const minDisplayHeight = 140;
    if (!ports.length) {
      return <div className="subpanel border-t p-3 text-sm muted">Side Height View: place track parts to see their elevation profile.</div>;
    }

    // Use the same horizontal coordinate system and scale as the top-down SVG so
    // side-view X positions line up directly under the plan view.
    const scale = PX_PER_MM * zoom;
    const width = Math.max(frameSize.width, mm(canvasSize.width) * zoom);
    const minH = Math.min(0, ...ports.map(port => port.height));
    const maxH = Math.max(10, ...ports.map(port => port.height));
    const padMm = 18;
    const spanH = Math.max(1, maxH - minH);
    const profileHeight = Math.max(minDisplayHeight, (spanH + padMm * 2) * scale);
    const sx = (x: number) => x * scale;
    const sy = (h: number) => profileHeight - (padMm + (h - minH)) * scale;
    const selectedSet = new Set(selectedUids);

    const segmentGrade = (h1: number, h2: number, x1: number, y1: number, x2: number, y2: number) => {
      const run = Math.max(0.001, Math.hypot(x2 - x1, y2 - y1));
      return { grade: ((h2 - h1) / run) * 100, run, rise: h2 - h1 };
    };
    const gradeLabel = (grade: number) => `${grade >= 0 ? '+' : ''}${grade.toFixed(2)}%`;

    const selectedSegments = visibleItems.flatMap(item => {
      if (!selectedSet.has(item.uid)) return [];
      const part = partMap.get(item.partId);
      if (!part || part.kind === 'building' || part.kind === 'shape') return [];
      const sorted = connectors(part, item)
        .map((connector, index) => ({ connector, index, h: nodeHeight(item, connector.key ?? String(index)) }))
        .sort((a, b) => a.connector.x - b.connector.x);
      return sorted.slice(0, -1).map((port, idx) => {
        const next = sorted[idx + 1];
        return segmentGrade(port.h, next.h, port.connector.x, port.connector.y, next.connector.x, next.connector.y);
      });
    });
    const averageGrade = selectedSegments.length
      ? (selectedSegments.reduce((sum, segment) => sum + segment.rise, 0) / Math.max(0.001, selectedSegments.reduce((sum, segment) => sum + segment.run, 0))) * 100
      : null;

    return <div className="subpanel border-t p-2">
      <div className="mb-1 flex items-center justify-between text-xs muted">
        <span>Side Height View — horizontally aligned with plan view</span>
        <span>{minH.toFixed(1)}–{maxH.toFixed(1)} mm{selectedUids.length > 1 && averageGrade !== null ? ` • selected avg ${gradeLabel(averageGrade)}` : ''}</span>
      </div>
      <svg width={width} height={profileHeight} viewBox={`0 0 ${width} ${profileHeight}`} className="block">
        <line x1={0} y1={sy(0)} x2={width} y2={sy(0)} stroke="var(--grid-line)" strokeWidth="1" strokeDasharray="5 5" />
        <text x={6} y={sy(0) - 4} fill="var(--text-muted)" fontSize="10">0 mm</text>
        {showGrid && Array.from({ length: Math.floor(canvasSize.width / GRID) + 1 }, (_, i) => i * GRID).map(x => (
          <line key={`profile-grid-${x}`} x1={sx(x)} y1="0" x2={sx(x)} y2={profileHeight} stroke="var(--grid-line)" strokeWidth="0.6" opacity="0.45" />
        ))}
        {visibleItems.map(item => {
          const part = partMap.get(item.partId);
          if (!part || part.kind === 'building' || part.kind === 'shape') return null;
          const itemPorts = connectors(part, item);
          if (itemPorts.length < 2) return null;
          const sorted = itemPorts.map((connector, index) => ({ connector, index, h: nodeHeight(item, connector.key ?? String(index)) })).sort((a, b) => a.connector.x - b.connector.x);
          const points = sorted.map(port => `${sx(port.connector.x)},${sy(port.h)}`).join(' ');
          const isSelected = selectedSet.has(item.uid);
          const stroke = isSelected ? 'var(--rail-selected-stroke)' : 'var(--rail-stroke)';
          return <g key={`profile-${item.uid}`}>
            <polyline points={points} fill="none" stroke={stroke} strokeWidth={isSelected ? "2.5" : "2"} opacity={isSelected ? 1 : 0.72} />
            {selectedUids.length === 1 && isSelected && sorted.slice(0, -1).map((port, idx) => {
              const next = sorted[idx + 1];
              const midX = (sx(port.connector.x) + sx(next.connector.x)) / 2;
              const midY = (sy(port.h) + sy(next.h)) / 2 - 5;
              const segment = segmentGrade(port.h, next.h, port.connector.x, port.connector.y, next.connector.x, next.connector.y);
              return <text key={`${item.uid}-grade-${idx}`} x={midX} y={midY} fill="var(--text-strong)" fontSize="10" textAnchor="middle" paintOrder="stroke" stroke="var(--panel-bg)" strokeWidth="3">
                {gradeLabel(segment.grade)}
              </text>;
            })}
            {sorted.map(port => <circle key={`${item.uid}-${port.connector.key ?? port.index}`} cx={sx(port.connector.x)} cy={sy(port.h)} r="3.5" fill={isSelected ? 'var(--rail-selected-stroke)' : 'var(--connection-good)'} stroke="var(--connection-node-ring)" strokeWidth="1" />)}
          </g>;
        })}
        {selectedUids.length > 1 && averageGrade !== null && <g>
          <rect x="8" y="8" width="150" height="24" rx="8" fill="var(--panel-bg)" stroke="var(--panel-border)" />
          <text x="83" y="24" fill="var(--text-strong)" fontSize="12" textAnchor="middle">Avg grade {gradeLabel(averageGrade)}</text>
        </g>}
      </svg>
    </div>;
  }

  async function importBuildingSvg(file: File, uidToUpdate: string) {
    const svgText = await file.text();
    if (!/<svg[\s>]/i.test(svgText)) {
      setMessage('That file does not look like a valid SVG. Choose an .svg file for the building artwork.');
      return;
    }
    recordHistory();
    setItems(prev => prev.map(item => item.uid === uidToUpdate && !isItemLocked(item) ? { ...item, buildingSvg: svgText } : item));
    setMessage('Building SVG artwork loaded. It will be saved with the layout.');
  }

  function removeBuildingSvg(uidToUpdate: string) {
    recordHistory();
    setItems(prev => prev.map(item => item.uid === uidToUpdate && !isItemLocked(item) ? { ...item, buildingSvg: undefined } : item));
    setMessage('Building SVG artwork removed.');
  }

  function cleanDownloadName(name: string, fallbackBase: string, extension: string) {
    const trimmed = name.trim() || fallbackBase;
    const withoutExtension = trimmed.replace(new RegExp(`${extension.replace('.', '\\.')}$`, 'i'), '');
    const safe = withoutExtension.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || fallbackBase;
    return `${safe}${extension}`;
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportJson() {
    setDialog({ kind: 'save-layout', fileName: 'unitrack-layout' });
  }

  function exportJsonNow(fileName: string) {
    const blob = new Blob([JSON.stringify({ version: 4, items, layers, activeLayerId }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, cleanDownloadName(fileName, 'unitrack-layout', '.json'));
    setDialog(null);
    setMessage('Layout saved.');
  }

  function csvCell(value: string | number | boolean | undefined) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function parseCsv(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else {
        if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (ch !== '\r') cell += ch;
      }
    }
    row.push(cell);
    if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows;
  }

  function parseMaybeNumber(value: string | undefined) {
    if (!value || value.trim() === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  function buildPaletteCsv() {
    const header = ['id', 'sku', 'name', 'kind', 'secondaryKinds', 'length', 'minLength', 'maxLength', 'radius', 'radius2', 'angle', 'diverging', 'trackCenters', 'color', 'bridgeStyle', 'isTerminal', 'width', 'depth', 'buildingStyle', 'shapeType', 'shapeWidth', 'shapeHeight', 'shapeSide', 'shapeDiameter', 'notes'];
    return [header, ...parts.map(part => [
      part.id, part.sku, part.name, part.kind, part.secondaryKinds?.join('|') ?? '', part.length, part.minLength, part.maxLength, part.radius, part.radius2, part.angle, part.diverging, part.trackCenters, part.color, part.bridgeStyle, part.isTerminal, part.width, part.depth, part.buildingStyle, part.shapeType, part.shapeWidth, part.shapeHeight, part.shapeSide, part.shapeDiameter, part.notes
    ])].map(row => row.map(csvCell).join(',')).join('\n');
  }

  function exportPaletteCsv() {
    setDialog({ kind: 'save-palette', fileName: 'unitrack-parts-palette' });
  }

  function exportPaletteCsvNow(fileName: string) {
    const blob = new Blob([buildPaletteCsv()], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, cleanDownloadName(fileName, 'unitrack-parts-palette', '.csv'));
    setDialog(null);
    setMessage('Track palette saved.');
  }

  async function importPaletteCsv(file: File) {
    const rows = parseCsv(await file.text());
    const [header, ...data] = rows;
    if (!header) return;
    const index = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
    const read = (row: string[], key: string) => row[index.get(key) ?? -1]?.trim() ?? '';
    const validKinds = new Set<TrackKind>(PRIMARY_TRACK_KINDS);
    const validSecondaryKinds = new Set<SecondaryTrackKind>(SECONDARY_TRACK_KINDS);
    const imported = data.map((row): TrackPart | null => {
      const kind = read(row, 'kind') as TrackKind;
      const id = read(row, 'id');
      const sku = read(row, 'sku');
      const name = read(row, 'name');
      if (!id || !sku || !name || !validKinds.has(kind)) return null;
      const secondaryKinds = read(row, 'secondarykinds')
        .split(/[|;]+/)
        .map(k => k.trim())
        .filter((k): k is SecondaryTrackKind => validSecondaryKinds.has(k as SecondaryTrackKind));
      return {
        id,
        sku,
        name,
        kind,
        secondaryKinds: secondaryKinds.length ? secondaryKinds : undefined,
        length: parseMaybeNumber(read(row, 'length')),
        minLength: parseMaybeNumber(read(row, 'minlength')),
        maxLength: parseMaybeNumber(read(row, 'maxlength')),
        radius: parseMaybeNumber(read(row, 'radius')),
        radius2: parseMaybeNumber(read(row, 'radius2')),
        angle: parseMaybeNumber(read(row, 'angle')),
        diverging: ['left', 'right', 'wye'].includes(read(row, 'diverging')) ? read(row, 'diverging') as 'left' | 'right' | 'wye' : undefined,
        trackCenters: parseMaybeNumber(read(row, 'trackcenters')),
        color: read(row, 'color') || undefined,
        bridgeStyle: ['truss', 'plate-girder', 'deck-girder'].includes(read(row, 'bridgestyle')) ? read(row, 'bridgestyle') as 'truss' | 'plate-girder' | 'deck-girder' : undefined,
        isTerminal: ['true', '1', 'yes', 'y'].includes(read(row, 'isterminal').toLowerCase()) || undefined,
        width: parseMaybeNumber(read(row, 'width')),
        depth: parseMaybeNumber(read(row, 'depth')),
        buildingStyle: ['station', 'platform', 'generic'].includes(read(row, 'buildingstyle')) ? read(row, 'buildingstyle') as 'station' | 'platform' | 'generic' : undefined,
        shapeType: ['rectangle', 'triangle', 'circle'].includes(read(row, 'shapetype')) ? read(row, 'shapetype') as 'rectangle' | 'triangle' | 'circle' : undefined,
        shapeWidth: parseMaybeNumber(read(row, 'shapewidth')),
        shapeHeight: parseMaybeNumber(read(row, 'shapeheight')),
        shapeSide: parseMaybeNumber(read(row, 'shapeside')),
        shapeDiameter: parseMaybeNumber(read(row, 'shapediameter')),
        notes: read(row, 'notes') || undefined,
      };
    }).filter((part): part is TrackPart => !!part);
    if (!imported.length) {
      setMessage('No valid parts found in the imported palette CSV.');
      return;
    }
    recordHistory();
    setParts(imported);
    setSelectedPartId(imported[0].id);
    setPartFilters([]);
    setItems(prev => prev.filter(item => imported.some(part => part.id === item.partId)));
    setSelectedUids([]);
    setMessage(`Imported ${imported.length} parts into the track palette.`);
  }

  function resetPalette() {
    setParts(UNITRACK_PARTS);
    setSelectedPartId(UNITRACK_PARTS[0].id);
    setPartFilters([]);
    setMessage('Restored the default KATO Unitrack parts palette.');
  }

  function exportBomCsv() {
    const header = ['SKU', 'Name', 'Category', 'Required', 'Owned', 'Need to Purchase'];
    const csv = [header, ...stockComparisonRows.map(row => [row.sku, row.name, row.kind, row.required, row.owned, row.purchase])]
      .map(row => row.map(csvCell).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, 'unitrack-bill-of-materials.csv');
  }

  function exportPurchaseCsv() {
    const header = ['SKU', 'Name', 'Required', 'Owned', 'Need to Purchase'];
    const csv = [header, ...purchaseRows.map(row => [row.sku, row.name, row.required, row.owned, row.purchase])]
      .map(row => row.map(csvCell).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, 'unitrack-purchase-list.csv');
  }

  async function importStockCsv(file: File) {
    const rows = parseCsv(await file.text()).filter(row => row.some(cell => cell.trim() !== ''));
    if (!rows.length) {
      setMessage('Stock CSV was empty.');
      return;
    }

    const header = rows[0].map(cell => cell.trim().toLowerCase());
    const hasHeader = header.some(cell => ['sku', 'part', 'partid', 'part id', 'quantity', 'qty', 'count', 'owned'].includes(cell));
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const foundSkuIndex = hasHeader ? Math.max(header.indexOf('sku'), header.indexOf('part'), header.indexOf('partid'), header.indexOf('part id')) : 0;
    const skuIndex = foundSkuIndex >= 0 ? foundSkuIndex : 0;
    const foundQuantityIndex = hasHeader ? [header.indexOf('quantity'), header.indexOf('qty'), header.indexOf('count'), header.indexOf('owned')].find(index => index >= 0) : undefined;
    const quantityIndex = foundQuantityIndex ?? 1;

    const next: Record<string, number> = {};
    for (const row of dataRows) {
      const sku = String(row[skuIndex] ?? '').trim();
      if (!sku) continue;
      const qty = Math.max(0, Math.floor(Number(row[quantityIndex] ?? 0) || 0));
      next[sku] = (next[sku] ?? 0) + qty;
    }

    setOwnedStock(next);
    setMessage(`Imported owned stock for ${Object.keys(next).length} SKU${Object.keys(next).length === 1 ? '' : 's'}.`);
  }


  async function importJson(file: File) {
    const data = JSON.parse(await file.text());
    const importedLayers: LayoutLayer[] = Array.isArray(data.layers) && data.layers.length
      ? data.layers.map((layer: any, index: number) => ({ id: String(layer.id || uid()), name: String(layer.name || `Layer ${index + 1}`), visible: layer.visible !== false, locked: !!layer.locked }))
      : [{ id: BASE_LAYER_ID, name: 'Base', visible: true, locked: false }];
    const validLayerIds = new Set(importedLayers.map(layer => layer.id));
    const fallbackLayerId = importedLayers[0].id;
    const importedItems = (data.items ?? []).map((item: PlacedTrack) => ({ ...item, layerId: validLayerIds.has(item.layerId ?? '') ? item.layerId : fallbackLayerId }));
    recordHistory();
    setLayers(importedLayers);
    setActiveLayerId(validLayerIds.has(data.activeLayerId) ? data.activeLayerId : fallbackLayerId);
    setItems(importedItems);
    setSelectedUids([]);
    setMessage('Loaded layout JSON.');
  }

  function zoomToFitLayout() {
    const frame = canvasFrameRef.current;
    if (!frame) return;

    if (!layoutBounds || visibleItems.length === 0) {
      setZoom(1);
      requestAnimationFrame(() => frame.scrollTo({ left: 0, top: 0, behavior: 'smooth' }));
      setMessage('No placed parts yet. Reset zoom to 100%.');
      return;
    }

    const paddingMm = GRID * 2;
    const minX = Math.max(0, layoutBounds.minX - paddingMm);
    const minY = Math.max(0, layoutBounds.minY - paddingMm);
    const layoutWidthMm = Math.max(GRID, layoutBounds.maxX - layoutBounds.minX + paddingMm * 2);
    const layoutHeightMm = Math.max(GRID, layoutBounds.maxY - layoutBounds.minY + paddingMm * 2);
    const paddingPx = 28;
    const usableWidth = Math.max(1, frame.clientWidth - paddingPx * 2);
    const usableHeight = Math.max(1, frame.clientHeight - paddingPx * 2);
    const fitZoom = Math.min(usableWidth / mm(layoutWidthMm), usableHeight / mm(layoutHeightMm));
    const clampedZoom = Math.max(0.2, Math.min(5, fitZoom));

    setZoom(Number(clampedZoom.toFixed(2)));
    requestAnimationFrame(() => {
      frame.scrollTo({ left: Math.max(0, mm(minX) * clampedZoom), top: Math.max(0, mm(minY) * clampedZoom), behavior: 'smooth' });
    });
    setMessage('Zoomed to fit all placed parts in the visible grid area.');
  }


  function selectUid(uid: string, additive = false) {
    setSelectedUids(prev => {
      if (additive) return prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid];
      return [uid];
    });
  }

  function itemSelectionPoints(item: PlacedTrack) {
    const part = partMap.get(item.partId)!;
    if (part.kind === 'building' || part.kind === 'shape') {
      let w = part.width ?? 80;
      let d = part.depth ?? 50;
      if (part.kind === 'shape') {
        if (part.shapeType === 'circle') {
          const diameter = item.shapeDiameter ?? part.shapeDiameter ?? 75;
          w = diameter;
          d = diameter;
        } else if (part.shapeType === 'triangle') {
          const side = item.shapeSide ?? part.shapeSide ?? 80;
          w = side;
          d = side * Math.sqrt(3) / 2;
        } else {
          w = item.shapeWidth ?? part.shapeWidth ?? 100;
          d = item.shapeHeight ?? part.shapeHeight ?? 60;
        }
      }
      const r = degToRad(item.rotation);
      const flip = item.flip ? -1 : 1;
      const local = [
        { x: 0, y: 0 },
        { x: -w / 2, y: -d / 2 },
        { x: w / 2, y: -d / 2 },
        { x: -w / 2, y: d / 2 },
        { x: w / 2, y: d / 2 },
      ];
      return local.map(pt => {
        const y = pt.y * flip;
        return { x: item.x + pt.x * Math.cos(r) - y * Math.sin(r), y: item.y + pt.x * Math.sin(r) + y * Math.cos(r) };
      });
    }
    return [{ x: item.x, y: item.y }, ...connectors(part, item).map(c => ({ x: c.x, y: c.y }))];
  }

  function selectItemsInBox(box: { x1: number; y1: number; x2: number; y2: number }) {
    const minX = Math.min(box.x1, box.x2);
    const maxX = Math.max(box.x1, box.x2);
    const minY = Math.min(box.y1, box.y2);
    const maxY = Math.max(box.y1, box.y2);
    const picked = editableVisibleItems
      .filter(item => itemSelectionPoints(item).some(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY))
      .map(item => item.uid);
    setSelectedUids(picked);
    setMessage(picked.length ? `Selected ${picked.length} pieces.` : 'No editable visible pieces inside selection box.');
  }

  function buildConnectivityGraph() {
    const graph = new Map<string, Set<string>>();
    for (const item of visibleItems) graph.set(item.uid, new Set());
    const ports = visibleItems.flatMap(item => {
      const part = partMap.get(item.partId)!;
      return connectors(part, item).map(c => ({ uid: item.uid, x: c.x, y: c.y, heading: c.heading, nodeKind: c.nodeKind, partSku: c.partSku, compatibilityTag: c.compatibilityTag, compatibleTags: c.compatibleTags }));
    });
    for (let a = 0; a < ports.length; a++) {
      for (let b = a + 1; b < ports.length; b++) {
        const pa = ports[a];
        const pb = ports[b];
        if (pa.uid === pb.uid) continue;
        if (!nodesCompatible(pa, pb)) continue;
        const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        const headingDelta = Math.abs(norm(pa.heading - pb.heading));
        const oppositeDelta = Math.min(Math.abs(headingDelta - 180), Math.abs(headingDelta + 180));
        if (dist <= 3 && oppositeDelta <= 12) {
          graph.get(pa.uid)?.add(pb.uid);
          graph.get(pb.uid)?.add(pa.uid);
        }
      }
    }
    return graph;
  }

  function selectChainTo(endUid: string) {
    const startUid = selectedUid;
    if (!startUid || startUid === endUid) { setSelectedUids([endUid]); return; }
    const graph = buildConnectivityGraph();
    const queue = [startUid];
    const parent = new Map<string, string | null>([[startUid, null]]);
    while (queue.length) {
      const current = queue.shift()!;
      if (current === endUid) break;
      for (const next of graph.get(current) ?? []) if (!parent.has(next)) { parent.set(next, current); queue.push(next); }
    }
    if (!parent.has(endUid)) { setSelectedUids([startUid, endUid]); setMessage('No connected chain found; selected the two clicked pieces.'); return; }
    const path: string[] = [];
    for (let cur: string | null = endUid; cur; cur = parent.get(cur) ?? null) path.push(cur);
    setSelectedUids(path.reverse());
    setMessage(`Selected ${path.length} connected pieces in the chain.`);
  }

  function beginResizeExpansion(e: React.PointerEvent<SVGCircleElement>, item: PlacedTrack, handle: 'start' | 'end') {
    e.stopPropagation();
    const part = partMap.get(item.partId);
    if (!part || !isExpansionTrack(part) || isItemLocked(item) || !isItemVisible(item)) return;
    const length = partLength(part, item);
    recordHistory();
    resizeDrag.current = {
      uid: item.uid,
      handle,
      startLength: length,
      startX: item.x,
      startY: item.y,
      startItemX: item.x,
      startItemY: item.y,
      rotation: item.rotation,
      flip: item.flip,
      min: part.minLength ?? 78,
      max: part.maxLength ?? 108,
    };
    setTool('select');
    setGhost(null);
    setSelectedUids([item.uid]);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function expansionResizeHandles() {
    if (selectedUids.length !== 1) return null;
    const item = items.find(i => i.uid === selectedUids[0]);
    if (!item || !isItemVisible(item) || isItemLocked(item)) return null;
    const part = partMap.get(item.partId);
    if (!part || !isExpansionTrack(part)) return null;
    const length = partLength(part, item);
    const ends = connectors(part, item);
    const start = ends.find(end => end.key === 'a') ?? ends[0];
    const end = ends.find(end => end.key === 'b') ?? ends[1];
    if (!start || !end) return null;
    return <g pointerEvents="all">
      {[{ port: start, handle: 'start' as const }, { port: end, handle: 'end' as const }].map(({ port, handle }) => (
        <g key={handle} transform={`translate(${mm(port.x)} ${mm(port.y)})`}>
          <circle r="8" fill="var(--selection-stroke)" stroke="var(--panel-bg)" strokeWidth="2" className="cursor-ew-resize" onPointerDown={e => beginResizeExpansion(e, item, handle)} />
          <line x1="-5" y1="0" x2="5" y2="0" stroke="var(--panel-bg)" strokeWidth="2" pointerEvents="none" />
        </g>
      ))}
      <text x={mm((start.x + end.x) / 2)} y={mm((start.y + end.y) / 2 - 16)} textAnchor="middle" className="pointer-events-none select-none" fill="var(--text-strong)" stroke="var(--panel-bg)" strokeWidth="3" paintOrder="stroke" fontSize="12">{Math.round(length)}mm</text>
    </g>;
  }

  function beginItemDrag(e: React.PointerEvent<SVGGElement>, item: PlacedTrack) {
    e.stopPropagation();
    if (!isItemVisible(item) || isItemLocked(item)) { setMessage(isItemLocked(item) ? 'That layer is locked. Unlock it to edit those tracks.' : 'That layer is hidden.'); return; }
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    setTool('select');
    setGhost(null);
    if (e.shiftKey) { selectChainTo(item.uid); return; }
    const additive = e.ctrlKey || e.metaKey;
    let dragUids = selectedUids.includes(item.uid) && !additive ? selectedUids : [item.uid];
    if (additive) {
      selectUid(item.uid, true);
      dragUids = selectedUids.includes(item.uid) ? selectedUids.filter(id => id !== item.uid) : [...selectedUids, item.uid];
    } else setSelectedUids(dragUids);
    dragUids = dragUids.filter(id => { const draggedItem = items.find(i => i.uid === id); return draggedItem ? isItemVisible(draggedItem) && !isItemLocked(draggedItem) : false; });
    if (dragUids.length === 0) return;
    recordHistory();
    const svg = e.currentTarget.ownerSVGElement as SVGSVGElement;
    const p = svgPointFromClient(svg, e.clientX, e.clientY);
    const dragSet = new Set(dragUids);
    drag.current = { uids: dragUids, startX: p.x, startY: p.y, origins: Object.fromEntries(items.filter(i => dragSet.has(i.uid)).map(i => [i.uid, { x: i.x, y: i.y }])) };
  }

  const totalLength = items.reduce((sum, i) => {
    const p = partMap.get(i.partId);
    if (!p) return sum;
    if (p.kind === 'building' || p.kind === 'shape') return sum;
    if (p.kind === 'curve') {
      const base = (Math.PI * (p.radius ?? 0) * (p.angle ?? 0)) / 180;
      const second = isDoubleTrack(p) && p.radius2 ? (Math.PI * p.radius2 * (p.angle ?? 0)) / 180 : 0;
      return sum + base + second;
    }
    if (p.kind === 'crossing') return sum + 2 * (p.length ?? 0);
    if (p.kind === 'turnout') return sum + (p.length ?? 0) + ((Math.PI * (p.radius ?? 0) * (p.angle ?? 0)) / 180);
    return sum + (isDoubleTrack(p) ? 2 : 1) * partLength(p, i);
  }, 0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
      if (isTyping) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoChange(); else undoChange();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoChange();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        controlCopy();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        controlPaste();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedUids.length > 0) {
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedUids, items, layers, activeLayerId]);

  function dialogTitle() {
    if (!dialog) return '';
    if (dialog.kind === 'save-layout') return 'Name layout file';
    return 'Name palette file';
  }

  function dialogBody() {
    if (!dialog) return null;
    const extension = dialog.kind === 'save-layout' ? '.json' : '.csv';
    return <label className="block text-sm">
      <span className="muted mb-2 block">File name</span>
      <input
        autoFocus
        value={dialog.fileName}
        onChange={e => setDialog({ ...dialog, fileName: e.target.value })}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (dialog.kind === 'save-layout') exportJsonNow(dialog.fileName);
            else exportPaletteCsvNow(dialog.fileName);
          }
        }}
        className="field w-full rounded-xl px-3 py-2"
      />
      <span className="muted mt-2 block text-xs">The file will be saved as {cleanDownloadName(dialog.fileName, dialog.kind === 'save-layout' ? 'unitrack-layout' : 'unitrack-parts-palette', extension)}.</span>
    </label>;
  }

  function confirmDialogAction() {
    if (!dialog) return;
    if (dialog.kind === 'save-layout') exportJsonNow(dialog.fileName);
    else if (dialog.kind === 'save-palette') exportPaletteCsvNow(dialog.fileName);
  }

  if (!mounted) {
    return <main className="app-shell theme-light h-screen overflow-hidden" />;
  }

  return <main className={`app-shell theme-${theme} flex h-screen flex-col overflow-hidden`}>
    <header className="app-header relative shrink-0 overflow-hidden border-b px-4 py-3">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold tracking-normal">KATO N-Scale Unitrack Planner</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className={`ui-button ui-button-md theme-toggle btn rounded-xl px-3 py-2 text-sm font-medium ${isDark ? 'theme-toggle-dark' : 'theme-toggle-light'}`}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {isDark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
            </span>
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
          <button onClick={exportJson} className="ui-button ui-button-md rounded-xl btn-primary px-3 py-2 text-sm font-medium"><Save className="h-4 w-4"/>Save</button>
          <label className="ui-button ui-button-md rounded-xl btn px-3 py-2 text-sm font-medium"><FolderOpen className="h-4 w-4"/>Load<input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importJson(e.target.files[0])}/></label>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button onClick={() => setShowGrid(!showGrid)} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"><Grid3X3 className="h-4 w-4"/>Grid {showGrid ? 'on' : 'off'}</button>
        <button onClick={() => setShowHeightProfile(v => !v)} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm">Side View {showHeightProfile ? 'on' : 'off'}</button>
        <button
          onClick={() => setRenderDetail(detail => detail === 'high' ? 'low' : 'high')}
          className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"
          aria-pressed={renderDetail === 'high'}
          title={renderDetail === 'high' ? 'Switch to low detail rendering' : 'Switch to high detail rendering'}
        >
          {renderDetail === 'high' ? <Eye className="h-4 w-4"/> : <EyeOff className="h-4 w-4"/>}
          Detail {renderDetail === 'high' ? 'high' : 'low'}
        </button>
        <button onClick={() => setZoom(z => Math.max(0.35, Number((z - 0.1).toFixed(2))))} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"><ZoomOut className="h-4 w-4"/></button>
        <span className="subpanel rounded-xl px-3 py-2 text-sm muted">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(5, Number((z + 0.1).toFixed(2))))} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"><ZoomIn className="h-4 w-4"/></button>
        <button onClick={zoomToFitLayout} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"><Maximize2 className="h-4 w-4"/>Fit</button>
        <button onClick={undoChange} disabled={!canUndo} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-4 w-4"/>Undo</button>
        <button onClick={redoChange} disabled={!canRedo} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"><RotateCw className="h-4 w-4"/>Redo</button>
        <button onClick={() => rotateSelected(15)} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"><RotateCcw className="h-4 w-4"/>15°</button>
        <button onClick={() => rotateSelected(90)} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"><RotateCcw className="h-4 w-4"/>90°</button>
        <button onClick={flipSelected} disabled={selectedUids.length === 0} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"><FlipHorizontal2 className="h-4 w-4"/>Flip</button>
        <button onClick={selectAllPlaced} disabled={items.length === 0} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Select All</button>
        <button onClick={controlCopy} disabled={selectedUids.length === 0} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"><Clipboard className="h-4 w-4"/>Copy</button>
        <button onClick={controlPaste} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm"><ClipboardPaste className="h-4 w-4"/>Paste</button>
        <button onClick={suggestGapFill} disabled={selectedUids.length < 2} className="ui-button ui-button-md btn rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Suggest Gap Fill</button>
        <button onClick={deleteSelected} className="ui-button ui-button-md btn-danger rounded-xl px-3 py-2 text-sm"><Trash2 className="h-4 w-4"/>Delete</button>
        <span className="min-w-[180px] flex-1 truncate text-sm muted">{message}</span>
      </div>
    </header>

    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[270px_minmax(0,1fr)_280px] gap-3 overflow-hidden p-3">
      <aside className="panel flex min-h-0 flex-col rounded-2xl border p-3">
        <h2 className="mb-2 shrink-0 text-base font-semibold">Parts Palette</h2>
        <div className="mb-2 grid shrink-0 grid-cols-3 gap-1">
          <button onClick={exportPaletteCsv} className="ui-button ui-button-sm btn rounded-xl px-2 py-2 text-[11px]"><Download className="h-3.5 w-3.5"/>Export</button>
          <button onClick={() => paletteFileRef.current?.click()} className="ui-button ui-button-sm btn rounded-xl px-2 py-2 text-[11px]"><Upload className="h-3.5 w-3.5"/>Import</button>
          <button onClick={resetPalette} className="ui-button ui-button-sm btn rounded-xl px-2 py-2 text-[11px]">Reset</button>
          <input ref={paletteFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) importPaletteCsv(file); e.currentTarget.value = ''; }} />
        </div>
        <div className="mb-2 grid shrink-0 grid-cols-2 gap-2">
          <button onClick={() => setTool('place')} className={`ui-button ui-button-md rounded-xl px-3 py-2 text-sm ${tool === 'place' ? 'btn-success' : 'btn'}`}>Place</button>
          <button onClick={() => setTool('select')} className={`ui-button ui-button-md rounded-xl px-3 py-2 text-sm ${tool === 'select' ? 'btn-success' : 'btn'}`}><MousePointer2 className="h-4 w-4"/>Select</button>
        </div>
        <div className="group mb-2 shrink-0 rounded-xl border border-transparent p-1 transition hover:border-[var(--panel-border)] focus-within:border-[var(--panel-border)]">
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <h3 className="text-sm font-semibold">Filter Parts</h3>
            <span className="muted truncate text-[11px]">
              {partFilters.length === 0 || partFilters.includes('all') ? 'All parts' : `${partFilterMode.toUpperCase()} ${partFilters.length} filter${partFilters.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-h-96 group-hover:opacity-100 group-focus-within:max-h-96 group-focus-within:opacity-100">
            <div className="flex items-center justify-end pb-2 pt-1">
              <div className="subpanel flex rounded-xl p-1 text-[11px]" role="group" aria-label="Part filter matching mode">
                <button
                  type="button"
                  onClick={() => setPartFilterMode('and')}
                  className={`rounded-lg px-2 py-1 font-semibold ${partFilterMode === 'and' ? 'btn-primary' : 'muted'}`}
                  title="Show only parts that match every selected filter"
                >AND</button>
                <button
                  type="button"
                  onClick={() => setPartFilterMode('or')}
                  className={`rounded-lg px-2 py-1 font-semibold ${partFilterMode === 'or' ? 'btn-primary' : 'muted'}`}
                  title="Show parts that match any selected filter"
                >OR</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['all', ...PRIMARY_TRACK_KINDS, ...SECONDARY_TRACK_KINDS] as PartFilter[]).map(filter => {
                const active = filter === 'all' ? partFilters.length === 0 || partFilters.includes('all') : partFilters.includes(filter);
                return <button
                  key={filter}
                  onClick={() => setPartFilters(prev => {
                    if (filter === 'all') return [];
                    const next = prev.filter(f => f !== 'all');
                    return next.includes(filter) ? next.filter(f => f !== filter) : [...next, filter];
                  })}
                  className={`rounded-xl px-2 py-2 text-xs ${active ? 'btn-primary' : 'btn'}`}
                >{filter === 'all' ? 'All' : String(filter).charAt(0).toUpperCase() + String(filter).slice(1)}</button>;
              })}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {filteredParts.map(p => <button
            key={p.id}
            draggable
            onDragStart={e => {
              setSelectedPartId(p.id);
              setDropPartId(p.id);
              setTool('place');
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('application/unitrack-part', p.id);
              e.dataTransfer.setData('text/plain', p.id);
            }}
            onDragEnd={() => { setGhost(null); setDropPartId(null); }}
            onClick={() => { setSelectedPartId(p.id); setTool('place'); }}
            className={`w-full cursor-grab rounded-xl border p-2 text-left text-xs transition active:cursor-grabbing ${selectedPartId === p.id ? 'part-card-selected' : 'part-card'}`}
          >
            <div className="font-semibold">{p.sku} {p.name}</div>
            <div className="muted">{partLabel(p)}</div>
          </button>)}
        </div>
      </aside>

      <section className="panel flex min-h-0 min-w-0 flex-col rounded-2xl border p-3">
        {runSuggestions.length > 0 && <div className="subpanel mb-2 rounded-xl p-2 text-xs">
          <div className="mb-1 flex items-center justify-between gap-2">
            <b>Auto-complete track run suggestions</b>
            <button onClick={() => setRunSuggestions([])} className="ui-button ui-button-sm btn rounded-lg px-2 py-1 text-xs">Clear</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {runSuggestions.map((suggestion, idx) => (
              <button key={`${suggestion.label}-${idx}`} onClick={() => insertRunSuggestion(suggestion)} className="ui-button ui-button-sm btn rounded-lg px-2 py-1 text-xs">
                {suggestion.label} <span className="muted">Δ {suggestion.error.toFixed(1)}mm</span>
              </button>
            ))}
          </div>
        </div>}
        <div ref={canvasFrameRef} className="canvas-frame min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border">
          <svg
            className="block"
            width={Math.max(frameSize.width, mm(canvasSize.width) * zoom)}
            height={Math.max(frameSize.height, mm(canvasSize.height) * zoom)}
            viewBox={`0 0 ${mm(canvasSize.width)} ${mm(canvasSize.height)}`}
            onDragOver={e => {
              e.preventDefault();
              const svg = e.currentTarget;
              const partId = e.dataTransfer.getData('application/unitrack-part') || dropPartId || selectedPartId;
              const p = svgPointFromClient(svg, e.clientX, e.clientY);
              setGhost(previewPart(partId, p.x, p.y, 0));
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={e => {
              if (e.currentTarget === e.target) setGhost(null);
            }}
            onDrop={e => {
              e.preventDefault();
              const partId = e.dataTransfer.getData('application/unitrack-part') || dropPartId || selectedPartId;
              const p = svgPointFromClient(e.currentTarget, e.clientX, e.clientY);
              setGhost(null);
              setDropPartId(null);
              placePart(partId, p.x, p.y);
            }}
            onPointerMove={e => {
              const p = svgPoint(e);
              const activeResize = resizeDrag.current;
              if (activeResize) {
                const item = items.find(i => i.uid === activeResize.uid);
                if (!item) return;
                const local = worldToItemLocal(p, { x: activeResize.startItemX, y: activeResize.startItemY, rotation: activeResize.rotation, flip: activeResize.flip });
                setItems(prev => prev.map(existing => {
                  if (existing.uid !== activeResize.uid) return existing;
                  if (activeResize.handle === 'end') {
                    return { ...existing, customLength: clamp(local.x, activeResize.min, activeResize.max) };
                  }
                  const rawLength = activeResize.startLength - local.x;
                  const newLength = clamp(rawLength, activeResize.min, activeResize.max);
                  const shift = activeResize.startLength - newLength;
                  const direction = degToRad(activeResize.rotation);
                  return {
                    ...existing,
                    x: activeResize.startItemX + shift * Math.cos(direction),
                    y: activeResize.startItemY + shift * Math.sin(direction),
                    customLength: newLength,
                  };
                }));
                return;
              }
              const activeDrag = drag.current;
              if (activeDrag) {
                const dx = p.x - activeDrag.startX;
                const dy = p.y - activeDrag.startY;
                const moving = new Set(activeDrag.uids);
                const isSingleDrag = activeDrag.uids.length === 1;
                const origins = activeDrag.origins;
                setItems(prev => prev.map(i => {
                  if (!moving.has(i.uid)) return i;
                  const origin = origins[i.uid];
                  if (!origin) return i;
                  const candidate = { ...i, x: origin.x + dx, y: origin.y + dy };
                  return isSingleDrag ? gridOrEndpointSnap(candidate, prev) : candidate;
                }));
                return;
              }
              if (boxDrag.current) {
                setSelectionBox({ x1: boxDrag.current.x, y1: boxDrag.current.y, x2: p.x, y2: p.y });
                return;
              }
              if (tool === 'place') setGhost(previewPart(selectedPartId, p.x, p.y, 0));
            }}
            onPointerLeave={() => { if (!dropPartId) setGhost(null); }}
            onPointerDown={e => {
              if (e.target === e.currentTarget && tool === 'place') {
                const p = svgPoint(e); placePart(selectedPartId, p.x, p.y);
              } else if (e.target === e.currentTarget) {
                if (tool === 'select') {
                  const p = svgPoint(e);
                  boxDrag.current = { x: p.x, y: p.y };
                  setSelectionBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
                } else {
                  setSelectedUids([]);
                }
              }
            }}
            onPointerUp={() => {
              drag.current = null;
              resizeDrag.current = null;
              if (boxDrag.current && selectionBox) selectItemsInBox(selectionBox);
              boxDrag.current = null;
              setSelectionBox(null);
            }}
          >
            {showGrid && <defs><pattern id="grid" width={mm(GRID)} height={mm(GRID)} patternUnits="userSpaceOnUse"><path d={`M ${mm(GRID)} 0 L 0 0 0 ${mm(GRID)}`} fill="none" stroke="var(--grid-line)" strokeWidth="1" /></pattern></defs>}
            {showGrid && <rect width={mm(canvasSize.width)} height={mm(canvasSize.height)} fill="url(#grid)" pointerEvents="none" />}
            {selectionBox && <rect
              x={mm(Math.min(selectionBox.x1, selectionBox.x2))}
              y={mm(Math.min(selectionBox.y1, selectionBox.y2))}
              width={mm(Math.abs(selectionBox.x2 - selectionBox.x1))}
              height={mm(Math.abs(selectionBox.y2 - selectionBox.y1))}
              fill="var(--selection-fill)"
              fillOpacity="0.12"
              stroke="var(--selection-stroke)"
              strokeWidth="2"
              strokeDasharray="6 6"
              pointerEvents="none"
            />}
            {layers.flatMap(layer => items.filter(item => (item.layerId ?? BASE_LAYER_ID) === layer.id && layer.visible).map(item => {
              const p = partMap.get(item.partId)!;
              return <TrackShape key={`${item.uid}-body`} part={p} item={item} selected={selectedUids.includes(item.uid)} layer="both" renderDetail={renderDetail} onPointerDown={e => beginItemDrag(e, item)} />;
            }))}
            {ghost && partMap.has(ghost.partId) && layerMap.get(ghost.layerId ?? activeLayerId)?.visible !== false && <TrackShape part={partMap.get(ghost.partId)!} item={ghost} ghost layer="both" renderDetail={renderDetail} />}
            {layers.flatMap(layer => items.filter(item => (item.layerId ?? BASE_LAYER_ID) === layer.id && layer.visible).map(item => {
              const p = partMap.get(item.partId)!;
              const isSelected = selectedUids.includes(item.uid);
              return <TrackShape
                key={`${item.uid}-markers`}
                part={p}
                item={item}
                selected={isSelected}
                layer="markers"
                connectionStates={connectionStatesByUid.get(item.uid)}
                selectedNodeKey={selectedNode?.uid === item.uid ? selectedNode.key : null}
                onNodeClick={selectNodeForElevation}
              />;
            }))}
            {expansionResizeHandles()}
          </svg>
          {heightProfileView()}
        </div>
      </section>

      <aside className="panel flex min-h-0 flex-col overflow-hidden rounded-2xl border p-3">
        <div className="shrink-0">
          <h2 className="mb-2 text-base font-semibold">Layout Stats</h2>
          <div className="subpanel space-y-2 rounded-xl p-3 text-sm">
            <div className="flex justify-between"><span>Pieces</span><b>{items.length}</b></div>
            <div className="flex justify-between"><span>Track length</span><b>{Math.round(totalLength)} mm</b></div>
          </div>


          <h2 className="mb-2 mt-4 flex items-center justify-between gap-2 text-base font-semibold"><span>Layers</span><button onClick={addLayer} className="ui-button ui-button-sm btn rounded-lg px-2 py-1 text-xs"><Plus className="h-3.5 w-3.5"/>Add</button></h2>
          <div className="subpanel max-h-56 space-y-1 overflow-auto rounded-xl p-2 text-xs">
            {layers.map((layer, index) => {
              const count = items.filter(item => (item.layerId ?? BASE_LAYER_ID) === layer.id).length;
              const isActive = layer.id === activeLayerId;
              const isEditing = editingLayerId === layer.id;
              return <div key={layer.id} className={`rounded-lg border px-2 py-1.5 ${isActive ? 'part-card-selected' : 'part-card'}`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setActiveLayerId(layer.id); setMessage(`Active layer: ${layer.name}`); }}
                    className="h-7 w-7 shrink-0 rounded-md text-xs font-semibold"
                    title={`Set ${layer.name} as active layer`}
                  >
                    {isActive ? '●' : '○'}
                  </button>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={layer.name}
                      onChange={e => updateLayer(layer.id, { name: e.target.value || `Layer ${index + 1}` })}
                      onBlur={() => setEditingLayerId(null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="field min-w-0 flex-1 rounded-md px-2 py-1 font-semibold"
                    />
                  ) : (
                    <button
                      onClick={() => { setActiveLayerId(layer.id); setMessage(`Active layer: ${layer.name}`); }}
                      onDoubleClick={() => setEditingLayerId(layer.id)}
                      className="min-w-0 flex-1 truncate text-left font-semibold"
                      title="Click to make active; double-click to rename"
                    >
                      {layer.name}
                    </button>
                  )}
                  <span className="muted shrink-0 text-right text-[11px]" title={`${count} piece${count === 1 ? '' : 's'}`}>{count} pc</span>
                </div>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <button onClick={() => setEditingLayerId(layer.id)} className="ui-button ui-button-sm btn rounded-md px-1.5 py-1 text-[10px]" title="Rename layer">Edit</button>
                  <button onClick={() => updateLayer(layer.id, { visible: !layer.visible })} className="ui-button ui-button-sm btn rounded-md px-1 py-1" title={layer.visible ? 'Hide layer' : 'Show layer'}>{layer.visible ? <Eye className="h-3.5 w-3.5"/> : <EyeOff className="h-3.5 w-3.5"/>}</button>
                  <button onClick={() => updateLayer(layer.id, { locked: !layer.locked })} className="ui-button ui-button-sm btn rounded-md px-1 py-1" title={layer.locked ? 'Unlock layer' : 'Lock layer'}>{layer.locked ? <Lock className="h-3.5 w-3.5"/> : <Unlock className="h-3.5 w-3.5"/>}</button>
                  <button onClick={() => moveLayer(layer.id, -1)} disabled={index === 0} className="ui-button ui-button-sm btn rounded-md px-1 py-1 disabled:opacity-40" title="Move layer up"><ArrowUp className="h-3.5 w-3.5"/></button>
                  <button onClick={() => moveLayer(layer.id, 1)} disabled={index === layers.length - 1} className="ui-button ui-button-sm btn rounded-md px-1 py-1 disabled:opacity-40" title="Move layer down"><ArrowDown className="h-3.5 w-3.5"/></button>
                  <button onClick={() => removeLayer(layer.id)} disabled={layers.length <= 1} className="ui-button ui-button-sm btn-danger rounded-md px-1 py-1 disabled:opacity-40" title="Delete layer"><Trash2 className="h-3.5 w-3.5"/></button>
                </div>
              </div>;
            })}
            {selectedUids.length > 0 && <label className="muted block pt-1">Move selected to layer<select onChange={e => e.target.value && assignSelectedToLayer(e.target.value)} value="" className="field mt-1 w-full rounded-lg px-2 py-1"><option value="">Choose layer…</option>{layers.filter(layer => !layer.locked).map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>}
          </div>

          <h2 className="mb-2 mt-4 text-base font-semibold">Selected</h2>
          <div className="subpanel rounded-xl p-3 text-sm muted">
            {selectedUids.length > 1 ? <>
              <div className="strong font-semibold">{selectedUids.length} pieces selected</div>
              <div>Drag any selected piece to move the group.</div>
              <div>Rotate, grid snap, layer move, height grade, or delete applies to all selected pieces.</div>
              <label className="muted mt-2 block">Move selected to layer<select onChange={e => e.target.value && assignSelectedToLayer(e.target.value)} value="" className="field mt-1 w-full rounded-lg px-2 py-1"><option value="">Choose layer…</option>{layers.filter(layer => !layer.locked).map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
              <div className="mt-3 rounded-lg border border-dashed p-2">
                <div className="strong mb-1 font-semibold">Set chain height grade</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="muted block">Beginning height mm<input type="number" value={gradeStartHeight} onChange={e => setGradeStartHeight(e.target.value)} className="field mt-1 w-full rounded-lg px-2 py-1" /></label>
                  <label className="muted block">Ending height mm<input type="number" value={gradeEndHeight} onChange={e => setGradeEndHeight(e.target.value)} className="field mt-1 w-full rounded-lg px-2 py-1" /></label>
                </div>
                <button onClick={applyLinearHeightToSelectedChain} className="ui-button ui-button-md btn mt-2 rounded-lg px-3 py-2">Apply linear height</button>
              </div>
              <button onClick={() => { if (selectedUids.length) { recordHistory(); setItems(prev => prev.map(i => selectedUids.includes(i.uid) && !isItemLocked(i) ? gridOrEndpointSnap({ ...i, x: snap(i.x, GRID), y: snap(i.y, GRID) }, prev, true) : i)); } }} className="ui-button ui-button-md btn mt-2 rounded-lg px-3 py-2">Snap group to 33mm grid</button>
            </> : selectedItem ? <>
              <div className="strong font-semibold">{partMap.get(selectedItem.partId)?.sku} {partMap.get(selectedItem.partId)?.name}</div>
              <div>x {selectedItem.x.toFixed(1)} mm · y {selectedItem.y.toFixed(1)} mm</div>
              <div>rotation {selectedItem.rotation}°</div>
              <div>flipped {selectedItem.flip ? 'yes' : 'no'}</div>
              {isExpansionTrack(partMap.get(selectedItem.partId)!) && <div>adjusted length {partLength(partMap.get(selectedItem.partId)!, selectedItem).toFixed(1)} mm</div>}
              {partMap.get(selectedItem.partId)?.kind === 'building' && (() => {
                const disabled = isItemLocked(selectedItem);
                return <div className="mt-3 rounded-lg border border-dashed p-2">
                  <div className="strong mb-1 font-semibold">Building SVG artwork</div>
                  <p className="muted mb-2 text-xs">Upload an SVG to render inside this building footprint. The SVG scales to the part width/depth and is stored in the layout save file.</p>
                  <label className={`ui-button ui-button-sm btn inline-flex rounded-lg px-2 py-1 text-xs ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <Upload className="h-3.5 w-3.5"/>Load SVG
                    <input type="file" accept=".svg,image/svg+xml" disabled={disabled} className="hidden" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) importBuildingSvg(file, selectedItem.uid); e.currentTarget.value = ''; }} />
                  </label>
                  {selectedItem.buildingSvg && <button disabled={disabled} onClick={() => removeBuildingSvg(selectedItem.uid)} className="ui-button ui-button-sm btn-danger ml-2 rounded-lg px-2 py-1 text-xs disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>Remove SVG</button>}
                  <div className="muted mt-2 text-xs">{selectedItem.buildingSvg ? 'Custom SVG assigned.' : 'No custom SVG assigned.'}</div>
                </div>;
              })()}
              {partMap.get(selectedItem.partId)?.kind === 'shape' && (() => {
                const p = partMap.get(selectedItem.partId)!;
                const disabled = isItemLocked(selectedItem);
                const numberClass = "field mt-1 w-full rounded-lg px-2 py-1";
                const setPositive = (value: string, key: 'shapeWidth' | 'shapeHeight' | 'shapeSide' | 'shapeDiameter') => {
                  const next = Math.max(1, Number(value) || 1);
                  updateSelectedShapeGeometry({ [key]: next });
                };
                if (p.shapeType === 'circle') {
                  return <label className="muted mt-2 block">Diameter mm<input type="number" min="1" disabled={disabled} value={selectedItem.shapeDiameter ?? p.shapeDiameter ?? 75} onChange={e => setPositive(e.target.value, 'shapeDiameter')} className={numberClass} /></label>;
                }
                if (p.shapeType === 'triangle') {
                  return <label className="muted mt-2 block">Side length mm<input type="number" min="1" disabled={disabled} value={selectedItem.shapeSide ?? p.shapeSide ?? 80} onChange={e => setPositive(e.target.value, 'shapeSide')} className={numberClass} /></label>;
                }
                return <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="muted block">Width mm<input type="number" min="1" disabled={disabled} value={selectedItem.shapeWidth ?? p.shapeWidth ?? 100} onChange={e => setPositive(e.target.value, 'shapeWidth')} className={numberClass} /></label>
                  <label className="muted block">Height mm<input type="number" min="1" disabled={disabled} value={selectedItem.shapeHeight ?? p.shapeHeight ?? 60} onChange={e => setPositive(e.target.value, 'shapeHeight')} className={numberClass} /></label>
                </div>;
              })()}
              {partMap.get(selectedItem.partId)?.kind === 'shape' && (() => {
                const p = partMap.get(selectedItem.partId)!;
                const disabled = isItemLocked(selectedItem);
                const activeColor = selectedItem.shapeColor || p.color || '#94a3b8';
                return <div className="mt-3">
                  <div className="muted mb-1">Shape color</div>
                  <div className="grid grid-cols-8 gap-1">
                    {shapeColors.map(color => <button
                      key={color}
                      type="button"
                      disabled={disabled}
                      onClick={() => updateSelectedShapeGeometry({ shapeColor: color })}
                      className={`h-6 rounded-md border ${activeColor.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-offset-1 ring-offset-transparent' : ''}`}
                      style={{ backgroundColor: color, borderColor: color === '#ffffff' ? '#999999' : color }}
                      aria-label={`Set shape color ${color}`}
                    />)}
                  </div>
                </div>;
              })()}

              {(() => {
                const p = partMap.get(selectedItem.partId)!;
                const ports = connectors(p, selectedItem);
                if (p.kind === 'building' || p.kind === 'shape' || ports.length === 0) return null;
                const disabled = isItemLocked(selectedItem);
                return <div className="mt-3 rounded-lg border border-dashed p-2">
                  <div className="strong mb-1 font-semibold">Node heights</div>
                  <div className="space-y-1">
                    {ports.map((port, index) => {
                      const key = port.key ?? String(index);
                      const isActiveNode = selectedNode?.uid === selectedItem.uid && selectedNode.key === key;
                      return <label key={key} className={`grid grid-cols-[1fr_88px] items-center gap-2 rounded-md px-1 py-0.5 text-xs ${isActiveNode ? 'bg-[var(--selected-bg)] strong' : 'muted'}`}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => selectNodeForElevation(selectedItem.uid, key)}
                          className="truncate text-left"
                          title="Highlight this node on the top-down view"
                        >{port.label ?? key}{isActiveNode ? ' • selected' : ''}</button>
                        <input type="number" disabled={disabled} value={nodeHeight(selectedItem, key)} onChange={e => updateNodeHeight(selectedItem.uid, key, Number(e.target.value) || 0)} className="field rounded-lg px-2 py-1" />
                      </label>;
                    })}
                  </div>
                  <p className="muted mt-2 text-xs">Selected track nodes show A/B markers on the top-down view. Click A or B to edit its elevation here.</p>
                </div>;
              })()}
              <div>{partMap.get(selectedItem.partId)?.kind === 'building' ? 'nodes' : partMap.get(selectedItem.partId)?.kind === 'shape' ? 'nodes' : 'ports'} {connectors(partMap.get(selectedItem.partId)!, selectedItem).length}</div>
              <div>layer {getItemLayer(selectedItem)?.name ?? 'Base'}</div>
              <label className="muted mt-2 block">Move to layer<select value={selectedItem.layerId ?? BASE_LAYER_ID} onChange={e => assignSelectedToLayer(e.target.value)} className="field mt-1 w-full rounded-lg px-2 py-1">{layers.filter(layer => !layer.locked).map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
              <button onClick={() => { if (selectedUids.length) { recordHistory(); setItems(prev => prev.map(i => selectedUids.includes(i.uid) && !isItemLocked(i) ? gridOrEndpointSnap({ ...i, x: snap(i.x, GRID), y: snap(i.y, GRID) }, prev, true) : i)); } }} className="ui-button ui-button-md btn mt-2 rounded-lg px-3 py-2">Snap to 33mm grid</button>
            </> : 'No piece selected.'}
          </div>
        </div>

        <div className="mb-2 mt-4 flex shrink-0 flex-col items-start gap-2">
          <h2 className="text-base font-semibold">Bill of Materials</h2>
          <div className="flex shrink-0 flex-wrap gap-1">
            <details className="relative">
              <summary className="ui-button ui-button-sm btn cursor-pointer list-none rounded-lg px-2 py-1 text-xs [&::-webkit-details-marker]:hidden">
                <Download className="h-4 w-4"/>Export<ChevronDown className="h-3.5 w-3.5"/>
              </summary>
              <div className="panel absolute right-0 z-20 mt-1 w-44 rounded-xl border p-1 shadow-xl">
                <button onClick={exportBomCsv} disabled={stockComparisonRows.length === 0} className="ui-button ui-button-sm btn w-full justify-start rounded-lg px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"><FileSpreadsheet className="h-4 w-4"/>BOM CSV</button>
                <button onClick={exportPurchaseCsv} disabled={purchaseRows.length === 0} className="ui-button ui-button-sm btn mt-1 w-full justify-start rounded-lg px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4"/>Buy CSV</button>
              </div>
            </details>
            <details className="relative">
              <summary className="ui-button ui-button-sm btn cursor-pointer list-none rounded-lg px-2 py-1 text-xs [&::-webkit-details-marker]:hidden">
                <Upload className="h-4 w-4"/>Stock<ChevronDown className="h-3.5 w-3.5"/>
              </summary>
              <div className="panel absolute right-0 z-20 mt-1 w-44 rounded-xl border p-1 shadow-xl">
                <button onClick={() => stockFileRef.current?.click()} className="ui-button ui-button-sm btn w-full justify-start rounded-lg px-2 py-1 text-xs"><Upload className="h-4 w-4"/>Import Stock</button>
                <button onClick={() => { setOwnedStock({}); setMessage('Cleared imported stock quantities.'); }} disabled={Object.keys(ownedStock).length === 0} className="ui-button ui-button-sm btn mt-1 w-full justify-start rounded-lg px-2 py-1 text-xs disabled:opacity-50"><Trash2 className="h-4 w-4"/>Clear Stock</button>
              </div>
            </details>
          </div>
        </div>
        <div className="muted mb-2 flex shrink-0 items-center justify-end text-[11px]">
          {Object.keys(ownedStock).length} SKU owned
          <input ref={stockFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) importStockCsv(file); e.currentTarget.value = ''; }} />
        </div>
        <div className="subpanel min-h-0 flex-1 overflow-auto rounded-xl p-3 text-sm">
          {stockComparisonRows.length === 0 ? <p className="muted">Place track to generate a parts list. Import stock CSV columns as SKU, Quantity to compare owned inventory.</p> : <div className="space-y-2">
            <div className="muted grid grid-cols-[minmax(0,1fr)_44px_44px_44px] gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <span>Part</span><span className="text-right">Need</span><span className="text-right">Own</span><span className="text-right">Buy</span>
            </div>
            {stockComparisonRows.map(row => (
              <div key={row.sku} className="bom-row grid grid-cols-[minmax(0,1fr)_44px_44px_44px] items-center gap-2 border-b pb-2">
                <span className="min-w-0 truncate" title={row.name}>{row.sku} {row.name}</span>
                <b className="text-right">×{row.required}</b>
                <span className="text-right">{row.owned}</span>
                <b className={`text-right ${row.purchase > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{row.purchase}</b>
              </div>
            ))}
          </div>}
        </div>
      </aside>
    </div>
    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="planner-dialog-title" onPointerDown={e => { if (e.currentTarget === e.target) setDialog(null); }}>
      <div className="panel w-full max-w-md rounded-2xl border p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="planner-dialog-title" className="text-lg font-semibold">{dialogTitle()}</h2>
            {dialog.kind === 'save-layout' && <p className="muted mt-1 text-xs">Choose a name before saving the layout JSON.</p>}
            {dialog.kind === 'save-palette' && <p className="muted mt-1 text-xs">Choose a name before saving the palette CSV.</p>}
          </div>
          <button onClick={() => setDialog(null)} className="ui-button ui-button-sm btn rounded-lg px-2 py-1 text-xs" aria-label="Close dialog">×</button>
        </div>
        <div className="subpanel rounded-xl p-3">{dialogBody()}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setDialog(null)} className="ui-button ui-button-md btn rounded-xl px-4 py-2 text-sm">Cancel</button>
          <button onClick={confirmDialogAction} className="ui-button ui-button-md btn-primary rounded-xl px-4 py-2 text-sm font-medium">
            Save
          </button>
        </div>
      </div>
    </div>}
  </main>;
}
