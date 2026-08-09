export type ProviderId = 'remote' | 'ondevice';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface RemoteModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  reasoningEffort: ReasoningEffort;
}

export interface OnDeviceModelSpec {
  key: string;
  label: string;
  modelId: string;
  /** Used to find a near-match if `modelId` is absent from the installed web-llm build. */
  idPrefix: string;
  params: string;
  approxDownloadMB: number;
  approxVramMB: number;
  blurb: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ContextSection {
  id: string;
  heading: string;
  text: string;
  selected?: boolean;
}

export interface AskContext {
  conceptId: string | null;
  conceptTitle?: string;
  summary?: string;
  sections?: ContextSection[];
  headings?: string[];
  selection?: string;
  heading?: string;
  sectionText?: string;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  trace?: { name: string; context?: AskContext };
  responseFormat?: 'text' | 'json_object';
  fallback?: 'grounded' | 'error';
  onStatus?: (status: string) => void;
}
