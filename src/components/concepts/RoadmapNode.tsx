'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { MasteryRing } from './MasteryRing';
import type { ConceptMeta } from '@/lib/content/types';
import type { LayoutNode } from '@/lib/content/roadmap-layout';

export type NodeState = 'idle' | 'active' | 'prereq' | 'unlocks' | 'dim';

export const RoadmapNode = memo(function RoadmapNode({
  concept, node, step, state, hue, mastery, attempts, done, prereqCount, onActivate, onRegister,
}: {
  concept: ConceptMeta;
  node: LayoutNode;
  step: number;
  state: NodeState;
  hue: number;
  mastery: number;
  attempts: number;
  done: boolean;
  prereqCount: number;
  onActivate: (id: string | null) => void;
  onRegister: (id: string, element: HTMLAnchorElement | null) => void;
}) {
  return (
    <li
      className="roadmap__node"
      data-state={state}
      style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)`, width: node.w, height: node.h }}
    >
      <Link
        ref={element => onRegister(concept.id, element)}
        href={concept.href}
        data-node-id={concept.id}
        data-done={done || undefined}
        style={{ ['--cat' as string]: `var(--cat-${hue})` }}
        className="roadmap-card"
        onMouseEnter={() => onActivate(concept.id)}
        onMouseLeave={() => onActivate(null)}
        onFocus={() => onActivate(concept.id)}
        onBlur={() => onActivate(null)}
      >
        <span className="roadmap-card__top">
          <span className="roadmap-card__step">{step}</span>
          <span className="roadmap-card__ring">
            {done ? (
              <span className="roadmap-card__check" aria-label="Mastered"><Check size={13} aria-hidden="true" /></span>
            ) : (
              <MasteryRing value={mastery} started={attempts > 0} />
            )}
          </span>
        </span>

        <span className="roadmap-card__title">{concept.title}</span>

        <span className="roadmap-card__meta">
          {prereqCount ? <span>{prereqCount} prereq{prereqCount === 1 ? '' : 's'}</span> : <span>entry point</span>}
          <span aria-hidden="true">·</span>
          <span>{concept.quizCount} item{concept.quizCount === 1 ? '' : 's'}</span>
        </span>
      </Link>
    </li>
  );
});