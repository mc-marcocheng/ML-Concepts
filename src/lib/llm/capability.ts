import type { OnDeviceModelSpec } from './types';

export const DEFAULT_ON_DEVICE_KEY = 'qwen3-1.7b';

export const ON_DEVICE_MODELS: OnDeviceModelSpec[] = [
  {
    key: 'qwen3-4b',
    label: 'Qwen3 4B',
    modelId: 'Qwen3-4B-q4f16_1-MLC',
    idPrefix: 'Qwen3-4B-',
    params: '4B',
    approxDownloadMB: 2400,
    approxVramMB: 3600,
    blurb: 'Best answers. Needs a discrete GPU and about 4 GB of free storage.',
  },
  {
    key: 'qwen3-1.7b',
    label: 'Qwen3 1.7B',
    modelId: 'Qwen3-1.7B-q4f16_1-MLC',
    idPrefix: 'Qwen3-1.7B-',
    params: '1.7B',
    approxDownloadMB: 1100,
    approxVramMB: 2100,
    blurb: 'Balanced default for most laptops.',
  },
  {
    key: 'qwen3-0.6b',
    label: 'Qwen3 0.6B',
    modelId: 'Qwen3-0.6B-q4f16_0-MLC',
    idPrefix: 'Qwen3-0.6B-',
    params: '0.6B',
    approxDownloadMB: 450,
    approxVramMB: 1400,
    blurb: 'Smallest download, for low-memory devices and phones.',
  },
];

export function normaliseModelKey(key: string | null | undefined) {
  if (key && ON_DEVICE_MODELS.some(model => model.key === key)) return key;
  return DEFAULT_ON_DEVICE_KEY;
}

export function getOnDeviceModel(modelKey: string) {
  return ON_DEVICE_MODELS.find(model => model.key === modelKey) ?? ON_DEVICE_MODELS.find(model => model.key === DEFAULT_ON_DEVICE_KEY)!;
}

export async function resolveModelId(spec: OnDeviceModelSpec): Promise<string> {
  try {
    const { prebuiltAppConfig } = await import('@mlc-ai/web-llm');
    const ids = (prebuiltAppConfig?.model_list ?? []).map((entry: { model_id: string }) => entry.model_id);
    if (!ids.length || ids.includes(spec.modelId)) return spec.modelId;
    const near = ids.find(id => id.startsWith(spec.idPrefix));
    if (near) {
      console.warn(`[llm] "${spec.modelId}" not in prebuilt list — using "${near}"`);
      return near;
    }
  } catch {
    // fall through to the declared id
  }
  return spec.modelId;
}

export async function probeWebGpu() {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return { supported: false, maxBufferMB: 0 };
  }
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ limits: { maxBufferSize?: number } } | null> } }).gpu;
    const adapter = await gpu?.requestAdapter();
    if (!adapter) return { supported: false, maxBufferMB: 0 };
    return {
      supported: true,
      maxBufferMB: Math.round((adapter.limits.maxBufferSize ?? 0) / 1e6),
    };
  } catch {
    return { supported: false, maxBufferMB: 0 };
  }
}
