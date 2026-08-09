/**
 * Normalises LaTeX delimiters emitted by LLMs into markdown that
 * remark-math + rehype-katex can parse reliably.
 */

// One capture group keeps code chunks at odd indices when splitting.
const CODE_SPLIT = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g;

const LIST_MARKER = /^(\s*)(?:[-*+]|\d+[.)])\s+/;

function indentFor(out: string): string {
  const line = out.slice(out.lastIndexOf('\n') + 1);
  const marker = LIST_MARKER.exec(line);
  if (marker) return ' '.repeat(marker[0].length);
  return /^[ \t]*/.exec(line)?.[0] ?? '';
}

function displayBlock(body: string, indent: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  const inner = trimmed
    .split('\n')
    .map(line => `${indent}${line.trim()}`)
    .join('\n');
  return `\n\n${indent}$$\n${inner}\n${indent}$$\n\n${indent}`;
}

function inlineClose(src: string, from: number): number {
  for (let index = from; index < src.length; index += 1) {
    const ch = src[index];
    if (ch === '\\') {
      index += 1;
      continue;
    }
    if (ch === '\n' && src[index + 1] === '\n') return -1;
    if (ch === '$') return index;
  }
  return -1;
}

function convert(input: string): string {
  let out = '';
  let index = 0;

  while (index < input.length) {
    const two = input.slice(index, index + 2);

    if (two === '\\$') {
      out += two;
      index += 2;
      continue;
    }

    if (two === '\\[') {
      const end = input.indexOf('\\]', index + 2);
      if (end === -1) {
        out += input.slice(index);
        break;
      }
      out += displayBlock(input.slice(index + 2, end), indentFor(out));
      index = end + 2;
      continue;
    }

    if (two === '\\(') {
      const end = input.indexOf('\\)', index + 2);
      if (end === -1) {
        out += input.slice(index);
        break;
      }
      const body = input.slice(index + 2, end).trim();
      out += body ? `$${body}$` : '';
      index = end + 2;
      continue;
    }

    if (two === '$$') {
      const end = input.indexOf('$$', index + 2);
      if (end === -1) {
        out += input.slice(index);
        break;
      }
      out += displayBlock(input.slice(index + 2, end), indentFor(out));
      index = end + 2;
      continue;
    }

    if (input[index] === '$') {
      const end = inlineClose(input, index + 1);
      if (end === -1) {
        out += '$';
        index += 1;
        continue;
      }
      const body = input.slice(index + 1, end).trim();
      out += body ? `$${body}$` : input.slice(index, end + 1);
      index = end + 1;
      continue;
    }

    out += input[index];
    index += 1;
  }

  return out;
}

export function normalizeMarkdownMath(input: string): string {
  if (!input) return '';
  return input
    .split(CODE_SPLIT)
    .map((part, index) => (index % 2 === 1 ? part : convert(part ?? '')))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .trimEnd();
}
