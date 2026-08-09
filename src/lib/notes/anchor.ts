'use client';

import type { NoteRecord } from '@/lib/persistence/notes';

const CONTEXT = 40;
const ATOM = '.katex';
const EXCLUDE = 'script,style,.katex-mathml,annotation,[data-no-highlight]';

const INLINE_TAGS = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'BUTTON', 'CITE', 'CODE', 'DATA', 'DEL', 'DFN',
  'EM', 'I', 'IMG', 'INPUT', 'INS', 'KBD', 'LABEL', 'MARK', 'PICTURE', 'Q', 'RP', 'RT',
  'RUBY', 'S', 'SAMP', 'SELECT', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TEXTAREA',
  'TIME', 'U', 'VAR', 'WBR',
]);

export interface TextMapNode {
  kind: 'text' | 'atom';
  node: Text | null;
  element: Element | null;
  wrapTarget: Element | null;
  value: string;
  start: number;
  end: number;
  wrappable: boolean;
}

export interface TextMap {
  nodes: TextMapNode[];
  text: string;
}

export interface AppliedNote {
  note: NoteRecord;
  top: number;
  resolved: boolean;
}

function isBlockElement(node: Node | null): boolean {
  return !!node && node.nodeType === Node.ELEMENT_NODE && !INLINE_TAGS.has((node as Element).tagName);
}

function isStructuralWhitespace(node: Text): boolean {
  const value = node.nodeValue ?? '';
  if (value.trim() !== '') return false;
  if (node.parentElement?.closest('pre')) return false;
  const previous = node.previousSibling;
  const next = node.nextSibling;
  if (isBlockElement(previous) || isBlockElement(next)) return true;
  if (!previous && !next && isBlockElement(node.parentElement)) return true;
  return false;
}

function atomText(el: Element): string {
  const tex = el.getAttribute('data-tex')
    ?? el.querySelector('annotation[encoding="application/x-tex"]')?.textContent
    ?? '';
  const clean = tex.replace(/\s+/g, ' ').trim();
  if (!clean) return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return el.closest('.katex-display') ? `$$${clean}$$` : `$${clean}$`;
}

export function collectText(root: HTMLElement): TextMap {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.matches(EXCLUDE)) return NodeFilter.FILTER_REJECT;
        if (el.matches(ATOM)) return NodeFilter.FILTER_ACCEPT;
        if (el.closest(ATOM)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      const text = node as Text;
      const parent = text.parentElement;
      if (!parent || !text.nodeValue) return NodeFilter.FILTER_REJECT;
      if (parent.closest(EXCLUDE) || parent.closest(ATOM)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: TextMapNode[] = [];
  let offset = 0;
  let current: Node | null;

  while ((current = walker.nextNode())) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      const value = atomText(el);
      if (!value) continue;
      nodes.push({
        kind: 'atom',
        node: null,
        element: el,
        wrapTarget: el.closest('.katex-display') ?? el,
        value,
        start: offset,
        end: offset + value.length,
        wrappable: true,
      });
      offset += value.length;
      continue;
    }

    const text = current as Text;
    const value = text.nodeValue ?? '';
    nodes.push({
      kind: 'text',
      node: text,
      element: null,
      wrapTarget: null,
      value,
      start: offset,
      end: offset + value.length,
      wrappable: !isStructuralWhitespace(text),
    });
    offset += value.length;
  }

  return { nodes, text: nodes.map(entry => entry.value).join('') };
}

function boundaryOffset(map: TextMap, container: Node, offset: number, side: 'start' | 'end'): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const entry = map.nodes.find(item => item.node === container);
    if (entry) return entry.start + Math.max(0, Math.min(offset, entry.value.length));
  }

  const el = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
  const atomEl = el?.closest(ATOM);
  if (atomEl) {
    const entry = map.nodes.find(item => item.element === atomEl);
    if (entry) return side === 'start' ? entry.start : entry.end;
  }

  const probe = document.createRange();
  try {
    probe.setStart(container, offset);
    probe.collapse(true);
  } catch {
    return null;
  }

  let before = 0;
  for (const entry of map.nodes) {
    const node = (entry.kind === 'atom' ? entry.element : entry.node) as Node;
    let cmp: number;
    try {
      cmp = probe.comparePoint(node, 0);
    } catch {
      continue;
    }
    if (cmp >= 0) return side === 'start' ? entry.start : before;
    before = entry.end;
  }
  return before;
}

function trimSpan(text: string, start: number, end: number): [number, number] {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from])) from += 1;
  while (to > from && /\s/.test(text[to - 1])) to -= 1;
  return [from, to];
}

export function rangeToAnchor(root: HTMLElement, range: Range) {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const map = collectText(root);
  const rawStart = boundaryOffset(map, range.startContainer, range.startOffset, 'start');
  const rawEnd = boundaryOffset(map, range.endContainer, range.endOffset, 'end');
  if (rawStart == null || rawEnd == null || rawEnd <= rawStart) return null;

  const [start, end] = trimSpan(map.text, rawStart, rawEnd);
  if (end <= start) return null;

  return {
    start,
    exact: map.text.slice(start, end),
    prefix: map.text.slice(Math.max(0, start - CONTEXT), start),
    suffix: map.text.slice(end, end + CONTEXT),
  };
}

function commonSuffix(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function commonPrefix(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

export function resolveAnchor(map: TextMap, note: NoteRecord): [number, number] | null {
  if (!note.exact) return null;
  const { text } = map;
  const hit = (start: number): [number, number] => trimSpan(text, start, start + note.exact.length);

  if (text.slice(note.start, note.start + note.exact.length) === note.exact) return hit(note.start);

  const withContext = `${note.prefix}${note.exact}${note.suffix}`;
  const ctxIdx = text.indexOf(withContext);
  if (ctxIdx !== -1) return hit(ctxIdx + note.prefix.length);

  let best = -1;
  let bestScore = -Infinity;
  for (let from = 0; ; ) {
    const idx = text.indexOf(note.exact, from);
    if (idx === -1) break;
    const before = text.slice(Math.max(0, idx - note.prefix.length), idx);
    const after = text.slice(idx + note.exact.length, idx + note.exact.length + note.suffix.length);
    const score =
      commonSuffix(before, note.prefix) +
      commonPrefix(after, note.suffix) -
      Math.min(20, Math.abs(idx - note.start) / 200);
    if (score > bestScore) { bestScore = score; best = idx; }
    from = idx + 1;
  }
  return best === -1 ? null : hit(best);
}

export function clearMarks(root: HTMLElement) {
  root.querySelectorAll('mark[data-highlight-id]').forEach(mark => {
    mark.replaceWith(...Array.from(mark.childNodes));
  });
  root.normalize();
}

function makeMark(note: NoteRecord) {
  const mark = document.createElement('mark');
  mark.dataset.highlightId = note.id;
  mark.dataset.color = note.color;
  if (note.body.trim()) mark.dataset.hasNote = 'true';
  mark.className = 'hl';
  mark.tabIndex = 0;
  mark.setAttribute('role', 'button');
  mark.setAttribute('aria-label', note.body.trim() ? `Note: ${note.body.slice(0, 60)}` : 'Highlight');
  return mark;
}

function wrap(map: TextMap, start: number, end: number, note: NoteRecord) {
  const marks: HTMLElement[] = [];

  for (const entry of map.nodes) {
    if (!entry.wrappable) continue;
    if (entry.end <= start || entry.start >= end) continue;

    if (entry.kind === 'atom') {
      const target = entry.wrapTarget ?? entry.element;
      if (!target || !target.parentNode) continue;
      const range = document.createRange();
      range.setStartBefore(target);
      range.setEndAfter(target);
      const mark = makeMark(note);
      mark.dataset.math = target.classList.contains('katex-display') ? 'block' : 'inline';
      try {
        range.surroundContents(mark);
        marks.push(mark);
      } catch {
        // leave the formula untouched rather than corrupting the DOM
      }
      continue;
    }

    const textNode = entry.node!;
    const from = Math.max(0, start - entry.start);
    const to = Math.min(textNode.nodeValue?.length ?? 0, end - entry.start);
    if (to <= from) continue;

    const slice = (textNode.nodeValue ?? '').slice(from, to);
    if (!slice.trim() && (entry.start + from === start || entry.start + to === end)) continue;

    const range = document.createRange();
    range.setStart(textNode, from);
    range.setEnd(textNode, to);
    const mark = makeMark(note);
    try {
      range.surroundContents(mark);
      marks.push(mark);
    } catch {
      // skip pathological ranges and keep the rest of the document stable
    }
  }

  return marks;
}

export function applyHighlights(root: HTMLElement, originEl: HTMLElement, notes: NoteRecord[]): AppliedNote[] {
  clearMarks(root);
  const originTop = originEl.getBoundingClientRect().top + window.scrollY;
  const out: AppliedNote[] = [];

  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    const map = collectText(root);
    const span = resolveAnchor(map, note);
    if (!span) {
      out.push({ note, top: 0, resolved: false });
      continue;
    }
    const marks = wrap(map, span[0], span[1], note);
    const first = marks[0];
    const top = first ? first.getBoundingClientRect().top + window.scrollY - originTop : 0;
    out.push({ note, top, resolved: marks.length > 0 });
  }

  return out;
}

export function setActiveHighlight(root: HTMLElement, id: string | null) {
  root.querySelectorAll<HTMLElement>('mark[data-highlight-id]').forEach(mark => {
    if (id && mark.dataset.highlightId === id) mark.dataset.active = 'true';
    else delete mark.dataset.active;
  });
}