export type NodeType = 'greeting' | 'question' | 'action' | 'end' | 'forward';
export type AnswerFormat = 'synthetic' | 'audiofile';
export type InputMode = 'keypress' | 'ai_keyword' | 'both';

export const SUPPORTED_LANGUAGES = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pl', label: 'Polski' },
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

export interface LocalizedText {
  [lang: string]: string; // e.g. { de: "Hallo", en: "Hello" }
}

export interface KeyOption {
  key: string; // "1", "2", etc.
  label: string; // "Termin", "Rezept", etc.
  aiKeywords?: string[]; // AI keywords for this option
  targetNodeId: string;
}

export interface AssistantNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  title: string;
  localizedTitles?: LocalizedText;
  ansageText: string;
  localizedAnsageTexts?: LocalizedText;
  format: AnswerFormat;
  audioFileName?: string;
  tag?: string;
  hasOptions: boolean;
  inputMode?: InputMode;
  options: KeyOption[];
  forwardNumber?: string;
  forwardFallbackText?: string;
  forwardRetrieveAfterSec?: number;
  isImportant?: boolean;
  order: number;
}

export interface AssistantConfig {
  id: string;
  praxisName: string;
  nodes: AssistantNode[];
  createdAt: string;
  updatedAt: string;
}
