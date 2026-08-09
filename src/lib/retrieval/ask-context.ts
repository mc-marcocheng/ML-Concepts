'use client';

import type { AskContext } from '@/lib/llm/types';
import { captureSelection, sectionsForRange, type CapturedSelection } from './selection';

function baseFromArticle(article: HTMLElement): AskContext {
  return {
    conceptId: article.dataset.conceptId ?? null,
    conceptTitle: article.dataset.conceptTitle,
    summary: article.dataset.conceptSummary,
  };
}

export function contextFromSelection(capture: CapturedSelection): AskContext {
  const selectedSections = capture.sections.filter(section => section.selected);
  const selectedHeadings = selectedSections.map(section => section.heading);
  return {
    ...baseFromArticle(capture.article),
    selection: capture.markdown,
    sections: capture.sections,
    headings: selectedHeadings,
    heading: selectedHeadings[0],
    sectionText: selectedSections.map(section => section.text).join('\n\n'),
  };
}

export function currentConceptContext(): AskContext | null {
  if (typeof document === 'undefined') return null;
  const article = document.querySelector<HTMLElement>('[data-askable][data-concept-id]');
  if (!article) return null;
  const body = article.querySelector<HTMLElement>('[data-concept-body]');
  return { ...baseFromArticle(article), sections: body ? sectionsForRange(body, null) : [] };
}

export function contextFromCurrentSelection(): AskContext | null {
  const capture = captureSelection();
  return capture ? contextFromSelection(capture) : null;
}