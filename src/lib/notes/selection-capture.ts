'use client';

import { rangeToAnchor } from '@/lib/notes/anchor';
import { contextFromSelection } from '@/lib/retrieval/ask-context';
import { sectionsForRange, selectionToMarkdown } from '@/lib/retrieval/selection';
import type { AskContext, ContextSection } from '@/lib/llm/types';

export interface CapturedSelection {
  range: Range;
  text: string;
  anchor: NonNullable<ReturnType<typeof rangeToAnchor>>;
  rects: DOMRect[];
  markdown: string;
  article: HTMLElement;
  body: HTMLElement | null;
  sections: ContextSection[];
  context: AskContext;
}

const MIN_CHARS = 2;
const FORM_FIELDS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export function isCoarsePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/** Client rects, de-noised and merged per visual line. */
export function selectionRects(range: Range): DOMRect[] {
  const raw = Array.from(range.getClientRects()).filter(rect => rect.width > 0.5 && rect.height > 0.5);
  const merged: DOMRect[] = [];

  for (const rect of raw) {
    const last = merged[merged.length - 1];
    const sameLine =
      !!last &&
      Math.abs(last.top - rect.top) < 2 &&
      Math.abs(last.height - rect.height) < 3 &&
      rect.left - last.right < 4;

    if (sameLine) {
      const left = Math.min(last.left, rect.left);
      const top = Math.min(last.top, rect.top);
      merged[merged.length - 1] = new DOMRect(
        left,
        top,
        Math.max(last.right, rect.right) - left,
        Math.max(last.bottom, rect.bottom) - top,
      );
      continue;
    }

    merged.push(rect);
  }

  return merged;
}

/**
 * Read-only. Returns a capture for a real, non-trivial selection inside `root`.
 * MUST NOT mutate the selection in any way — the user may still be adjusting it.
 */
export function captureSelection(root: HTMLElement): CapturedSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
  if (!element || !root.contains(element) || element.closest(FORM_FIELDS)) return null;

  const markdown = selectionToMarkdown(selection);
  const text = markdown.replace(/\s+/g, ' ').trim();
  if (text.length < MIN_CHARS) return null;

  const anchor = rangeToAnchor(root, range);
  if (!anchor) return null;

  const body = root.querySelector<HTMLElement>('[data-concept-body]');
  const sections = body ? sectionsForRange(body, range) : [];
  const cloned = range.cloneRange();

  return {
    range: cloned,
    text,
    anchor,
    rects: selectionRects(cloned),
    markdown,
    article: root,
    body,
    sections,
    context: contextFromSelection({
      markdown,
      article: root,
      body,
      range: cloned,
      sections,
    }),
  };
}

/** Desktop-only convenience; the OS menu owns Copy on touch. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  field.remove();
  return ok;
}
