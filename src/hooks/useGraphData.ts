import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { GraphNode, GraphEdge } from '../types';

export interface GraphNodeStats extends GraphNode {
  mentions: number;       // nº de mensajes cuyo nodeIds incluye este nodo
  lastMentionAt: number;  // timestamp del mensaje más reciente que lo menciona (0 si ninguno)
  degree: number;         // nº de aristas conectadas
  score: number;          // mentions + 0.5 * degree  (desempate: lastMentionAt)
}

export interface GraphData {
  nodes: GraphNodeStats[];
  edges: GraphEdge[];
  byId: Map<string, GraphNodeStats>;
  neighbors: Map<string, string[]>;   // id -> ids vecinos (ambas direcciones)
}

export function useGraphData(): GraphData | undefined {
  return useLiveQuery(async (): Promise<GraphData> => {
    const [rawNodes, rawEdges, rawMessages] = await Promise.all([
      db.nodes.toArray(),
      db.edges.toArray(),
      db.messages.toArray(),
    ]);

    const mentionsMap = new Map<string, number>();
    const lastMentionMap = new Map<string, number>();

    for (const msg of rawMessages) {
      if (msg.nodeIds && Array.isArray(msg.nodeIds)) {
        const ts = msg.timestamp || 0;
        for (const nodeId of msg.nodeIds) {
          mentionsMap.set(nodeId, (mentionsMap.get(nodeId) || 0) + 1);
          const currentLast = lastMentionMap.get(nodeId) || 0;
          if (ts > currentLast) {
            lastMentionMap.set(nodeId, ts);
          }
        }
      }
    }

    const degreeMap = new Map<string, number>();
    const neighborsMap = new Map<string, string[]>();

    const currentNodeIds = new Set(rawNodes.map((n: GraphNode) => n.id));

    const validEdges = rawEdges.filter(
      (e: GraphEdge) => currentNodeIds.has(e.fromNodeId) && currentNodeIds.has(e.toNodeId)
    );

    for (const edge of validEdges) {
      const from = edge.fromNodeId;
      const to = edge.toNodeId;

      degreeMap.set(from, (degreeMap.get(from) || 0) + 1);
      degreeMap.set(to, (degreeMap.get(to) || 0) + 1);

      if (!neighborsMap.has(from)) neighborsMap.set(from, []);
      if (!neighborsMap.has(to)) neighborsMap.set(to, []);

      neighborsMap.get(from)!.push(to);
      neighborsMap.get(to)!.push(from);
    }

    const byId = new Map<string, GraphNodeStats>();

    const nodesStats: GraphNodeStats[] = rawNodes.map((node: GraphNode) => {
      const mentions = mentionsMap.get(node.id) || 0;
      const lastMentionAt = lastMentionMap.get(node.id) || 0;
      const degree = degreeMap.get(node.id) || 0;
      const score = mentions + 0.5 * degree;

      const statsNode: GraphNodeStats = {
        ...node,
        mentions,
        lastMentionAt,
        degree,
        score,
      };

      byId.set(node.id, statsNode);
      return statsNode;
    });

    return {
      nodes: nodesStats,
      edges: validEdges,
      byId,
      neighbors: neighborsMap,
    };
  }, []);
}
