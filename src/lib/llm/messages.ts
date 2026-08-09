'use client';

import type { ChatMessage } from './types';

/**
 * Guarantees the invariant every chat template needs:
 * - at most one system message, and it is first
 * - no empty messages
 * - no consecutive messages with the same role
 * - conversation ends on a user turn
 */
export function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content.trim())
    .filter(Boolean)
    .join('\n\n');

  const turns: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    const content = (message.content ?? '').trim();
    if (!content) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${content}`;
      continue;
    }
    turns.push({ role: message.role, content });
  }

  while (turns.length && turns[0].role === 'assistant') turns.shift();
  while (turns.length && turns[turns.length - 1].role === 'assistant') turns.pop();

  const out: ChatMessage[] = [];
  if (system) out.push({ role: 'system', content: system });
  if (turns.length) out.push(...turns);
  else out.push({ role: 'user', content: 'Explain the context above.' });
  return out;
}