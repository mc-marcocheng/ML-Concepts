import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypePrettyCode, { type Options as PrettyCodeOptions } from 'rehype-pretty-code';
import { rehypeTexSource } from './rehype-tex-source';
import { mdxComponents } from '@/components/content/mdxComponents';
import { FrontmatterSchema, type ConceptMeta } from './types';

const CONTENT = path.join(process.cwd(), 'content');
const prettyCodeOptions: PrettyCodeOptions = {
  theme: { light: 'github-light', dark: 'github-dark-default' },
  keepBackground: false,
  defaultLang: { block: 'text', inline: 'text' },
  bypassInlineCode: true,
};

export async function listConcepts(): Promise<ConceptMeta[]> {
  const raw = await fs.readFile(path.join(process.cwd(), 'public/data/concepts.json'), 'utf8');
  return JSON.parse(raw) as ConceptMeta[];
}

export async function getConcept(category: string, slug: string) {
  const file = path.join(CONTENT, category, `${slug}.mdx`);
  const source = await fs.readFile(file, 'utf8');
  const { data, content: body } = matter(source);
  const frontmatter = FrontmatterSchema.parse(data);
  const { content } = await compileMDX({
    source: body,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [
          rehypeSlug,
          [rehypePrettyCode, prettyCodeOptions],
          [rehypeKatex, { output: 'htmlAndMathml', throwOnError: false, strict: 'ignore' }],
          rehypeTexSource,
        ],
      },
    },
  });
  return { frontmatter, content, raw: body };
}
