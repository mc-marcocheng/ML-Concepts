import { z } from 'zod';

export const FrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  title: z.string().min(2),
  category: z.string(),
  summary: z.string().max(200),
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

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export const QuizItemSchema = z.object({
  id: z.string(),
  type: z.enum(['mcq', 'short', 'latex', 'code', 'numeric', 'order']),
  prompt: z.string(),
  difficulty: z.number().int().min(1).max(5).default(3),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().optional(),
  value: z.number().optional(),
  tolerance: z.number().optional(),
  steps: z.array(z.string()).optional(),
  lang: z.string().default('python').optional(),
  scaffold: z.string().optional(),
  blanks: z.array(z.object({
    id: z.number().int(),
    answer: z.string(),
    rubric: z.array(z.string()).optional(),
  })).optional(),
  answer: z.string().optional(),
  rubric: z.array(z.string()).default([]),
  hints: z.array(z.string()).default([]),
  explanation: z.string().default(''),
  anchor: z.string().optional(),
});

export type QuizItem = z.infer<typeof QuizItemSchema>;
export type QuizBlank = NonNullable<QuizItem['blanks']>[number];

export interface ConceptMeta extends Frontmatter {
  href: string;
  slug: string;
  quizCount: number;
  hasQuiz: boolean;
}

export interface SearchChunk {
  id: string;
  conceptId: string;
  conceptTitle: string;
  heading: string;
  anchor: string;
  text: string;
}
