import { notFound } from 'next/navigation';
import { ConceptHeader } from '@/components/content/ConceptHeader';
import { ConceptFooter } from '@/components/content/ConceptFooter';
import { ConceptAnnotations } from '@/components/content/ConceptAnnotations';
import { ExpandAllEffect } from '@/components/content/ExpandAllEffect';
import { ReadingTracker } from '@/components/content/ReadingTracker';
import { listConcepts, getConcept } from '@/lib/content/server';
import { extractToc } from '@/lib/content/toc';

export const dynamicParams = false;

export async function generateStaticParams() {
  const concepts = await listConcepts();
  return concepts.map(concept => ({ slug: concept.id.split('/') }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const [category, conceptSlug] = slug ?? [];
  try {
    const { frontmatter } = await getConcept(category, conceptSlug);
    return { title: frontmatter.title, description: frontmatter.summary };
  } catch {
    return {};
  }
}

export default async function ConceptPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const [category, conceptSlug] = slug ?? [];
  if (!category || !conceptSlug) notFound();

  let data;
  try {
    data = await getConcept(category, conceptSlug);
  } catch {
    notFound();
  }

  const { frontmatter, content, raw } = data;
  const toc = extractToc(raw);
  const all = await listConcepts();

  return (
    <div className="container-wide py-10 max-md:py-6">
      <div data-concept-shell className="grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)_320px] xl:items-start">
        <nav className="hidden xl:block xl:sticky xl:top-(--header-h) xl:max-h-[calc(100dvh-var(--header-h)-2rem)] xl:overflow-y-auto" aria-label="On this page">
          <p className="t-eyebrow text-muted">On this page</p>
          <ul className="mt-3 grid gap-2">
            {toc.map(item => (
              <li key={item.id} className={item.depth === 3 ? 'pl-4' : ''}>
                <a href={`#${item.id}`} className="block text-[14px] leading-6 text-body hover:text-ink">{item.text}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article data-askable data-concept-id={frontmatter.id} data-concept-title={frontmatter.title} data-concept-summary={frontmatter.summary} className="mx-auto w-full max-w-reading min-w-0">
          <ConceptHeader fm={frontmatter} all={all} />
          <details className="collapsible mt-6 xl:hidden">
            <summary><span className="uppercase tracking-[.08em] text-[11px] text-muted">On this page</span></summary>
            <ul className="collapsible__body grid gap-2">
              {toc.map(item => (
                <li key={item.id} className={item.depth === 3 ? 'pl-4' : ''}>
                  <a href={`#${item.id}`} className="block text-[14px] leading-6 text-body">{item.text}</a>
                </li>
              ))}
            </ul>
          </details>
          <div data-concept-body className="prose mt-8">{content}</div>
          <ConceptFooter fm={frontmatter} all={all} />
        </article>

        {/* Note rail. The breakpoint here is authoritative: ConceptAnnotations measures
            this element rather than duplicating the value. If you change `xl:` below,
            also update the `xl:hidden` anti-flash guard in ConceptAnnotations. */}
        <aside data-note-rail className="relative hidden xl:block xl:min-h-24" aria-label="Notes" />
      </div>

      <ConceptAnnotations conceptId={frontmatter.id} conceptTitle={frontmatter.title} />
      <ExpandAllEffect />
      <ReadingTracker conceptId={frontmatter.id} />
    </div>
  );
}
