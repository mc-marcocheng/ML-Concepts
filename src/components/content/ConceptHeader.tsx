import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import type { ConceptMeta, Frontmatter } from '@/lib/content/types';
import { CATEGORIES } from '@/lib/content/categories';

export function ConceptHeader({ fm, all }: { fm: Frontmatter; all: ConceptMeta[] }) {
  const cat = CATEGORIES.find(category => category.id === fm.category);
  const byId = Object.fromEntries(all.map(concept => [concept.id, concept]));

  return (
    <header>
      <p className="t-eyebrow text-muted">
        {cat?.title}
      </p>
      <h1 className="t-display-md has-highlight mt-3">{fm.title}</h1>
      <p className="t-body-lg mt-4 text-body">{fm.summary}</p>

      {fm.prereqs.length > 0 ? (
        <nav aria-label="Prerequisites" className="mt-6 flex flex-wrap items-center gap-2">
          <span className="t-eyebrow text-muted">Prereqs</span>
          {fm.prereqs.map(id => {
            const concept = byId[id];
            if (!concept) return null;
            return (
              <Link key={id} href={concept.href}>
                <Badge tone="neutral" mono>{concept.title}</Badge>
              </Link>
            );
          })}
        </nav>
      ) : null}
      <hr className="mt-8 border-line" />
    </header>
  );
}
