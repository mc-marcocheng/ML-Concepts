import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'public', 'data');
const QUIZ_TYPES = new Set(['mcq', 'short', 'latex', 'code', 'numeric', 'order']);

const safe = id => id.replace(/\//g, '__');

const strings = value => (Array.isArray(value) ? value.filter(entry => typeof entry === 'string' && entry.trim().length > 0) : []);

function normalizeQuizItem(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw;
  if (typeof item.prompt !== 'string' || !item.prompt.trim()) return null;

  const type = QUIZ_TYPES.has(item.type) ? item.type : 'short';
  const normalized = {
    ...item,
    id: typeof item.id === 'string' && item.id ? item.id : fallbackId,
    type,
    prompt: item.prompt,
    difficulty: Number.isFinite(item.difficulty) ? Number(item.difficulty) : 3,
    options: Array.isArray(item.options) ? item.options.map(String) : undefined,
    steps: Array.isArray(item.steps) ? item.steps.map(String) : undefined,
    blanks: Array.isArray(item.blanks) ? item.blanks : undefined,
    correctIndex: Number.isInteger(item.correctIndex) ? Number(item.correctIndex) : undefined,
    rubric: strings(item.rubric),
    hints: strings(item.hints),
    explanation: typeof item.explanation === 'string' ? item.explanation : '',
  };

  if (normalized.type === 'mcq' && (!normalized.options?.length || !Number.isInteger(normalized.correctIndex))) {
    throw new Error(`[build] mcq item ${normalized.id} needs options[] and correctIndex`);
  }

  return normalized;
}

function normalizeQuizItems(payload, conceptId) {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((raw, index) => normalizeQuizItem(raw, `${conceptId}#${index}`))
    .filter(Boolean);
}

const concepts = [];
await fs.mkdir(path.join(OUT, 'quiz'), { recursive: true });

for (const category of await fs.readdir(CONTENT)) {
  const dir = path.join(CONTENT, category);
  if (!(await fs.stat(dir)).isDirectory()) continue;
  for (const file of (await fs.readdir(dir)).filter(name => name.endsWith('.mdx'))) {
    const slug = file.replace(/\.mdx$/, '');
    const raw = await fs.readFile(path.join(dir, file), 'utf8');
    const { data, content } = matter(raw);
    if (data.id !== `${category}/${slug}`) throw new Error(`id mismatch in ${file}: ${data.id}`);

    let items = [];
    const quizPath = path.join(dir, `${slug}.quiz.yaml`);
    try {
      const parsed = YAML.parse(await fs.readFile(quizPath, 'utf8')) ?? [];
      items = normalizeQuizItems(parsed, data.id);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        items = [];
      } else {
        throw error;
      }
    }
    if (items.length) {
      await fs.writeFile(path.join(OUT, 'quiz', `${safe(data.id)}.json`), JSON.stringify(items));
    }

    concepts.push({ ...data, slug, href: `/learn/${data.id}/`, quizCount: items.length, hasQuiz: items.length > 0 });
  }
}

concepts.sort((a, b) => a.title.localeCompare(b.title));
await fs.writeFile(path.join(OUT, 'concepts.json'), JSON.stringify(concepts));
console.log(`✓ ${concepts.length} concepts, ${concepts.reduce((sum, concept) => sum + concept.quizCount, 0)} quiz items`);
