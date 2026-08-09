import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import GithubSlugger from 'github-slugger';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'public', 'data');

const safe = id => id.replace(/\//g, '__');

function stripMdx(source) {
  return source
    .replace(/^import\s.+$/gm, '')
    .replace(/^export\s.+$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<\/?([A-Za-z][\w.-]*)(\s[^>]*)?>/g, (_match, tag) => (/^(br|hr)$/i.test(tag) ? '\n' : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSections(body) {
  const slugger = new GithubSlugger();
  const sections = [];
  let current = { id: '', heading: 'Overview', lines: [] };
  let fenced = false;

  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current.lines.join('\n').trim()) sections.push(current);
      const text = heading[2].replace(/[\*_`]/g, '').trim();
      current = { id: slugger.slug(text), heading: text, lines: [] };
      continue;
    }
    current.lines.push(line);
  }

  if (current.lines.join('\n').trim()) sections.push(current);

  return sections.map(section => ({
    id: section.id,
    heading: section.heading,
    text: section.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  }));
}

function chunk(text) {
  const paragraphs = text.split(/\n{2,}/);
  const out = [];
  let buffer = '';
  for (const paragraph of paragraphs) {
    if ((buffer + '\n\n' + paragraph).length > 1100 && buffer) {
      out.push(buffer.trim());
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

async function main() {
  const concepts = [];
  const chunks = [];
  await fs.mkdir(path.join(OUT, 'concept-sections'), { recursive: true });

  for (const category of await fs.readdir(CONTENT)) {
    const dir = path.join(CONTENT, category);
    if (!(await fs.stat(dir)).isDirectory()) continue;
    for (const file of (await fs.readdir(dir)).filter(name => name.endsWith('.mdx'))) {
      const raw = await fs.readFile(path.join(dir, file), 'utf8');
      const { data, content } = matter(raw);
      const conceptId = data.id ?? `${category}/${file.replace(/\.mdx$/, '')}`;
      const sections = splitSections(stripMdx(content));

      await fs.writeFile(path.join(OUT, 'concept-sections', `${safe(conceptId)}.json`), JSON.stringify(sections));

      sections.forEach((section, sectionIndex) => {
        chunk(section.text).forEach((text, chunkIndex) => {
          chunks.push({
            id: `${conceptId}#${sectionIndex}-${chunkIndex}`,
            conceptId,
            conceptTitle: data.title,
            heading: section.heading,
            anchor: section.id,
            text,
          });
        });
      });

      concepts.push({ id: conceptId, title: data.title });
    }
  }

  await fs.writeFile(path.join(OUT, 'search-index.json'), JSON.stringify(chunks));
  console.log(`✓ ${chunks.length} search chunks across ${concepts.length} concepts`);
}

main();