import type { ChatMessage, ReasoningEffort, RemoteModelConfig } from '../types';
import { sanitizeMessages } from '../messages';

export interface RemoteRequestOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  responseFormat?: 'text' | 'json_object';
  onToken?: (token: string) => void;
  onStatus?: (status: string) => void;
}

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string; reasoning_content?: string; reasoning?: string }; finish_reason?: string }>;
  error?: { message?: string; code?: string; param?: string };
};

const REASONING_MODEL = /(^|[-/])(o[1-9]|gpt-5|deepseek-r\d|r1|qwq|magistral)|think|reason/i;
const THINK_BLOCK = /<(think|thinking|reasoning|analysis)>[\s\S]*?(<\/\1>|$)/gi;

function parseSseLine(line: string) {
  const payload = line.trim().slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string; reasoning_content?: string; reasoning?: string }; finish_reason?: string }>;
      error?: { message?: string };
    };
  } catch {
    return null;
  }
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function isReasoningModel(model: string) {
  return REASONING_MODEL.test(model || '');
}

export function stripThinking(text: string) {
  return text.replace(THINK_BLOCK, '').replace(/^\s*\n/, '').trim();
}

function budgetFor(model: string, requested: number, effort: ReasoningEffort) {
  if (!isReasoningModel(model) || effort === 'none') return Math.max(requested, 256);
  const reserve = effort === 'high' ? 4096 : effort === 'medium' ? 2048 : 1024;
  return Math.min(32_000, Math.max(requested, 256) + reserve);
}

function buildBody(config: RemoteModelConfig, messages: ChatMessage[], options: RemoteRequestOptions, stream: boolean) {
  const reasoning = isReasoningModel(config.model);
  const body: Record<string, unknown> = {
    model: config.model,
    messages: sanitizeMessages(messages),
    stream,
    [reasoning ? 'max_completion_tokens' : 'max_tokens']: budgetFor(config.model, options.maxTokens ?? config.maxTokens ?? 600, config.reasoningEffort ?? 'low'),
  };
  if (!reasoning) body.temperature = options.temperature ?? 0.2;
  if (reasoning && (config.reasoningEffort ?? 'low') !== 'none') body.reasoning_effort = config.reasoningEffort ?? 'low';
  if (options.responseFormat === 'json_object') body.response_format = { type: 'json_object' };
  return body;
}

async function runOnce(
  config: RemoteModelConfig,
  messages: ChatMessage[],
  options: RemoteRequestOptions,
  stream: boolean,
) {
  const baseUrl = trimSlash(config.baseUrl || 'https://api.openai.com/v1');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(buildBody(config, messages, options, stream)),
    signal: options.signal,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as OpenAiChatResponse;
    const message = data.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (stream && response.body) {
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let raw = '';
    let finish = '';
    let reasoned = false;

    for (;;) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim().startsWith('data:')) continue;
        const parsed = parseSseLine(line);
        if (!parsed) continue;
        if (parsed.error?.message) throw new Error(parsed.error.message);
        const choice = parsed.choices?.[0];
        if (choice?.finish_reason) finish = choice.finish_reason;
        const hidden = choice?.delta?.reasoning_content ?? choice?.delta?.reasoning ?? '';
        if (hidden) {
          reasoned = true;
          options.onStatus?.('thinking…');
        }
        const delta = choice?.delta?.content ?? '';
        if (delta) {
          raw += delta;
          options.onToken?.(delta);
        }
      }
    }
    return { text: stripThinking(raw), finish, reasoned };
  }

  const data = (await response.json().catch(() => ({}))) as OpenAiChatResponse;
  const choice = data.choices?.[0];
  const text = stripThinking(choice?.message?.content ?? '');
  return { text, finish: choice?.finish_reason ?? '', reasoned: Boolean(choice?.message?.reasoning_content || choice?.message?.reasoning) };
}

export async function generateRemoteReply(
  config: RemoteModelConfig,
  messages: ChatMessage[],
  options: RemoteRequestOptions = {},
) {
  let stream = Boolean(options.onToken);
  let budget = options.maxTokens ?? config.maxTokens ?? 600;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await runOnce(config, messages, options, stream);
    if (result.text.trim()) return result.text.trim();

    const canRetry = result.finish === 'length' || result.reasoned || !result.finish;
    if (!canRetry || budget >= 16_000) break;
    options.onStatus?.('retrying with a larger completion budget…');
    stream = false;
    budget = Math.min(16_000, Math.max(budget * 2, 2048));
    options = { ...options, maxTokens: budget };
  }

  throw new Error('Remote model returned an empty reply. Increase Max output tokens or lower Reasoning effort in Settings → Assistant.');
}
