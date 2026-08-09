import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';
import { z } from 'zod';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content');

const Frontmatter = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5).default(3),
  prereqs: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  estReadMin: z.number().int().min(1).default(6),
  updated: z.preprocess(value => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value;
  }, z.string()),
});

const QuizItem = z.object({
  id: z.string(),
  type: z.enum(['mcq', 'short', 'latex', 'code', 'numeric', 'order']),
  prompt: z.string(),
  difficulty: z.number().int().min(1).max(5).default(3),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().optional(),
  value: z.number().optional(),
  tolerance: z.number().optional(),
  steps: z.array(z.string()).optional(),
  lang: z.string().optional(),
  scaffold: z.string().optional(),
  blanks: z.array(z.object({
    id: z.number().int(),
    answer: z.string(),
    rubric: z.array(z.string()).min(1),
  })).optional(),
  answer: z.string().optional(),
  rubric: z.array(z.string()).default([]),
  hints: z.array(z.string()).default([]),
  explanation: z.string().default(''),
  anchor: z.string().optional(),
});

let count = 0;
const concepts = [];
for (const category of await fs.readdir(CONTENT)) {
  const dir = path.join(CONTENT, category);
  if (!(await fs.stat(dir)).isDirectory()) continue;
  for (const file of (await fs.readdir(dir)).filter(name => name.endsWith('.mdx'))) {
    const source = await fs.readFile(path.join(dir, file), 'utf8');
    const { data } = matter(source);
    const frontmatter = Frontmatter.parse(data);
    concepts.push(frontmatter);
    count += 1;

    const quizPath = path.join(dir, file.replace(/\.mdx$/, '.quiz.yaml'));
    try {
      const items = YAML.parse(await fs.readFile(quizPath, 'utf8')) ?? [];
      for (const item of items) QuizItem.parse(item);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw new Error(`[validate] malformed quiz file ${quizPath}: ${error.message}`);
    }
  }
}

const ids = new Set(concepts.map(concept => concept.id));
for (const concept of concepts) {
  for (const prereq of concept.prereqs) {
    if (!ids.has(prereq)) {
      console.warn(`⚠ ${concept.id}: unknown prereq "${prereq}"`);
    }
  }
}

const cycles = findCycles(concepts);
for (const cycle of cycles) {
  console.warn(`⚠ prereq cycle: ${cycle.join(' → ')}`);
}

function findCycles(items) {
  const byId = new Map(items.map(item => [item.id, item]));
  const state = new Map();
  const found = [];

  const visit = (id, stack) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const start = stack.indexOf(id);
      found.push([...stack.slice(start), id]);
      return;
    }
    state.set(id, 'visiting');
    for (const prereq of byId.get(id)?.prereqs ?? []) {
      if (byId.has(prereq)) visit(prereq, [...stack, id]);
    }
    state.set(id, 'done');
  };

  for (const item of items) visit(item.id, []);
  return found;
}

console.log(`✓ validated ${count} concept files`);
