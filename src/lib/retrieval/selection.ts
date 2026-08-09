'use client';

import type { ContextSection } from '@/lib/llm/types';

const ATOMIC = '.katex, pre, code';

export interface CapturedSelection {
  markdown: string;
  article: HTMLElement;
  body: HTMLElement | null;
  range: Range;
  sections: ContextSection[];
}

function serialise(holder: HTMLElement): string {
  holder.querySelectorAll<HTMLElement>('.katex[data-tex]').forEach(element => {
    const tex = element.dataset.tex ?? '';
    const block = element.dataset.display === 'block';
    element.replaceWith(document.createTextNode(block ? `\n\n$$${tex}$$\n\n` : ` $${tex}$ `));
  });

  holder.querySelectorAll('.katex-mathml, annotation, [data-no-context]').forEach(node => node.remove());

  holder.querySelectorAll('pre').forEach(pre => {
    const language = pre.getAttribute('data-language') ?? '';
    pre.replaceWith(document.createTextNode(`\n\n\`\`\`${language}\n${pre.textContent ?? ''}\n\`\`\`\n\n`));
  });

  holder.querySelectorAll('li').forEach(li => li.prepend(document.createTextNode('- ')));
  holder.querySelectorAll('h2,h3,h4,p,li,tr,blockquote,summary,div').forEach(node => node.append(document.createTextNode('\n')));

  return (holder.textContent ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function expand(range: Range): Range {
  const copy = range.cloneRange();
  const grow = (node: Node, side: 'start' | 'end') => {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const atomic = element?.closest(ATOMIC);
    if (!atomic) return;
    if (side === 'start') copy.setStartBefore(atomic);
    else copy.setEndAfter(atomic);
  };
  grow(copy.startContainer, 'start');
  grow(copy.endContainer, 'end');
  return copy;
}

export function selectionToMarkdown(selection: Selection): string {
  if (!selection.rangeCount || selection.isCollapsed) return '';
  const holder = document.createElement('div');
  holder.appendChild(expand(selection.getRangeAt(0)).cloneContents());
  return serialise(holder).slice(0, 2000);
}

interface DomSection {
  id: string;
  heading: string;
  headingEl: Element | null;
  elements: Element[];
}

function collectDomSections(body: HTMLElement): DomSection[] {
  const sections: DomSection[] = [];
  let current: DomSection = { id: '', heading: 'Overview', headingEl: null, elements: [] };
  for (const element of Array.from(body.children)) {
    if (/^H[1-4]$/.test(element.tagName)) {
      if (current.headingEl || current.elements.length) sections.push(current);
      current = { id: element.id ?? '', heading: (element.textContent ?? '').trim(), headingEl: element, elements: [] };
      continue;
    }
    current.elements.push(element);
  }
  sections.push(current);
  return sections.filter(section => section.headingEl || section.elements.length);
}

function intersects(range: Range, node: Node) {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

function toContextSection(section: DomSection, selected: boolean): ContextSection {
  const holder = document.createElement('div');
  section.elements.forEach(element => holder.appendChild(element.cloneNode(true)));
  return { id: section.id, heading: section.heading || 'Overview', text: serialise(holder), selected };
}

export function sectionsForRange(body: HTMLElement, range: Range | null): ContextSection[] {
  return collectDomSections(body).map(section => {
    const hit = !!range && (
      (section.headingEl ? intersects(range, section.headingEl) : false)
      || section.elements.some(element => intersects(range, element))
    );
    return toContextSection(section, hit);
  });
}

export function captureSelection(): CapturedSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
  const article = element?.closest('[data-askable]') as HTMLElement | null;
  if (!article) return null;

  const markdown = selectionToMarkdown(selection);
  if (markdown.length < 3) return null;

  const body = article.querySelector<HTMLElement>('[data-concept-body]');
  const sections = body && body.contains(container) ? sectionsForRange(body, range) : [];

  return { markdown, article, body, range, sections };
}
