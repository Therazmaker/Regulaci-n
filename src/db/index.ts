import Dexie, { type Table } from 'dexie';
import type { ChatMessage, GraphNode, GraphEdge, AppSettings, AppBackupData } from '../types';

export class FergisDatabase extends Dexie {
  messages!: Table<ChatMessage, string>;
  nodes!: Table<GraphNode, string>;
  edges!: Table<GraphEdge, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('FergisAppDB');
    this.version(1).stores({
      messages: 'id, timestamp, status, isFavorite, isImportant',
      nodes: 'id, label, category, updatedAt',
      edges: 'id, fromNodeId, toNodeId, [fromNodeId+toNodeId]',
      settings: 'key'
    });
  }
}

export const db = new FergisDatabase();

// Helper functions for settings
export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const item = await db.settings.get(key);
  return item ? item.value : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

// Backup & Restore functions
export async function exportBackupData(): Promise<AppBackupData> {
  const messages = await db.messages.toArray();
  const nodes = await db.nodes.toArray();
  const edges = await db.edges.toArray();
  const settingsArray = await db.settings.toArray();

  const settingsRecord: Record<string, string> = {};
  for (const item of settingsArray) {
    settingsRecord[item.key] = item.value;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    messages,
    nodes,
    edges,
    settings: settingsRecord
  };
}

export async function importBackupData(data: AppBackupData): Promise<void> {
  if (!data || !Array.isArray(data.messages) || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error('El archivo de respaldo tiene un formato inválido.');
  }

  await db.transaction('rw', [db.messages, db.nodes, db.edges, db.settings], async () => {
    await db.messages.clear();
    await db.nodes.clear();
    await db.edges.clear();
    await db.settings.clear();

    if (data.messages.length > 0) {
      await db.messages.bulkAdd(data.messages);
    }
    if (data.nodes.length > 0) {
      await db.nodes.bulkAdd(data.nodes);
    }
    if (data.edges.length > 0) {
      await db.edges.bulkAdd(data.edges);
    }
    if (data.settings) {
      const settingsEntries = Object.entries(data.settings).map(([key, value]) => ({ key, value }));
      if (settingsEntries.length > 0) {
        await db.settings.bulkAdd(settingsEntries);
      }
    }
  });
}
