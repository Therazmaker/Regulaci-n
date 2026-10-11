import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGraphData } from '../../hooks/useGraphData';
import { GraphCanvas, type GraphCanvasHandle } from './GraphCanvas';
import { GraphFilters } from './GraphFilters';
import { getVisibleIds, type FilterState } from '../../services/graphFilterLogic';
import { db } from '../../db';
import type { ChatMessage } from '../../types';
import { Network, X, Calendar, MessageSquare, MoreVertical, RefreshCw } from 'lucide-react';

export const GraphView: React.FC = () => {
  const graphData = useGraphData();
  const canvasRef = useRef<GraphCanvasHandle>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [centerRequest, setCenterRequest] = useState<{ id: string; nonce: number } | undefined>(undefined);
  const [relatedMessages, setRelatedMessages] = useState<ChatMessage[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedCategories: new Set(),
    reach: 'importantes',
  });

  const visibleIds = useMemo(() => {
    return getVisibleIds(graphData, filters, selectedId);
  }, [graphData, filters, selectedId]);

  const lastAutoSelectSearchRef = useRef<string>('');

  const selectedNode = selectedId && graphData?.byId ? graphData.byId.get(selectedId) || null : null;

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    let isCancelled = false;
    db.messages
      .where('nodeIds')
      .equals(selectedId)
      .reverse()
      .sortBy('timestamp')
      .then((msgs) => {
        if (!isCancelled) setRelatedMessages(msgs);
      });
    return () => {
      isCancelled = true;
    };
  }, [selectedId]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    if (newFilters.searchQuery.trim().length > 0 && newFilters.searchQuery !== lastAutoSelectSearchRef.current) {
      lastAutoSelectSearchRef.current = newFilters.searchQuery;
      const matches = getVisibleIds(graphData, newFilters, null);
      if (matches.size === 1) {
        const singleId = Array.from(matches)[0];
        setSelectedId(singleId);
        setCenterRequest({ id: singleId, nonce: Date.now() });
      }
    }
  };

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (!id) {
      setRelatedMessages([]);
    }
  };

  const handleReorganize = async () => {
    setShowMenu(false);
    if (window.confirm('¿Deseas reorganizar las posiciones de todos los nodos en el grafo?')) {
      await canvasRef.current?.reorganize();
    }
  };

  if (!graphData) {
    return (
      <div className="flex flex-col h-full bg-stone-50 pb-20 relative items-center justify-center">
        <Network className="w-10 h-10 text-amber-400 animate-pulse mb-2" />
        <p className="text-xs font-medium text-stone-500">Cargando datos del grafo...</p>
      </div>
    );
  }

  const { nodes, edges } = graphData;

  return (
    <div className="flex flex-col h-full bg-stone-50 pb-20 relative">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-4 py-2.5 border-b border-amber-200/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-amber-600" />
          <h1 className="text-base font-bold text-stone-800">Grafo de Conexiones</h1>
        </div>

        <div className="flex items-center gap-2 relative">
          <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
            {nodes.length} nodos
          </span>

          {/* Menu button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
            title="Opciones"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Menu dropdown */}
          {showMenu && (
            <div className="absolute right-0 top-8 z-30 bg-white border border-stone-200 rounded-xl shadow-lg py-1 w-44 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={handleReorganize}
                className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                Reorganizar layout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <GraphFilters
        filters={filters}
        onChange={handleFilterChange}
        visibleCount={visibleIds.size}
        totalCount={nodes.length}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 w-full h-full relative">
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-stone-500 z-10">
            <Network className="w-12 h-12 text-amber-300 mb-2" />
            <p className="font-semibold text-stone-700">El grafo está vacío.</p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs">
              Escribe tus primeros pensamientos en el Chat y Gemini organizará automáticamente tus emociones y temas aquí.
            </p>
          </div>
        )}

        <GraphCanvas
          ref={canvasRef}
          nodes={nodes}
          edges={edges}
          visibleIds={visibleIds}
          selectedId={selectedId}
          centerRequest={centerRequest}
          onSelect={handleSelect}
        />
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
              onClick={() => handleSelect(null)}
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

export default GraphView;
