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
for (const category of await fs.readdir(CONTENT)) {
  const dir = path.join(CONTENT, category);
  if (!(await fs.stat(dir)).isDirectory()) continue;
  for (const file of (await fs.readdir(dir)).filter(name => name.endsWith('.mdx'))) {
    const source = await fs.readFile(path.join(dir, file), 'utf8');
    const { data } = matter(source);
    Frontmatter.parse(data);
    count += 1;

    const quizPath = path.join(dir, file.replace(/\.mdx$/, '.quiz.yaml'));
    try {
      const items = YAML.parse(await fs.readFile(quizPath, 'utf8')) ?? [];
      for (const item of items) QuizItem.parse(item);
    } catch {}
  }
}

console.log(`✓ validated ${count} concept files`);
