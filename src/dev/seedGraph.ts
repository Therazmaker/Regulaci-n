import { db } from '../db';
import type { GraphNode, GraphEdge, ChatMessage, NodeCategory } from '../types';
import { removeNodesFromLayout } from '../services/graphLayout';

const CATEGORIES: NodeCategory[] = [
  'emocion',
  'sintoma_fisico',
  'astrologia',
  'patron',
  'idea',
  'relacion',
  'otro',
];

const SAMPLE_LABELS = [
  'Ansiedad social',
  'Miedo al rechazo',
  'Insomnio',
  'Dolor de cabeza',
  'Autoexigencia',
  'Cansancio mental',
  'Perfeccionismo',
  'Tristeza profunda',
  'Estrés laboral',
  'Claridad mental',
  'Meditación diaria',
  'Gratitud',
  'Paz interior',
  'Dolor lumbar',
  'Tensión en hombros',
  'Tránsito de Saturno',
  'Luna llena',
  'Aislamiento',
  'Síndrome del impostor',
  'Síndrome de burnout',
  'Sobrepensar',
  'Comparación social',
  'Paciencia',
  'Creatividad',
  'Incertidumbre',
  'Comunicación asertiva',
  'Límites personales',
  'Culpa',
  'Rabia contenida',
  'Procrastinación',
];

const EDGE_LABELS = [
  'causa',
  'empeora',
  'mejora',
  'desencadena',
  'alivia',
  'se relaciona con',
  'intensifica',
];

export async function seedGraph(count = 173): Promise<void> {
  console.log(`[seedGraph] Generando ${count} nodos de prueba...`);

  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const nodes: GraphNode[] = [];
  const nodeIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const id = `seed-node-${i}`;
    nodeIds.push(id);
    const baseLabel = SAMPLE_LABELS[i % SAMPLE_LABELS.length];
    const label = i < SAMPLE_LABELS.length ? baseLabel : `${baseLabel} (${i + 1})`;
    const category = CATEGORIES[i % CATEGORIES.length];
    const createdAt = now - Math.floor(Math.random() * ninetyDaysMs);

    nodes.push({
      id,
      label,
      category,
      description: `Descripción de prueba para ${label}`,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Generate ~1.3 edges per node
  const totalEdges = Math.floor(count * 1.3);
  const edgesMap = new Map<string, GraphEdge>();

  for (let i = 0; i < totalEdges; i++) {
    const fromIdx = Math.floor(Math.random() * count);
    let toIdx = Math.floor(Math.random() * count);
    if (toIdx === fromIdx) toIdx = (fromIdx + 1) % count;

    const fromNodeId = nodeIds[fromIdx];
    const toNodeId = nodeIds[toIdx];

    const edgeId = `seed-edge-${fromNodeId}-${toNodeId}`;
    if (!edgesMap.has(edgeId)) {
      edgesMap.set(edgeId, {
        id: edgeId,
        fromNodeId,
        toNodeId,
        label: EDGE_LABELS[i % EDGE_LABELS.length],
        createdAt: now - Math.floor(Math.random() * ninetyDaysMs),
      });
    }
  }
  const edges = Array.from(edgesMap.values());

  // Generate messages referencing nodes with skewed mention distribution
  // Skewed: first 10% of nodes get ~50% of mentions
  const topNodes = nodeIds.slice(0, Math.max(1, Math.floor(count * 0.1)));
  const msgCount = Math.floor(count * 0.8);
  const messages: ChatMessage[] = [];

  for (let i = 0; i < msgCount; i++) {
    const msgId = `seed-msg-${i}`;
    const timestamp = now - Math.floor(Math.random() * ninetyDaysMs);

    // Pick 1 to 3 node IDs
    const k = Math.floor(Math.random() * 3) + 1;
    const msgNodeIdsSet = new Set<string>();

    for (let j = 0; j < k; j++) {
      if (Math.random() < 0.5 && topNodes.length > 0) {
        msgNodeIdsSet.add(topNodes[Math.floor(Math.random() * topNodes.length)]);
      } else {
        msgNodeIdsSet.add(nodeIds[Math.floor(Math.random() * count)]);
      }
    }

    messages.push({
      id: msgId,
      text: `Nota de prueba #${i + 1} sobre ${Array.from(msgNodeIdsSet).join(', ')}`,
      timestamp,
      isFavorite: false,
      isImportant: false,
      status: 'classified', // CRITICAL: prevents app from sending to Gemini
      nodeIds: Array.from(msgNodeIdsSet),
    });
  }

  await db.transaction('rw', [db.nodes, db.edges, db.messages], async () => {
    await db.nodes.bulkPut(nodes);
    await db.edges.bulkPut(edges);
    await db.messages.bulkPut(messages);
  });

  console.log(
    `[seedGraph] Creados ${nodes.length} nodos, ${edges.length} aristas y ${messages.length} mensajes de prueba.`
  );
}

export async function clearSeed(): Promise<void> {
  console.log('[clearSeed] Limpiando datos de prueba (prefijo seed-)...');

  await db.transaction('rw', [db.nodes, db.edges, db.messages], async () => {
    const allNodes = await db.nodes.toArray();
    const seedNodes = allNodes.filter((n) => n.id.startsWith('seed-'));
    const seedNodeIds = seedNodes.map((n) => n.id);

    const allEdges = await db.edges.toArray();
    const seedEdgeIds = allEdges
      .filter((e) => e.id.startsWith('seed-') || seedNodeIds.includes(e.fromNodeId) || seedNodeIds.includes(e.toNodeId))
      .map((e) => e.id);

    const allMsgs = await db.messages.toArray();
    const seedMsgIds = allMsgs.filter((m) => m.id.startsWith('seed-')).map((m) => m.id);

    if (seedNodeIds.length > 0) await db.nodes.bulkDelete(seedNodeIds);
    if (seedEdgeIds.length > 0) await db.edges.bulkDelete(seedEdgeIds);
    if (seedMsgIds.length > 0) await db.messages.bulkDelete(seedMsgIds);

    await removeNodesFromLayout(seedNodeIds);
  });

  console.log('[clearSeed] Limpieza completada.');
}

if (import.meta.env.DEV) {
  (window as any).seedGraph = seedGraph;
  (window as any).clearSeed = clearSeed;
}
