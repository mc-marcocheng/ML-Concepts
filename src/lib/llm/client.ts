'use client';

import { create } from 'zustand';
import type { AskContext, GenerateOptions, ProviderId, ReasoningEffort, RemoteModelConfig } from './types';
import { sanitizeMessages } from './messages';
import { generateGroundedReply } from './prompts';
import { generateRemoteReply } from './providers/remote';
import { generateWebGpuReply, unloadWebGpuModel } from './providers/webgpu';
import { startTrace } from './trace';
import { DEFAULT_ON_DEVICE_KEY, normaliseModelKey } from './capability';

const STORAGE_KEYS = {
  enabled: 'mlc.llmEnabled',
  provider: 'mlc.llmProvider',
  remoteModel: 'mlc.remoteModel',
  onDeviceModel: 'mlc.onDeviceModel',
  baseUrl: 'mlc.llmBaseUrl',
  apiKey: 'mlc.llmApiKey',
  rememberApiKey: 'mlc.llmRememberApiKey',
  maxTokens: 'mlc.llmMaxTokens',
  reasoningEffort: 'mlc.llmReasoningEffort',
};

const DEFAULT_MAX_TOKENS = 1024;

interface LlmState {
  status: 'idle' | 'ready' | 'off';
  enabled: boolean;
  provider: ProviderId;
  onDeviceModelKey: string;
  remote: RemoteModelConfig;
  rememberApiKey: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setEnabled: (enabled: boolean) => void;
  setProvider: (provider: ProviderId) => void;
  setOnDeviceModel: (modelKey: string) => void;
  setRemote: (config: Partial<RemoteModelConfig>) => void;
  setRememberApiKey: (remember: boolean) => void;
  generate: (options: GenerateOptions, onToken?: (token: string) => void, context?: AskContext | null) => Promise<string>;
}

function readLocalStorage(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function readSessionStorage(key: string, fallback: string) {
  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeApiKey(apiKey: string, remember: boolean) {
  try {
    if (remember) {
      window.localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
      window.sessionStorage.removeItem(STORAGE_KEYS.apiKey);
    } else {
      window.sessionStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
      window.localStorage.removeItem(STORAGE_KEYS.apiKey);
    }
  } catch {
    // best effort only
  }
}

function isLocalEndpoint(baseUrl: string) {
  return /localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0/i.test(baseUrl);
}

export function ensureLlmHydrated() {
  if (typeof window === 'undefined') return;
  if (!useLlm.getState().hydrated) useLlm.getState().hydrate();
}

export const useLlm = create<LlmState>(set => ({
  status: 'idle',
  enabled: true,
  provider: 'ondevice',
  onDeviceModelKey: DEFAULT_ON_DEVICE_KEY,
  remote: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    maxTokens: DEFAULT_MAX_TOKENS,
    reasoningEffort: 'low',
  },
  rememberApiKey: false,
  hydrated: false,
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const enabled = readLocalStorage(STORAGE_KEYS.enabled, '1') !== '0';
    const provider = readLocalStorage(STORAGE_KEYS.provider, 'ondevice') as ProviderId;
    const onDeviceModelKey = normaliseModelKey(readLocalStorage(STORAGE_KEYS.onDeviceModel, DEFAULT_ON_DEVICE_KEY));
    const remoteModel = readLocalStorage(STORAGE_KEYS.remoteModel, 'gpt-4o-mini');
    const baseUrl = readLocalStorage(STORAGE_KEYS.baseUrl, 'https://api.openai.com/v1');
    const rememberApiKey = readLocalStorage(STORAGE_KEYS.rememberApiKey, '0') === '1';
    const maxTokens = Number(readLocalStorage(STORAGE_KEYS.maxTokens, String(DEFAULT_MAX_TOKENS))) || DEFAULT_MAX_TOKENS;
    const reasoningEffort = readLocalStorage(STORAGE_KEYS.reasoningEffort, 'low') as ReasoningEffort;
    const localApiKey = readLocalStorage(STORAGE_KEYS.apiKey, '');
    const sessionApiKey = readSessionStorage(STORAGE_KEYS.apiKey, '');
    const apiKey = rememberApiKey ? localApiKey : (sessionApiKey || localApiKey);
    if (!rememberApiKey && localApiKey && !sessionApiKey) {
      try {
        window.sessionStorage.setItem(STORAGE_KEYS.apiKey, localApiKey);
        window.localStorage.removeItem(STORAGE_KEYS.apiKey);
      } catch {
        // best effort only
      }
    }
    set({
      enabled,
      provider,
      onDeviceModelKey,
      rememberApiKey,
      remote: {
        baseUrl,
        apiKey,
        model: remoteModel,
        maxTokens,
        reasoningEffort,
      },
      status: enabled ? 'ready' : 'off',
      hydrated: true,
    });
  },
  setEnabled: enabled => {
    window.localStorage.setItem(STORAGE_KEYS.enabled, enabled ? '1' : '0');
    set({ enabled, status: enabled ? 'ready' : 'off' });
  },
  setProvider: provider => {
    window.localStorage.setItem(STORAGE_KEYS.provider, provider);
    set(state => ({
      provider,
      status: state.enabled ? 'ready' : 'off',
    }));
  },
  setOnDeviceModel: modelKey => {
    window.localStorage.setItem(STORAGE_KEYS.onDeviceModel, modelKey);
    set({ onDeviceModelKey: modelKey });
  },
  setRemote: config => {
    const next = { ...useLlm.getState().remote, ...config };
    if (config.baseUrl !== undefined) window.localStorage.setItem(STORAGE_KEYS.baseUrl, next.baseUrl);
    if (config.apiKey !== undefined) writeApiKey(next.apiKey, useLlm.getState().rememberApiKey);
    if (config.model !== undefined) window.localStorage.setItem(STORAGE_KEYS.remoteModel, next.model);
    if (config.maxTokens !== undefined) window.localStorage.setItem(STORAGE_KEYS.maxTokens, String(next.maxTokens));
    if (config.reasoningEffort !== undefined) window.localStorage.setItem(STORAGE_KEYS.reasoningEffort, next.reasoningEffort);
    set({ remote: next });
  },
  setRememberApiKey: remember => {
    window.localStorage.setItem(STORAGE_KEYS.rememberApiKey, remember ? '1' : '0');
    const current = useLlm.getState().remote.apiKey;
    writeApiKey(current, remember);
    set({ rememberApiKey: remember });
  },
  async generate(options, onToken, context) {
    ensureLlmHydrated();
    const { temperature = 0.2, maxTokens, signal, fallback = 'grounded', responseFormat, onStatus } = options;
    const messages = sanitizeMessages(options.messages);
    const question = [...messages].reverse().find(message => message.role === 'user')?.content ?? '';
    const state = useLlm.getState();
    let response = '';
    const tracer = startTrace(options.trace?.name ?? 'llm', {
      provider: state.provider,
      model: state.provider === 'remote' ? state.remote.model : state.onDeviceModelKey,
      systemMessages: messages.filter(message => message.role === 'system').length,
    });

    const grounded = async () => {
      const text = await tracer.span('grounded', 'retriever', { question }, async span => {
        const reply = await generateGroundedReply(context ?? null, question);
        span.setOutput(reply);
        return reply;
      });
      if (onToken) {
        for (const token of text.split(/(\s+)/)) onToken(token);
      }
      return text;
    };

    try {
      if (!state.enabled) {
        if (fallback === 'error') throw new Error('Assistant is off. Turn it on in Settings → Assistant.');
        return await grounded();
      }

      if (state.provider === 'remote') {
        if (!(state.remote.apiKey.trim() || isLocalEndpoint(state.remote.baseUrl))) {
          if (fallback === 'error') throw new Error('No API key configured for the remote endpoint.');
          return await grounded();
        }
        response = await tracer.span('generate', 'llm', { messages }, async span => {
          const text = await generateRemoteReply(
            { ...state.remote, apiKey: state.remote.apiKey, baseUrl: state.remote.baseUrl, model: state.remote.model },
            messages,
            { temperature, maxTokens: maxTokens ?? state.remote.maxTokens, signal, responseFormat, onToken, onStatus },
          );
          if (!text.trim()) {
            throw new Error('Remote model returned an empty reply.');
          }
          span.setOutput(text);
          return text;
        });
        return response;
      }

      if (state.provider === 'ondevice') {
        try {
          response = await tracer.span('generate', 'llm', { messages }, async span => {
            const text = await generateWebGpuReply(
              state.onDeviceModelKey,
              { messages, temperature, maxTokens: maxTokens ?? DEFAULT_MAX_TOKENS, signal, onStatus },
              onToken,
            );
            span.setOutput(text);
            return text;
          });
        } catch (error) {
          if ((error as Error).name === 'AbortError') throw error;
          if (fallback === 'error') throw new Error(`On-device model unavailable: ${(error as Error).message}`);
          onStatus?.('on-device model unavailable — answering from local notes');
          response = await grounded();
        }
      } else {
        response = await grounded();
      }
      return response;
    } finally {
      tracer.end();
    }
  },
}));

export async function resetWebGpuRuntime() {
  await unloadWebGpuModel();
}
