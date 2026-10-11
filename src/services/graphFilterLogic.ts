import type { GraphData, GraphNodeStats } from '../hooks/useGraphData';
import type { NodeCategory } from '../types';

export type ReachOption = 'importantes' | 'recientes' | 'todos';

export const TOP_N_IMPORTANTES = 40;
export const RECIENTES_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface FilterState {
  searchQuery: string;
  selectedCategories: Set<NodeCategory>;
  reach: ReachOption;
}

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getVisibleIds(
  data: GraphData | undefined,
  filters: FilterState,
  focusId?: string | null
): Set<string> {
  if (!data || data.nodes.length === 0) {
    return new Set<string>();
  }

  let candidates: GraphNodeStats[] = [...data.nodes];

  // 1. Reach filter
  if (filters.reach === 'importantes') {
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.lastMentionAt - a.lastMentionAt;
    });
    candidates = candidates.slice(0, TOP_N_IMPORTANTES);
  } else if (filters.reach === 'recientes') {
    const cutoff = Date.now() - RECIENTES_DAYS_MS;
    candidates = candidates.filter((n) => n.lastMentionAt >= cutoff);
  }

  // 2. Category filter
  if (filters.selectedCategories.size > 0) {
    candidates = candidates.filter((n) =>
      filters.selectedCategories.has(n.category)
    );
  }

  // 3. Search query filter
  const query = normalizeText(filters.searchQuery);
  if (query.length > 0) {
    candidates = candidates.filter((n) =>
      normalizeText(n.label).includes(query)
    );
  }

  const visibleSet = new Set<string>(candidates.map((n) => n.id));

  // 4. Focus mode (if active, ensure focused node and its 1-hop neighbors are included)
  if (focusId && data.byId.has(focusId)) {
    visibleSet.add(focusId);
    const neighbors = data.neighbors.get(focusId) || [];
    for (const neighborId of neighbors) {
      visibleSet.add(neighborId);
    }
  }

  return visibleSet;
}
