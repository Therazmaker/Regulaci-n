import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ChatMessage } from '../types';
import { Star, Bookmark, Filter, Calendar } from 'lucide-react';

export const FavoritesView: React.FC = () => {
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'important'>('all');

  const messages = useLiveQuery(
    async () => {
      if (filterType === 'favorites') {
        return db.messages.where('isFavorite').equals(1).reverse().sortBy('timestamp');
      } else if (filterType === 'important') {
        return db.messages.where('isImportant').equals(1).reverse().sortBy('timestamp');
      } else {
        return db.messages
          .filter(m => m.isFavorite || m.isImportant)
          .reverse()
          .sortBy('timestamp');
      }
    },
    [filterType]
  );

  const toggleFavorite = async (msg: ChatMessage) => {
    await db.messages.update(msg.id, { isFavorite: !msg.isFavorite });
  };

  const toggleImportant = async (msg: ChatMessage) => {
    await db.messages.update(msg.id, { isImportant: !msg.isImportant });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-amber-50/40 via-amber-50/20 to-stone-50 pb-20">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-3 border-b border-amber-200/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
          <h1 className="text-base font-bold text-stone-800">Mensajes Guardados</h1>
        </div>
      </div>

      <div className="p-3 bg-white/50 border-b border-amber-200/40 flex items-center gap-2 text-xs font-medium">
        <span className="text-stone-500 flex items-center gap-1 pl-1">
          <Filter className="w-3.5 h-3.5" /> Filtrar:
        </span>
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-full transition-all ${
            filterType === 'all'
              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-amber-100'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilterType('favorites')}
          className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
            filterType === 'favorites'
              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-amber-100'
          }`}
        >
          <Star className="w-3 h-3 fill-current" /> Favoritos
        </button>
        <button
          onClick={() => setFilterType('important')}
          className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
            filterType === 'important'
              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-amber-100'
          }`}
        >
          <Bookmark className="w-3 h-3 fill-current" /> Importantes
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(!messages || messages.length === 0) && (
          <div className="text-center my-16 px-6 text-stone-500">
            <Star className="w-12 h-12 mx-auto text-amber-300 mb-2" />
            <p className="font-semibold text-stone-700">No hay mensajes destacados aún.</p>
            <p className="text-xs text-stone-400 mt-1">
              Marca mensajes con una estrella o marcador en la pestaña de Chat para verlos aquí.
            </p>
          </div>
        )}

        {messages?.map((msg) => {
          const dateStr = new Date(msg.timestamp).toLocaleDateString([], {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div
              key={msg.id}
              className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-sm space-y-2 hover:border-amber-300 transition-all"
            >
              <div className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-100 pb-2">
                <span className="flex items-center gap-1 font-medium text-amber-900/70">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  {dateStr}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleFavorite(msg)}
                    className={`p-1 rounded-full ${
                      msg.isFavorite ? 'text-amber-500 fill-amber-400' : 'text-stone-300'
                    }`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    onClick={() => toggleImportant(msg)}
                    className={`p-1 rounded-full ${
                      msg.isImportant ? 'text-rose-500 fill-rose-400' : 'text-stone-300'
                    }`}
                  >
                    <Bookmark className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                {msg.text}
              </p>

              {msg.geminiInsight && (
                <div className="mt-2 p-2.5 bg-amber-50/80 border border-amber-200/60 rounded-xl text-xs text-stone-700">
                  <span className="font-bold text-amber-900 block mb-0.5">🌻 Insight Fergirasol:</span>
                  {msg.geminiInsight}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
