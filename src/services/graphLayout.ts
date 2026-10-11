import { getSetting, setSetting } from '../db';

export type Pos = { x: number; y: number };
export type PosMap = Record<string, Pos>;

const SETTINGS_KEY = 'graph_layout_v1';
const LEGACY_LOCALSTORAGE_KEY = 'fergis-graph-positions-v1';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export async function loadLayout(): Promise<PosMap> {
  try {
    const settingVal = await getSetting(SETTINGS_KEY, '');
    if (settingVal) {
      return JSON.parse(settingVal) as PosMap;
    }

    // Migration check: if no settings layout exists, check localStorage
    const legacyRaw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacyPos = JSON.parse(legacyRaw) as PosMap;
        if (legacyPos && typeof legacyPos === 'object') {
          await setSetting(SETTINGS_KEY, JSON.stringify(legacyPos));
          localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
          return legacyPos;
        }
      } catch {
        localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
      }
    }
  } catch {
    // Return empty fallback on error
  }
  return {};
}

export function saveLayoutDebounced(positions: PosMap, delay = 500): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveLayout(positions);
  }, delay);
}

export async function saveLayout(positions: PosMap): Promise<void> {
  try {
    await setSetting(SETTINGS_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage failure
  }
}

export async function clearLayout(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
  } catch {
    // Ignore
  }
  await setSetting(SETTINGS_KEY, '');
}

export async function removeNodesFromLayout(nodeIds: string[]): Promise<void> {
  const current = await loadLayout();
  let changed = false;
  for (const id of nodeIds) {
    if (id in current) {
      delete current[id];
      changed = true;
    }
  }
  if (changed) {
    await saveLayout(current);
  }
}
