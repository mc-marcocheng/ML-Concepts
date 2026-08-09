import type { AskContext, ChatMessage, ContextSection } from './types';
import { searchChunks } from '@/lib/retrieval/search';
import { loadConceptSections, rankSections } from '@/lib/retrieval/concept-text';

const SYSTEM = `You are a precise ML tutor helping an experienced practitioner revise for interviews.

Rules:
- Assume calculus, probability and core ML are known. No filler, no restating the question.
- Answer in 3-8 sentences or a tight list. Lead with the direct answer.
- The HIGHLIGHT block is what the user is looking at right now: answer about that first.
- Ground claims in CONTEXT. If CONTEXT does not settle the question, answer from general knowledge and say plainly which part is not in the notes.
- Write mathematics as LaTeX: $inline$ and $$display$$. Never emit placeholders such as [math].
- RELATED NOTES are from other concepts and are often irrelevant. Use them only if they clearly help; never build the answer around them.`;

const TOTAL_BUDGET = 7000;
const clip = (value = '', length = 1400) => (value.length > length ? `${value.slice(0, length)}…` : value);

export function buildRetrievalQuery(context: AskContext | null, question: string) {
  return [question, clip(context?.selection ?? '', 500), (context?.headings ?? []).join(' '), context?.conceptTitle ?? '']
    .filter(Boolean)
    .join(' \n ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveSections(context: AskContext | null, question: string): Promise<ContextSection[]> {
  if (context?.sections?.length) return context.sections;
  if (context?.sectionText) {
    return [{ id: '', heading: context.heading ?? 'Overview', text: context.sectionText, selected: true }];
  }
  if (context?.conceptId) {
    const all = await loadConceptSections(context.conceptId);
    return rankSections(all, buildRetrievalQuery(context, question), 4);
  }
  return [];
}

export async function buildContextBlocks(context: AskContext | null, question: string, budget = TOTAL_BUDGET): Promise<string[]> {
  if (!context) return [];
  const blocks: string[] = [];
  const spent = () => blocks.reduce((sum, block) => sum + block.length + 2, 0);
  const push = (text: string) => {
    if (text.trim() && spent() + text.length <= budget) blocks.push(text.trim());
  };

  if (context.conceptTitle) {
    push(`## Note\n${context.conceptTitle}${context.summary ? `\n${clip(context.summary, 400)}` : ''}`);
  }

  if (context.selection?.trim()) {
    const where = context.headings?.length ? ` (spans: ${context.headings.join(' → ')})` : '';
    push(`## HIGHLIGHT — the exact text the user selected${where}\n"""\n${clip(context.selection, 1800)}\n"""`);
  }

  const sections = await resolveSections(context, question);
  if (sections.length) {
    const focus = sections.some(section => section.selected) ? sections.filter(section => section.selected) : sections;
    const rest = sections.filter(section => !focus.includes(section));

    const perFocus = Math.max(600, Math.floor((budget * 0.55) / Math.max(1, focus.length)));
    push(`## Note content (sections the highlight covers)\n${focus
      .map(section => `### ${section.heading}\n${clip(section.text, perFocus)}`)
      .join('\n\n')}`);

    if (rest.length) {
      const perRest = Math.max(200, Math.floor((budget * 0.15) / Math.max(1, rest.length)));
      push(`## Rest of the note (abridged)\n${rest
        .map(section => `### ${section.heading}\n${clip(section.text, perRest)}`)
        .join('\n\n')}`);
    }
  }

  const remaining = budget - spent();
  if (remaining > 700) {
    const covered = new Set(sections.map(section => `${context.conceptId}::${section.heading.toLowerCase()}`));
    const hits = await searchChunks(buildRetrievalQuery(context, question), {
      limit: 3,
      preferConceptId: context.conceptId,
      minRelativeScore: 0.45,
      maxPerConcept: 2,
    });
    const useful = hits.filter(hit => !covered.has(`${hit.conceptId}::${hit.heading.toLowerCase()}`));
    if (useful.length) {
      push(`## Related notes (other concepts — use only if relevant)\n${useful
        .map(hit => `- (${hit.conceptTitle} › ${hit.heading}) ${clip(hit.text, 380)}`)
        .join('\n')}`);
    }
  }

  return blocks;
}

export async function buildChatMessages(
  context: AskContext | null,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  options: { budget?: number } = {},
): Promise<ChatMessage[]> {
  const blocks = await buildContextBlocks(context, question, options.budget ?? TOTAL_BUDGET);
  const system = blocks.length ? `${SYSTEM}\n\n# CONTEXT\n${blocks.join('\n\n')}` : SYSTEM;

  const trimmed = history
    .filter(message => message.content.trim())
    .slice(-6)
    .map(message => ({ role: message.role, content: message.content } as ChatMessage));

  let user = question.trim() || 'Explain the highlighted text in plain terms, then give the precise statement.';
  if (context?.selection?.trim()) {
    user += `\n\nFocus on this highlighted passage:\n"""\n${clip(context.selection, 600)}\n"""`;
  }

  return [{ role: 'system', content: system }, ...trimmed, { role: 'user', content: user }];
}

export async function generateGroundedReply(context: AskContext | null, question: string) {
  const blocks = await buildContextBlocks(context, question, 3500);
  if (!blocks.length) {
    return 'The assistant model is unavailable and there is no local context for this page. Open a concept and highlight the relevant passage, or configure a remote model in Settings → Assistant.';
  }
  return [
    '_The model is unavailable, so this is the raw local context rather than an answer._',
    '',
    ...blocks,
  ].join('\n\n');
}
