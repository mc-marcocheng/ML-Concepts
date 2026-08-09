import Link from 'next/link';
import type { ConceptMeta, Frontmatter } from '@/lib/content/types';

export function ConceptFooter({ fm, all }: { fm: Frontmatter; all: ConceptMeta[] }) {
  const related = fm.related.map(id => all.find(concept => concept.id === id)).filter(Boolean) as ConceptMeta[];

  if (!related.length) return null;

  return (
    <footer className="mt-12 border-t border-line pt-8">
      <p className="t-eyebrow text-muted">Related</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {related.map(item => (
          <Link key={item.id} href={item.href} className="rounded-pill border border-line bg-card px-4 py-2 text-[14px] text-ink hover:bg-primary-pale">
            {item.title}
          </Link>
        ))}
      </div>
    </footer>
  );
}
