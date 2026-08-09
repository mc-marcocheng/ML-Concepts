'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { CATEGORIES } from '@/lib/content/categories';
import type { ConceptGraph } from '@/lib/content/graph';
import {
  BAND_HEAD_H,
  BAND_HEAD_H_NARROW,
  ROADMAP_NARROW_W,
  layoutRoadmap,
} from '@/lib/content/roadmap-layout';
import type { ConceptMeta } from '@/lib/content/types';
import { useContainerWidth } from '@/lib/utils/useContainerWidth';
import { RoadmapNode, type NodeState } from './RoadmapNode';

const HUE_BY_CATEGORY = new Map(CATEGORIES.map((category, index) => [category.id, index % 8] as const));
const MASTERED = 0.7;

export function RoadmapGraph({ graph, visible, masteryById }: {
  graph: ConceptGraph;
  visible: ConceptMeta[];
  masteryById: Map<string, { mastery: number; attempts: number }>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(hostRef);
  const nodeRefs = useRef(new Map<string, HTMLAnchorElement>());
  const headRefs = useRef(new Map<string, HTMLElement>());
  const [measuredHeadH, setMeasuredHeadH] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [wiresIn, setWiresIn] = useState(false);

  const narrow = width > 0 && width < ROADMAP_NARROW_W;

  const bandHeadHeight = measuredHeadH > 0
    ? Math.ceil(measuredHeadH)
    : (narrow ? BAND_HEAD_H_NARROW : BAND_HEAD_H);

  const visibleIds = useMemo(() => new Set(visible.map(concept => concept.id)), [visible]);
  const layout = useMemo(
    () => (width > 0 ? layoutRoadmap({ graph, visibleIds, width, bandHeadHeight }) : null),
    [graph, visibleIds, width, bandHeadHeight],
  );

  const registerHead = useCallback((id: string, element: HTMLElement | null) => {
    if (element) headRefs.current.set(id, element);
    else headRefs.current.delete(id);
  }, []);

  const measureHeads = useCallback(() => {
    let max = 0;
    for (const element of headRefs.current.values()) {
      max = Math.max(max, element.getBoundingClientRect().height);
    }
    if (max > 0) setMeasuredHeadH(prev => (Math.abs(prev - max) > 0.5 ? max : prev));
  }, []);

  useLayoutEffect(() => {
    if (!layout) return;
    measureHeads();
    const observer = new ResizeObserver(measureHeads);
    headRefs.current.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [measureHeads, layout, width]);

  useEffect(() => {
    document.fonts?.ready.then(measureHeads).catch(() => {});
  }, [measureHeads]);

  useEffect(() => {
    if (!layout) return;
    setWiresIn(false);
    const frame = requestAnimationFrame(() => setWiresIn(true));
    return () => cancelAnimationFrame(frame);
  }, [layout]);

  useEffect(() => { setActive(null); }, [visibleIds]);

  const chain = useMemo(() => {
    if (!active) return null;
    const ancestors = graph.ancestorsOf(active);
    const descendants = graph.descendantsOf(active);
    return { ancestors, descendants, all: new Set<string>([active, ...ancestors, ...descendants]) };
  }, [active, graph]);

  const done = useMemo(
    () => new Set(visible.filter(concept => (masteryById.get(concept.id)?.mastery ?? 0) >= MASTERED).map(concept => concept.id)),
    [visible, masteryById],
  );

  const register = useCallback((id: string, element: HTMLAnchorElement | null) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (!layout) return;
    const focusable = (event.target as HTMLElement | null)?.closest?.('[data-node-id]') as HTMLElement | null;
    const id = focusable?.getAttribute('data-node-id');
    if (!id) return;
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: layout.cols,
      ArrowUp: -layout.cols,
      Home: -layout.sequence.length,
      End: layout.sequence.length,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const index = layout.sequence.indexOf(id);
    const target = Math.max(0, Math.min(layout.sequence.length - 1, index + delta));
    nodeRefs.current.get(layout.sequence[target])?.focus();
  };

  const stateOf = (id: string): NodeState => {
    if (!chain) return 'idle';
    if (id === active) return 'active';
    if (chain.ancestors.has(id)) return 'prereq';
    if (chain.descendants.has(id)) return 'unlocks';
    return 'dim';
  };

  if (!visible.length) {
    return (
      <p className="mt-10 rounded-lg border border-line bg-card p-6 text-[15px] text-body">
        No concepts match that filter.
      </p>
    );
  }

  return (
    <div
      ref={hostRef}
      className="roadmap mt-6"
      data-narrow={narrow ? 'true' : undefined}
      data-hovered={chain ? 'true' : undefined}
    >
      {!layout ? (
        <div className="h-[70vh] animate-pulse rounded-xl border border-line bg-card/40" aria-hidden="true" />
      ) : (
        <div className="roadmap__stage" style={{ height: layout.height }}>
          {layout.sections.map(section => {
            const mastered = section.ids.filter(id => done.has(id)).length;
            const pct = Math.round((mastered / section.ids.length) * 100);
            return (
              <div
                key={section.id}
                className="roadmap__band"
                style={{ top: section.y, height: section.height, ['--cat' as string]: `var(--cat-${HUE_BY_CATEGORY.get(section.id as (typeof CATEGORIES)[number]['id']) ?? 0})` }}
              >
                <div
                  className="roadmap__band-head"
                  ref={element => { registerHead(section.id, element); }}
                >
                  <span className="roadmap__band-dot" aria-hidden="true" />
                  <h2 className="t-display-sm roadmap__band-title">{section.title}</h2>
                  <span className="font-mono text-[12px] text-muted">{mastered}/{section.ids.length}</span>
                  <span className="roadmap__band-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                </div>
              </div>
            );
          })}

          <svg
            className="roadmap__wires"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            data-in={wiresIn ? 'true' : 'false'}
            aria-hidden="true"
            focusable="false"
          >
            <g className="roadmap__edges">
              {layout.edges.map(edge => (
                <path
                  key={edge.id}
                  d={edge.d}
                  className="roadmap__edge"
                  data-kind={edge.kind}
                  data-lit={chain && chain.all.has(edge.from) && chain.all.has(edge.to) ? 'true' : undefined}
                />
              ))}
            </g>
            <g className="roadmap__spine">
              {layout.segments.map(segment => (
                <path
                  key={segment.id}
                  d={segment.d}
                  className="roadmap__segment"
                  data-done={done.has(segment.from) && done.has(segment.to) ? 'true' : undefined}
                  data-lit={chain && chain.all.has(segment.from) && chain.all.has(segment.to) ? 'true' : undefined}
                />
              ))}
            </g>
          </svg>

          <ol className="roadmap__nodes" onKeyDown={onKeyDown}>
            {layout.nodes.map(node => {
              const graphNode = graph.byId.get(node.id)!;
              const score = masteryById.get(node.id);
              return (
                <RoadmapNode
                  key={node.id}
                  concept={graphNode.concept}
                  node={node}
                  step={node.index + 1}
                  state={stateOf(node.id)}
                  hue={HUE_BY_CATEGORY.get(graphNode.concept.category as (typeof CATEGORIES)[number]['id']) ?? 0}
                  mastery={score?.mastery ?? 0}
                  attempts={score?.attempts ?? 0}
                  done={done.has(node.id)}
                  onActivate={setActive}
                  onRegister={register}
                />
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}