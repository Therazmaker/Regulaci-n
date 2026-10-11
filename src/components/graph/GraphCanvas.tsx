import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Network as NetworkViz, DataSet } from 'vis-network/standalone';
import type { GraphNodeStats } from '../../hooks/useGraphData';
import type { GraphEdge } from '../../types';
import { getCategoryTheme } from '../../services/graphTheme';
import { loadLayout, saveLayoutDebounced, saveLayout, clearLayout, type Pos } from '../../services/graphLayout';

export interface GraphCanvasHandle {
  reorganize: () => Promise<void>;
}

export interface GraphCanvasProps {
  nodes: GraphNodeStats[];
  edges: GraphEdge[];
  visibleIds: Set<string>;
  selectedId: string | null;
  centerRequest?: { id: string; nonce: number };
  onSelect: (id: string | null) => void;
}

const LAYOUT_PHYSICS = {
  enabled: true,
  solver: 'forceAtlas2Based' as const,
  forceAtlas2Based: {
    gravitationalConstant: -30,
    centralGravity: 0.01,
    springLength: 80,
    springConstant: 0.08,
    damping: 0.4,
  },
  stabilization: { enabled: true, iterations: 200, updateInterval: 25, fit: true },
};

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function getNodeSize(mentions: number): number {
  return clamp(8 + 4 * Math.sqrt(mentions), 8, 30);
}

function getNodeFontSize(mentions: number): number {
  return clamp(11 + Math.sqrt(mentions), 11, 18);
}

function toVisNode(n: GraphNodeStats, isVisible: boolean) {
  const theme = getCategoryTheme(n.category);
  const size = getNodeSize(n.mentions);
  const fontSize = getNodeFontSize(n.mentions);

  return {
    id: n.id,
    label: n.label,
    shape: 'dot',
    size,
    hidden: !isVisible,
    shadow: false,
    color: {
      background: theme.bg,
      border: theme.border,
      highlight: { background: '#fef08a', border: '#eab308' },
    },
    font: {
      color: theme.text,
      size: fontSize,
      face: 'system-ui',
      strokeWidth: 2,
      strokeColor: '#ffffff',
    },
  };
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(({
  nodes,
  edges,
  visibleIds,
  selectedId,
  centerRequest,
  onSelect,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<NetworkViz | null>(null);
  const nodesDSRef = useRef<DataSet<any> | null>(null);
  const edgesDSRef = useRef<DataSet<any> | null>(null);
  const nodeSigRef = useRef<Map<string, string>>(new Map());
  const edgeSigRef = useRef<Map<string, string>>(new Map());
  const savedPosRef = useRef<Record<string, Pos>>({});
  const didFitInitialRef = useRef(false);

  const [layoutProgress, setLayoutProgress] = useState<number | null>(null);

  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Load saved positions into ref once
  useEffect(() => {
    loadLayout().then((positions) => {
      savedPosRef.current = positions;
    });
  }, []);

  // Expose reorganize method to parent via ref
  useImperativeHandle(ref, () => ({
    reorganize: async () => {
      const net = networkRef.current;
      const nodesDS = nodesDSRef.current;
      if (!net || !nodesDS) return;

      await clearLayout();
      savedPosRef.current = {};

      // Unfix all nodes, randomize positions, enable physics
      const allIds = nodesDS.getIds();
      nodesDS.update(
        allIds.map((id) => ({
          id,
          fixed: false,
          x: (Math.random() - 0.5) * 500,
          y: (Math.random() - 0.5) * 500,
        }))
      );

      net.setOptions({ physics: LAYOUT_PHYSICS });
      net.stabilize(200);
    },
  }));

  // 1) Initialize Network instance ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    const nodesDS = new DataSet<any>();
    const edgesDS = new DataSet<any>();
    nodesDSRef.current = nodesDS;
    edgesDSRef.current = edgesDS;
    nodeSigRef.current = new Map();
    edgeSigRef.current = new Map();
    didFitInitialRef.current = false;

    const net = new NetworkViz(
      containerRef.current,
      { nodes: nodesDS, edges: edgesDS },
      {
        layout: { improvedLayout: false },
        physics: { enabled: false },
        nodes: {
          borderWidth: 2,
          shadow: false,
          scaling: {
            label: {
              enabled: true,
              min: 10,
              max: 20,
              drawThreshold: 8,
            },
          },
        },
        edges: {
          smooth: false,
          width: 1,
          selectionWidth: 2,
          color: { color: '#cbd5e1', highlight: '#f59e0b' },
          arrows: { to: { enabled: true, scaleFactor: 0.5 } },
          font: { size: 10, color: '#64748b', strokeWidth: 2, strokeColor: '#ffffff' },
        },
        interaction: {
          hover: false,
          zoomView: true,
          dragView: true,
          dragNodes: true,
          hideEdgesOnDrag: true,
          hideEdgesOnZoom: true,
        },
      }
    );
    networkRef.current = net;

    net.on('stabilizationProgress', (p: { iterations: number; total: number }) => {
      setLayoutProgress(Math.round((p.iterations / p.total) * 100));
    });

    net.on('stabilizationIterationsDone', () => {
      net.setOptions({ physics: { enabled: false } });
      nodesDS.update(nodesDS.getIds().map((id) => ({ id, fixed: false })));
      const posMap = net.getPositions() as Record<string, Pos>;
      savedPosRef.current = posMap;
      saveLayout(posMap);
      setLayoutProgress(null);
      net.fit({ animation: false });
    });

    net.on('dragEnd', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const currentPositions = net.getPositions() as Record<string, Pos>;
        savedPosRef.current = currentPositions;
        saveLayoutDebounced(currentPositions);
      }
    });

    net.on('click', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        onSelectRef.current(params.nodes[0] as string);
      } else {
        onSelectRef.current(null);
      }
    });

    return () => {
      net.destroy();
      networkRef.current = null;
      nodesDSRef.current = null;
      edgesDSRef.current = null;
    };
  }, []);

  // 2) Sync nodes and edges incrementally
  useEffect(() => {
    const net = networkRef.current;
    const nodesDS = nodesDSRef.current;
    const edgesDS = edgesDSRef.current;
    if (!net || !nodesDS || !edgesDS) return;

    const saved = savedPosRef.current;
    const nodeSig = nodeSigRef.current;
    const edgeSig = edgeSigRef.current;
    const currentIds = new Set(nodes.map((n) => n.id));
    const hadNodes = nodeSig.size > 0;

    // Remove deleted nodes / edges
    const removedNodes = [...nodeSig.keys()].filter((id) => !currentIds.has(id));
    if (removedNodes.length) {
      nodesDS.remove(removedNodes);
      removedNodes.forEach((id) => nodeSig.delete(id));
    }

    const validEdges = edges.filter((e) => currentIds.has(e.fromNodeId) && currentIds.has(e.toNodeId));
    const validEdgeIds = new Set(validEdges.map((e) => e.id));
    const removedEdges = [...edgeSig.keys()].filter((id) => !validEdgeIds.has(id));
    if (removedEdges.length) {
      edgesDS.remove(removedEdges);
      removedEdges.forEach((id) => edgeSig.delete(id));
    }

    const livePos = hadNodes ? (net.getPositions() as Record<string, Pos>) : {};
    const knownPos = (id: string): Pos | undefined => livePos[id] ?? saved[id];
    const neighbours = new Map<string, string[]>();
    for (const e of validEdges) {
      (neighbours.get(e.fromNodeId) ?? neighbours.set(e.fromNodeId, []).get(e.fromNodeId)!).push(e.toNodeId);
      (neighbours.get(e.toNodeId) ?? neighbours.set(e.toNodeId, []).get(e.toNodeId)!).push(e.fromNodeId);
    }

    const upserts: any[] = [];
    let needsLayout = false;

    for (const n of nodes) {
      const isVisible = visibleIds.has(n.id);
      const sig = `${n.label}|${n.category}|${n.mentions}|${isVisible}`;
      const isKnown = nodeSig.has(n.id);

      if (isKnown) {
        if (nodeSig.get(n.id) !== sig) {
          upserts.push(toVisNode(n, isVisible));
        }
      } else {
        let pos = saved[n.id];
        if (!pos) {
          needsLayout = true;
          const anchor = (neighbours.get(n.id) || []).map(knownPos).find(Boolean);
          pos = anchor
            ? { x: anchor.x + (Math.random() - 0.5) * 120, y: anchor.y + (Math.random() - 0.5) * 120 }
            : { x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400 };
        }
        upserts.push({ ...toVisNode(n, isVisible), x: pos.x, y: pos.y });
      }
      nodeSig.set(n.id, sig);
    }

    if (needsLayout && hadNodes) {
      const pinned = [...nodeSig.keys()]
        .filter((id) => !upserts.some((u) => u.id === id && u.x !== undefined))
        .map((id) => ({ id, fixed: true }));
      nodesDS.update(pinned);
    }
    if (upserts.length) nodesDS.update(upserts);

    // Sync Edges: an edge is hidden unless BOTH endpoints are visible
    const edgeUpserts: any[] = [];
    for (const e of validEdges) {
      const isEdgeVisible = visibleIds.has(e.fromNodeId) && visibleIds.has(e.toNodeId);
      const isConnectedToSelected = selectedId ? (e.fromNodeId === selectedId || e.toNodeId === selectedId) : false;
      const labelToShow = isConnectedToSelected ? (e.label || '') : '';

      const sig = `${e.label || ''}|${isEdgeVisible}|${isConnectedToSelected}`;
      if (edgeSig.get(e.id) !== sig) {
        edgeUpserts.push({
          id: e.id,
          from: e.fromNodeId,
          to: e.toNodeId,
          label: labelToShow,
          hidden: !isEdgeVisible,
          width: isConnectedToSelected ? 2 : 1,
          color: isConnectedToSelected ? { color: '#f59e0b' } : { color: '#cbd5e1' },
        });
        edgeSig.set(e.id, sig);
      }
    }
    if (edgeUpserts.length) edgesDS.update(edgeUpserts);

    if (needsLayout) {
      net.setOptions({ physics: LAYOUT_PHYSICS });
      net.stabilize(hadNodes ? 80 : 200);
    } else if (!didFitInitialRef.current && nodes.length > 0 && visibleIds.size > 0) {
      didFitInitialRef.current = true;
      net.once('afterDrawing', () => {
        net.fit({ nodes: Array.from(visibleIds), animation: false });
      });
    }
  }, [nodes, edges, visibleIds, selectedId]);

  // 3) Fit view on filter / visibility changes
  useEffect(() => {
    const net = networkRef.current;
    if (!net || !didFitInitialRef.current || visibleIds.size === 0) return;
    try {
      net.fit({
        nodes: Array.from(visibleIds),
        animation: { duration: 250, easingFunction: 'easeInOutQuad' },
      });
    } catch {
      // Ignore if nodes not ready
    }
  }, [visibleIds]);

  // 4) Handle center/focus request
  useEffect(() => {
    if (!centerRequest || !networkRef.current) return;
    try {
      networkRef.current.focus(centerRequest.id, {
        scale: 1.2,
        animation: { duration: 300, easingFunction: 'easeInOutQuad' },
      });
    } catch {
      // Node might not be in network
    }
  }, [centerRequest]);

  // 5) Handle selection in network
  useEffect(() => {
    if (!networkRef.current) return;
    if (selectedId) {
      networkRef.current.selectNodes([selectedId]);
    } else {
      networkRef.current.selectNodes([]);
    }
  }, [selectedId]);

  return (
    <div className="w-full h-full relative">
      {layoutProgress !== null && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-xs font-medium text-amber-800 bg-amber-100 px-3 py-1 rounded-full shadow-xs">
          Organizando nodos… {layoutProgress}%
        </div>
      )}
      <div ref={containerRef} className="w-full h-[calc(100vh-170px)] bg-amber-50/20" />
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';
