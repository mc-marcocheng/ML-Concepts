'use client';

import { memo, useDeferredValue, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import { normalizeMarkdownMath } from '@/lib/llm/markdown';
import { cn } from '@/lib/utils/cn';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const REMARK = [remarkGfm, remarkMath, remarkBreaks];
const REHYPE: Parameters<typeof ReactMarkdown>[0]['rehypePlugins'] = [[rehypeKatex, { output: 'htmlAndMathml', throwOnError: false, strict: 'ignore', trust: false }]];

const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE}>
        {normalizeMarkdownMath(content)}
      </ReactMarkdown>
    </div>
  );
});

function Bubble({ message, live }: { message: ChatMessage; live: boolean }) {
  const deferred = useDeferredValue(message.content);
  const body = live ? deferred : message.content;
  return (
    <article className={cn('rounded-lg p-4 text-[15px] leading-7', message.role === 'user' ? 'ml-8 bg-primary-pale text-ink' : 'bg-canvas-soft text-body')}>
      <Markdown content={body} />
      {live && !body ? <span className="chat-caret" aria-hidden="true" /> : null}
    </article>
  );
}

export function MessageList({ messages, streaming, status, wide }: { messages: ChatMessage[]; streaming?: boolean; status?: string | null; wide?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (pinned.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, status]);

  return (
    <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className={cn('mx-auto grid w-full gap-3', wide && 'max-w-[52rem]')} aria-live="polite" aria-busy={streaming ? 'true' : 'false'}>
        {messages.map((message, index) => (
          <Bubble key={index} message={message} live={Boolean(streaming) && index === messages.length - 1 && message.role === 'assistant'} />
        ))}
        {streaming && status ? <p className="px-1 font-mono text-[11px] text-muted">{status}</p> : null}
      </div>
    </div>
  );
}
