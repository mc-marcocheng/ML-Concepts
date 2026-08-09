import Link from 'next/link';
import { listConcepts } from '@/lib/content/server';
import type { ConceptMeta } from '@/lib/content/types';

const PATHS: Record<string, { title: string; eyebrow: string; summary: string; quizHref: string; order: string[] }> = {
  foundations: {
    title: 'Foundations',
    eyebrow: 'Path',
    summary: 'A grounded sequence for the math and modeling ideas that keep showing up across the rest of the app.',
    quizHref: '/quiz/session/?scope=mixed&size=10',
    order: [
      'general-ml/bias-variance',
      'general-ml/cross-validation',
      'linear-algebra/orthogonality',
      'linear-algebra/least-squares',
      'linear-algebra/psd',
      'linear-algebra/eigendecomposition',
      'linear-algebra/rank-nullity',
      'linear-algebra/svd',
    ],
  },
  'reinforcement-learning': {
    title: 'Reinforcement Learning',
    eyebrow: 'Path',
    summary: 'A short route through policy learning concepts currently available in the library.',
    quizHref: '/quiz/session/?scope=category&id=reinforcement-learning',
    order: [
      'reinforcement-learning/q-learning',
      'reinforcement-learning/gae',
    ],
  },
  llms: {
    title: 'LLMs',
    eyebrow: 'Path',
    summary: 'A compact path for tokenization and language-model basics already seeded in the course.',
    quizHref: '/quiz/session/?scope=category&id=llms',
    order: [
      'llms/tokenization',
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(PATHS).map(track => ({ track }));
}

function orderConcepts(concepts: ConceptMeta[], order: string[]) {
  const byId = new Map(concepts.map(concept => [concept.id, concept] as const));
  return order.map(id => byId.get(id)).filter((concept): concept is ConceptMeta => Boolean(concept));
}

export default async function PathPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const path = PATHS[track];
  const concepts = await listConcepts();

  if (!path) {
    return (
      <div className="container-read py-10">
        <p className="t-eyebrow text-muted">Path</p>
        <h1 className="t-display-md mt-3">Unknown track</h1>
        <p className="mt-4 text-[17px] leading-7 text-body">That learning path is not defined yet.</p>
      </div>
    );
  }

  const ordered = orderConcepts(concepts, path.order);

  return (
    <div className="container-read py-10">
      <p className="t-eyebrow text-muted">{path.eyebrow}</p>
      <h1 className="t-display-md mt-3">{path.title}</h1>
      <p className="mt-4 max-w-[62ch] text-[17px] leading-7 text-body">{path.summary}</p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={path.quizHref} className="inline-flex items-center justify-center rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary shadow-offset">
          Start path quiz
        </Link>
        <Link href="/learn" className="rounded-pill border-2 border-line-strong bg-card px-5 py-3.5 font-bold text-ink hover:bg-primary-pale">
          Browse all concepts
        </Link>
      </div>

      <section className="mt-8 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Sequence</p>
        <div className="mt-4 grid gap-3">
          {ordered.map((concept, index) => (
            <Link key={concept.id} href={concept.href} className="group flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-canvas-soft px-4 py-4 transition-transform hover:-translate-y-0.5 hover:border-line-strong">
              <div className="min-w-0">
                <p className="font-mono text-[12px] text-muted">Step {index + 1}</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-ink">{concept.title}</h2>
                <p className="mt-2 max-w-[58ch] text-[14px] leading-6 text-body">{concept.summary}</p>
              </div>
              <div className="flex flex-none flex-wrap items-center gap-2">
                <span className="rounded-pill border border-line bg-card px-3 py-1 font-mono text-[12px] text-muted">{concept.category}</span>
                <span className="rounded-pill border border-line bg-card px-3 py-1 font-mono text-[12px] text-muted">{concept.quizCount} quiz item{concept.quizCount === 1 ? '' : 's'}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">How to use this path</p>
        <p className="mt-3 text-[15px] leading-7 text-body">Work top to bottom, then use the path quiz to check whether the core ideas are landing. The order stays short and practical until the larger content wave is authored.</p>
      </section>
    </div>
  );
}
