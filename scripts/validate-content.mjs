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

function countScaffoldPlaceholders(scaffold) {
  const source = scaffold ?? '';
  const canonical = [...source.matchAll(/___BLANK_(\d+)___/g)];
  if (canonical.length) return canonical.length;
  const numbered = [...source.matchAll(/_{3,}\s*(\d+)\s*_{3,}/g)];
  if (numbered.length) return numbered.length;
  const bare = [...source.matchAll(/_{3,}/g)];
  return bare.length;
}

function validateQuizItem(item, quizPath) {
  const label = `${quizPath} (${item.id})`;

  if (item.type === 'mcq') {
    if (!Array.isArray(item.options) || item.options.length < 2) {
      throw new Error(`[validate] ${label}: mcq needs at least 2 options`);
    }
    if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= item.options.length) {
      throw new Error(`[validate] ${label}: mcq correctIndex must index into options[]`);
    }
    return;
  }

  if (item.type === 'numeric') {
    if (typeof item.value !== 'number' || !Number.isFinite(item.value)) {
      throw new Error(`[validate] ${label}: numeric item needs a numeric value`);
    }
    return;
  }

  if (item.type === 'order') {
    if (!Array.isArray(item.steps) || item.steps.length < 2) {
      throw new Error(`[validate] ${label}: order item needs at least 2 steps`);
    }
    return;
  }

  if (item.type === 'code') {
    const blanks = item.blanks ?? [];
    if (!blanks.length) {
      throw new Error(`[validate] ${label}: code item needs a non-empty blanks[] array`);
    }
    const ids = blanks.map(blank => blank.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`[validate] ${label}: code item has duplicate blank ids`);
    }
    for (const blank of blanks) {
      if (!blank.answer.trim()) {
        throw new Error(`[validate] ${label}: blank #${blank.id} needs a non-empty answer`);
      }
    }
    const placeholderCount = countScaffoldPlaceholders(item.scaffold);
    if (placeholderCount > 0 && placeholderCount !== blanks.length) {
      throw new Error(`[validate] ${label}: scaffold has ${placeholderCount} placeholder(s) but blanks[] has ${blanks.length}`);
    }
    return;
  }

  if (item.type === 'latex' || item.type === 'short') {
    if (!item.answer?.trim()) {
      throw new Error(`[validate] ${label}: ${item.type} item needs a non-empty answer`);
    }
    if (!item.rubric.length) {
      throw new Error(`[validate] ${label}: ${item.type} item needs a non-empty rubric[]`);
    }
  }
}

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
      for (const raw of items) {
        const item = QuizItem.parse(raw);
        validateQuizItem(item, quizPath);
      }
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
