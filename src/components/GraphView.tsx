import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { GraphNode, ChatMessage } from '../types';
import { Network as NetworkViz, DataSet } from 'vis-network/standalone';
import { Network, X, Calendar, MessageSquare } from 'lucide-react';

export const GraphView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [relatedMessages, setRelatedMessages] = useState<ChatMessage[]>([]);

  const nodes = useLiveQuery(() => db.nodes.toArray(), []);
  const edges = useLiveQuery(() => db.edges.toArray(), []);

  useEffect(() => {
    if (!containerRef.current || !nodes || !edges) return;

    // Color palette per category
    const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
      emocion: { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
      sintoma_fisico: { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d' },
      astrologia: { bg: '#e0e7ff', border: '#6366f1', text: '#1e1b4b' },
      patron: { bg: '#f3e8ff', border: '#a855f7', text: '#581c87' },
      idea: { bg: '#dcfce7', border: '#22c55e', text: '#14532d' },
      relacion: { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
      otro: { bg: '#f3f4f6', border: '#9ca3af', text: '#1f2937' },
    };

    const visNodes = new DataSet(
      nodes.map((n) => {
        const colors = categoryColors[n.category] || categoryColors.otro;
        return {
          id: n.id,
          label: n.label,
          shape: 'box',
          margin: { top: 10, right: 10, bottom: 10, left: 10 },
          color: {
            background: colors.bg,
            border: colors.border,
            highlight: { background: '#fef08a', border: '#eab308' },
          },
          font: { color: colors.text, size: 14, face: 'system-ui' },
          borderWidth: 2,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.06)', size: 5, x: 2, y: 2 },
        };
      })
    );

    const visEdges = new DataSet(
      edges.map((e) => ({
        id: e.id,
        from: e.fromNodeId,
        to: e.toNodeId,
        label: e.label || '',
        color: { color: '#cbd5e1', highlight: '#f59e0b' },
        font: { size: 10, color: '#64748b', strokeWidth: 2, strokeColor: '#ffffff' },
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { type: 'continuous' },
      }))
    );

    const data = { nodes: visNodes, edges: visEdges };
    const options = {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -35,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08,
        },
        stabilization: { iterations: 150 },
      },
      interaction: {
        hover: true,
        zoomView: true,
        dragView: true,
      },
    };

    const network = new NetworkViz(containerRef.current, data as any, options as any);

    network.on('click', async (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const clickedNode = nodes.find((n) => n.id === nodeId);
        if (clickedNode) {
          setSelectedNode(clickedNode);
          // Find all messages that contain this nodeId
          const msgs = await db.messages
            .filter((m) => m.nodeIds && m.nodeIds.includes(nodeId))
            .reverse()
            .sortBy('timestamp');
          setRelatedMessages(msgs);
        }
      }
    });

    return () => {
      network.destroy();
    };
  }, [nodes, edges]);

  return (
    <div className="flex flex-col h-full bg-stone-50 pb-20 relative">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-3 border-b border-amber-200/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-amber-600" />
          <h1 className="text-base font-bold text-stone-800">Grafo de Conexiones</h1>
        </div>
        <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
          {nodes?.length || 0} nodos
        </span>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 w-full h-full relative">
        {(!nodes || nodes.length === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-stone-500 z-10">
            <Network className="w-12 h-12 text-amber-300 mb-2" />
            <p className="font-semibold text-stone-700">El grafo está vacío.</p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs">
              Escribe tus primeros pensamientos en el Chat y Gemini organizará automáticamente tus emociones y temas aquí.
            </p>
          </div>
        )}

        <div ref={containerRef} className="w-full h-[calc(100vh-130px)] bg-amber-50/20" />
      </div>

      {/* Selected Node Details Sheet (Bottom Modal) */}
      {selectedNode && (
        <div className="fixed inset-x-0 bottom-16 z-30 max-w-md mx-auto bg-white rounded-t-3xl border-t border-amber-300 shadow-2xl max-h-[60vh] flex flex-col transition-all duration-300 animate-in slide-in-from-bottom">
          {/* Modal Header */}
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-3xl">
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                {selectedNode.category}
              </span>
              <h3 className="text-base font-bold text-stone-800 mt-1">{selectedNode.label}</h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1.5 rounded-full hover:bg-stone-200/60 text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-4 overflow-y-auto space-y-3 flex-1">
            {selectedNode.description && (
              <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl italic">
                "{selectedNode.description}"
              </p>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-stone-700 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                Notas asociadas ({relatedMessages.length}):
              </h4>

              {relatedMessages.length === 0 ? (
                <p className="text-xs text-stone-400">No hay notas vinculadas directamente.</p>
              ) : (
                relatedMessages.map((msg) => (
                  <div key={msg.id} className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-1">
                    <p className="text-xs text-stone-800">{msg.text}</p>
                    <span className="text-[10px] text-stone-400 flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      {new Date(msg.timestamp).toLocaleDateString([], {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
