export type ClassificationStatus = 'pending' | 'processing' | 'classified' | 'error';

export type NodeCategory = 'emocion' | 'sintoma_fisico' | 'astrologia' | 'patron' | 'idea' | 'relacion' | 'otro';

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  isFavorite: boolean;
  isImportant: boolean;
  status: ClassificationStatus;
  geminiInsight?: string;
  nodeIds: string[];
  errorMessage?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  category: NodeCategory;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  createdAt: number;
}

export interface AppSettings {
  key: string;
  value: string;
}

export interface AppBackupData {
  version: number;
  exportedAt: string;
  messages: ChatMessage[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  settings?: Record<string, string>;
}
