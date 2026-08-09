import GithubSlugger from 'github-slugger';

export interface TocItem { depth: 2 | 3; text: string; id: string }

export function extractToc(raw: string): TocItem[] {
  const slugger = new GithubSlugger();
  const out: TocItem[] = [];
  let inFence = false;
  for (const line of raw.split('\n')) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[*_`$]/g, '').trim();
    out.push({ depth: match[1].length as 2 | 3, text, id: slugger.slug(text) });
  }
  return out;
}
