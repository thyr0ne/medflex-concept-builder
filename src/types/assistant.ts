export type NodeType = 'greeting' | 'question' | 'action' | 'end' | 'forward';
export type AnswerFormat = 'synthetic' | 'audiofile';

export interface KeyOption {
  key: string; // "1", "2", etc.
  label: string; // "Termin", "Rezept", etc.
  targetNodeId: string;
}

export interface AssistantNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  title: string;
  ansageText: string;
  format: AnswerFormat;
  audioFileName?: string;
  tag?: string;
  hasOptions: boolean;
  options: KeyOption[];
  forwardNumber?: string;
  forwardFallbackText?: string;
  order: number;
}

export interface AssistantConfig {
  id: string;
  praxisName: string;
  nodes: AssistantNode[];
  createdAt: string;
  updatedAt: string;
}
