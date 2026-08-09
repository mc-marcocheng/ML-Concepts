'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Maximize2, Minimize2, Plus, Send, Square, X } from 'lucide-react';
import Link from 'next/link';
import { Sheet } from '@/components/layout/Sheet';
import { useUiStore } from '@/lib/store/ui';
import { useLlm } from '@/lib/llm/client';
import { buildChatMessages } from '@/lib/llm/prompts';
import { currentConceptContext } from '@/lib/retrieval/ask-context';
import { ContextChip } from './ContextChip';
import { MessageList, type ChatMessage } from './MessageList';
import { Button } from '@/components/ui/Button';
import { AssistantStatusPill } from './AssistantStatusPill';

const QUICK = [
  'Explain this in plain terms, then give the precise statement.',
  'Give a worked example with numbers.',
  'When does this fail or break down?',
  'Turn this into a flashcard (Q on one side, A on the other).',
];

const WIDE_KEY = 'mlc.askWide';
const MAX_ROWS = 4;

function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 20;
    const chrome =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const max = Math.round(line * MAX_ROWS + chrome);
    el.style.height = 'auto';
    const content = el.scrollHeight;
    el.style.height = `${Math.min(content + border, max + border)}px`;
    el.style.overflowY = content > max ? 'auto' : 'hidden';
  }, [ref, value]);
}

export function AskDock() {
  const askOpen = useUiStore(state => state.askOpen);
  const askContext = useUiStore(state => state.askContext);
  const consumeSeed = useUiStore(state => state.consumeSeed);
  const openAsk = useUiStore(state => state.openAsk);
  const closeAsk = useUiStore(state => state.closeAsk);
  const generate = useLlm(state => state.generate);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [wide, setWide] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useAutosize(inputRef, input);

  useEffect(() => {
    try { setWide(window.localStorage.getItem(WIDE_KEY) === '1'); } catch { /* ignore */ }
  }, []);

  const toggleWide = useCallback(() => {
    setWide(current => {
      const next = !current;
      try { window.localStorage.setItem(WIDE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!askOpen) return;
    const seed = consumeSeed();
    if (seed) setInput(seed);
  }, [askOpen, consumeSeed]);

  useEffect(() => {
    if (!askOpen || askContext || contextDismissed) return;
    const ctx = currentConceptContext();
    if (ctx?.conceptId) openAsk(ctx);
  }, [askOpen, askContext, contextDismissed, openAsk]);

  useEffect(() => {
    if (!askOpen) setContextDismissed(false);
  }, [askOpen]);

  useEffect(() => {
    if (!askOpen) abortRef.current?.abort();
  }, [askOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput('');
    setError(null);
    setStatus(null);
    setStreaming(false);
    setContextDismissed(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  async function send(text = input) {
    if (!text.trim() || streaming) return;
    setError(null);
    setStatus(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const history = messages;
    setMessages([...history, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: '' }]);
    setInput('');
    setStreaming(true);
    try {
      const promptMessages = await buildChatMessages(askContext, text, history);
      const response = await generate({ messages: promptMessages, temperature: 0.2, signal: controller.signal, trace: { name: 'ask', context: askContext ?? undefined }, onStatus: setStatus }, token => {
        setMessages(current => {
          const copy = [...current];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { role: 'assistant', content: last.content + token };
          return copy;
        });
      }, askContext);
      if (!response.trim()) {
        setMessages(current => {
          const copy = [...current];
          copy[copy.length - 1] = { role: 'assistant', content: 'I do not have enough local context to answer confidently.' };
          return copy;
        });
      }
    } catch (caught) {
      const aborted = (caught as Error).name === 'AbortError';
      setMessages(current => {
        const copy = [...current];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && !last.content.trim()) copy.pop();
        return copy;
      });
      const message = aborted ? null : ((caught as Error).message || 'Request failed.');
      setError(message);
    } finally {
      setStreaming(false);
      setStatus(null);
      abortRef.current = null;
    }
  }

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="t-eyebrow text-muted">Assistant</span>
        <AssistantStatusPill />

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={newConversation}
            disabled={messages.length === 0 && !input.trim()}
            aria-label="New conversation"
            title="New conversation"
            className="flex min-h-10 items-center gap-1.5 rounded-pill border border-line bg-card px-3 text-[13px] font-semibold text-ink hover:bg-primary-pale disabled:opacity-40"
          >
            <Plus size={15} aria-hidden="true" /> New chat
          </button>
          <Link href="/settings/#assistant" onClick={closeAsk} className="hidden rounded-pill border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-primary-pale sm:inline-flex">
            Configure
          </Link>
          <button
            onClick={toggleWide}
            aria-label={wide ? 'Restore panel width' : 'Expand panel to full width'}
            title={wide ? 'Restore width' : 'Expand to full width'}
            aria-pressed={wide}
            className="hidden h-11 w-11 place-items-center rounded-pill text-ink hover:bg-primary hover:text-on-primary lg:grid"
          >
            {wide ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
          </button>
          <button onClick={closeAsk} aria-label="Close assistant" className="grid h-11 w-11 place-items-center rounded-pill text-ink hover:bg-primary hover:text-on-primary">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {error ? <p role="status" className="mx-3 mt-3 rounded-md bg-warning-pale px-3 py-2 text-[13px] text-warning-content">{error}</p> : null}

      {askContext ? (
        <ContextChip
          ctx={askContext}
          onClearSelection={() => openAsk({ ...askContext, selection: undefined, headings: undefined, heading: undefined, sectionText: undefined, sections: askContext.sections?.map(section => ({ ...section, selected: false })) })}
          onClearAll={() => { setContextDismissed(true); openAsk(null); }}
        />
      ) : null}

      <MessageList messages={messages} streaming={streaming} status={status} wide={wide} />

      {messages.length === 0 ? (
        <div className="mx-auto flex w-full max-w-208 flex-wrap gap-2 px-4 pb-3">
          {QUICK.map(question => (
            <button key={question} onClick={() => send(question)} className="min-h-10 rounded-pill border border-line bg-card px-3 py-2 text-[13px] text-ink hover:bg-primary-pale">
              {question}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={event => { event.preventDefault(); send(); }} className="border-t border-line p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-208 items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            rows={1}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Ask about this concept…"
            aria-label="Message"
            className="flex-1 resize-none overflow-hidden rounded-md border border-line bg-card p-3 text-[15px] leading-6 text-ink hover:border-body focus:border-line-strong"
          />
          <Button
            type={streaming ? 'button' : 'submit'}
            variant="icon"
            aria-label={streaming ? 'Stop generating' : 'Send'}
            onClick={streaming ? () => abortRef.current?.abort() : undefined}
          >
            {streaming ? <Square size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <Sheet open={askOpen} onOpenChange={open => (open ? openAsk(askContext ?? null) : closeAsk())} side="right" title="Assistant" widthClass={wide ? 'w-screen max-w-none' : 'w-[min(720px,100vw)]'}>
        {body}
      </Sheet>
      {!askOpen ? (
        <button
          onClick={() => openAsk(null)}
          aria-label="Open assistant"
          className="fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary shadow-offset transition-transform hover:-translate-y-px hover:bg-primary-hover lg:flex"
        >
          Ask
        </button>
      ) : null}
    </>
  );
}
