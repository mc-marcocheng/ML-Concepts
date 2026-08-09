import { CATEGORIES } from './categories';
import type { ConceptGraph, GraphNode } from './graph';

export const ROADMAP = {
  minNodeWidth: 224,
  maxNodeWidth: 320,
  nodeHeight: 116,
  compactNodeHeight: 92,
  gapX: 32,
  gapY: 60,
  wave: 18,
  sectionHeader: 66,
  sectionGap: 64,
  padY: 8,
  maxCols: 4,
} as const;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  col: number;
  index: number;
  sectionIndex: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  kind: 'same' | 'cross' | 'back';
}

export interface LayoutSegment {
  id: string;
  from: string;
  to: string;
  d: string;
}

export interface LayoutSection {
  id: string;
  title: string;
  short: string;
  index: number;
  y: number;
  height: number;
  ids: string[];
}

export interface RoadmapLayout {
  width: number;
  height: number;
  cols: number;
  nodeWidth: number;
  nodeHeight: number;
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  segments: LayoutSegment[];
  sections: LayoutSection[];
  sequence: string[];
}

type Point = { x: number; y: number };

function smoothSegment(points: Point[], i: number, tension = 0.85) {
  const p0 = points[i - 1] ?? points[i];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[i + 2] ?? points[i + 1];
  const k = tension / 6;
  const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
  const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
  return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
}

function edgePath(a: LayoutNode, b: LayoutNode) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
  const sx = Math.sign(dx) || 1;
  const sy = Math.sign(dy) || 1;

  const start = horizontal
    ? { x: dx > 0 ? a.x + a.w : a.x, y: ay }
    : { x: ax, y: dy > 0 ? a.y + a.h : a.y };
  const end = horizontal
    ? { x: dx > 0 ? b.x : b.x + b.w, y: by }
    : { x: bx, y: dy > 0 ? b.y : b.y + b.h };

  const pull = horizontal
    ? Math.max(48, Math.abs(end.x - start.x) * 0.45)
    : Math.max(48, Math.abs(end.y - start.y) * 0.45);

  const c1 = horizontal ? { x: start.x + sx * pull, y: start.y } : { x: start.x, y: start.y + sy * pull };
  const c2 = horizontal ? { x: end.x - sx * pull, y: end.y } : { x: end.x, y: end.y - sy * pull };
  return `M${start.x.toFixed(1)},${start.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
}

export function layoutRoadmap({ graph, visibleIds, width }: {
  graph: ConceptGraph;
  visibleIds: Set<string>;
  width: number;
}): RoadmapLayout {
  const usable = Math.max(280, Math.floor(width));
  const cols = Math.max(1, Math.min(ROADMAP.maxCols,
    Math.floor((usable + ROADMAP.gapX) / (ROADMAP.minNodeWidth + ROADMAP.gapX))));
  const nodeWidth = Math.min(ROADMAP.maxNodeWidth, (usable - (cols - 1) * ROADMAP.gapX) / cols);
  const nodeHeight = cols === 1 ? ROADMAP.compactNodeHeight : ROADMAP.nodeHeight;
  const amp = cols === 1 ? 0 : ROADMAP.wave;
  const gridWidth = cols * nodeWidth + (cols - 1) * ROADMAP.gapX;
  const padX = Math.max(0, (usable - gridWidth) / 2);

  const visible = graph.nodes.filter(node => visibleIds.has(node.concept.id));

  const runs: { id: string; nodes: GraphNode[] }[] = [];
  for (const node of visible) {
    const last = runs[runs.length - 1];
    if (last && last.id === node.concept.category) last.nodes.push(node);
    else runs.push({ id: node.concept.category, nodes: [node] });
  }

  const nodes: LayoutNode[] = [];
  const sections: LayoutSection[] = [];
  let cursorY = ROADMAP.padY;
  let flip = 0;

  runs.forEach((run, sectionIndex) => {
    const rows = Math.ceil(run.nodes.length / cols);
    const top = cursorY;
    const bodyTop = top + ROADMAP.sectionHeader + amp;
    let lastCol = 0;

    run.nodes.forEach((node, i) => {
      const row = Math.floor(i / cols);
      const inRow = i % cols;
      const leftToRight = (row + flip) % 2 === 0;
      const col = leftToRight ? inRow : cols - 1 - inRow;
      const x = padX + col * (nodeWidth + ROADMAP.gapX);
      const y = bodyTop + row * (nodeHeight + ROADMAP.gapY)
        + amp * Math.sin(((col + 1) / (cols + 1)) * Math.PI * 2 + row * 0.9);

      nodes.push({ id: node.concept.id, x, y, w: nodeWidth, h: nodeHeight, row, col, index: nodes.length, sectionIndex });
      lastCol = col;
    });

    const height = ROADMAP.sectionHeader + amp * 2
      + rows * nodeHeight + Math.max(0, rows - 1) * ROADMAP.gapY + 20;

    const meta = CATEGORIES.find(category => category.id === run.id);
    sections.push({
      id: run.id,
      title: meta?.title ?? run.id,
      short: meta?.short ?? run.id,
      index: sectionIndex,
      y: top,
      height,
      ids: run.nodes.map(node => node.concept.id),
    });

    cursorY = top + height + ROADMAP.sectionGap;
    flip = lastCol >= cols / 2 ? 1 : 0;
  });

  const byId = new Map(nodes.map(node => [node.id, node] as const));
  const sequence = nodes.map(node => node.id);
  const centers = nodes.map(node => ({ x: node.x + node.w / 2, y: node.y + node.h / 2 }));

  const segments: LayoutSegment[] = [];
  for (let i = 0; i < centers.length - 1; i++) {
    segments.push({ id: `${sequence[i]}~${sequence[i + 1]}`, from: sequence[i], to: sequence[i + 1], d: smoothSegment(centers, i) });
  }

  const orderIndex = new Map(sequence.map((id, i) => [id, i] as const));
  const edges: LayoutEdge[] = [];
  for (const node of visible) {
    const target = byId.get(node.concept.id)!;
    for (const prereqId of node.prereqs) {
      const source = byId.get(prereqId);
      if (!source) continue;
      const a = orderIndex.get(prereqId)!;
      const b = orderIndex.get(node.concept.id)!;
      if (Math.abs(a - b) === 1) continue;
      const back = a > b;
      const cross = graph.byId.get(prereqId)!.concept.category !== node.concept.category;
      edges.push({
        id: `${prereqId}->${node.concept.id}`,
        from: prereqId,
        to: node.concept.id,
        d: edgePath(source, target),
        kind: back ? 'back' : cross ? 'cross' : 'same',
      });
    }
  }

  const height = Math.max(240, cursorY - ROADMAP.sectionGap + ROADMAP.padY);
  return { width: usable, height, cols, nodeWidth, nodeHeight, nodes, byId, edges, segments, sections, sequence };
}