import type { ChatMessage, GenerateOptions } from '../types';
import { getOnDeviceModel, resolveModelId } from '../capability';
import { sanitizeMessages } from '../messages';
import type { MLCEngine } from '@mlc-ai/web-llm';

let engine: MLCEngine | null = null;
let activeModelKey = '';
const cancelled = new Set<string>();

class PreloadCancelled extends Error {}

async function createEngine(modelKey: string, onProgress?: (pct: number, text: string) => void) {
  const spec = getOnDeviceModel(modelKey);
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  const modelId = await resolveModelId(spec);
  return CreateMLCEngine(modelId, {
    initProgressCallback: (event: { progress?: number; text?: string }) => {
      if (cancelled.has(modelKey)) throw new PreloadCancelled('cancelled');
      onProgress?.(Math.round((event.progress ?? 0) * 100), event.text ?? '');
    },
  });
}

export async function isModelCached(modelKey: string): Promise<boolean> {
  try {
    const spec = getOnDeviceModel(modelKey);
    const modelId = await resolveModelId(spec);
    const mod: typeof import('@mlc-ai/web-llm') = await import('@mlc-ai/web-llm');
    if (typeof mod.hasModelInCache !== 'function') return false;
    return await mod.hasModelInCache(modelId, mod.prebuiltAppConfig);
  } catch {
    return false;
  }
}

export async function deleteWebGpuModel(modelKey: string) {
  const spec = getOnDeviceModel(modelKey);
  const modelId = await resolveModelId(spec);
  if (activeModelKey === modelKey) await unloadWebGpuModel();
  const mod: typeof import('@mlc-ai/web-llm') = await import('@mlc-ai/web-llm');
  if (typeof mod.deleteModelAllInfoInCache === 'function') {
    await mod.deleteModelAllInfoInCache(modelId, mod.prebuiltAppConfig);
  } else {
    await clearWebGpuCache();
  }
}

export function cancelPreload(modelKey: string) {
  cancelled.add(modelKey);
}

export async function generateWebGpuReply(modelKey: string, options: GenerateOptions, onToken?: (token: string) => void, onStatus?: (status: string) => void) {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    throw new Error('WebGPU is not available in this browser');
  }

  if (!engine || activeModelKey !== modelKey) {
    await engine?.unload?.();
    onStatus?.('loading on-device model…');
    engine = await createEngine(modelKey, (pct, text) => {
      onStatus?.(text ? `loading on-device model ${pct}% · ${text}` : `loading on-device model ${pct}%`);
    });
    activeModelKey = modelKey;
    onStatus?.('model ready');
  }

  const messages = sanitizeMessages(options.messages);
  const response = await engine.chat.completions.create({
    messages: messages as ChatMessage[],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 512,
    stream: true,
  });

  let output = '';
  let visible = '';
  let pending = '';
  let thinking = false;

  for await (const chunk of response) {
    if (options.signal?.aborted) {
      await engine.interruptGenerate?.();
      throw new DOMException('Aborted', 'AbortError');
    }
    const token = chunk.choices?.[0]?.delta?.content ?? '';
    if (!token) continue;
    output += token;
    pending += token;

    for (;;) {
      if (thinking) {
        const close = pending.search(/<\/(think|thinking|reasoning|analysis)>/i);
        if (close === -1) {
          pending = pending.slice(-20);
          onStatus?.('thinking…');
          break;
        }
        pending = pending.slice(close + 8);
        thinking = false;
        onStatus?.('');
        continue;
      }

      const open = pending.search(/<(think|thinking|reasoning|analysis)>/i);
      if (open === -1) {
        const safe = pending.length > 12 ? pending.slice(0, -12) : '';
        if (safe) {
          visible += safe;
          onToken?.(safe);
          pending = pending.slice(safe.length);
        }
        break;
      }

      const before = pending.slice(0, open);
      if (before) {
        visible += before;
        onToken?.(before);
      }
      pending = pending.slice(open + 7);
      thinking = true;
    }
  }
  if (!thinking && pending) {
    visible += pending;
    onToken?.(pending);
  }
  return (visible.trim() || output.replace(/<(think|thinking|reasoning|analysis)>[\s\S]*?<\/(think|thinking|reasoning|analysis)>/gi, '').trim());
}

export async function unloadWebGpuModel() {
  await engine?.unload?.();
  engine = null;
  activeModelKey = '';
}

export async function preloadWebGpuModel(modelKey: string, onProgress?: (pct: number, text: string) => void) {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    throw new Error('WebGPU is not available in this browser');
  }
  cancelled.delete(modelKey);
  try {
    const preloaded = await createEngine(modelKey, onProgress);
    await preloaded?.unload?.();
    return 'done' as const;
  } catch (error) {
    if (error instanceof PreloadCancelled || cancelled.has(modelKey)) return 'cancelled' as const;
    throw error;
  } finally {
    cancelled.delete(modelKey);
  }
}

export async function clearWebGpuCache() {
  await unloadWebGpuModel();
  if (typeof caches !== 'undefined') {
    for (const key of await caches.keys()) {
      if (key.toLowerCase().includes('webllm')) {
        await caches.delete(key);
      }
    }
  }
  if (typeof indexedDB !== 'undefined') {
    try {
      await indexedDB.deleteDatabase('webllm');
    } catch {
      // best effort cleanup
    }
  }
}
