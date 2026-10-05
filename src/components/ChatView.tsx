import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ChatMessage } from '../types';
import { processMessageWithGemini, processPendingMessages, deleteMessage, editMessage } from '../services/gemini';
import { Send, Star, Bookmark, Sparkles, RefreshCw, AlertCircle, CheckCircle2, Clock, Bot, Pencil, Trash2, X, Check } from 'lucide-react';

export const ChatView: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useLiveQuery(
    () => db.messages.orderBy('timestamp').toArray(),
    []
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages?.length]);

  useEffect(() => {
    processPendingMessages();
    const handleOnline = () => processPendingMessages();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text,
      timestamp: Date.now(),
      isFavorite: false,
      isImportant: false,
      status: 'pending',
      nodeIds: []
    };

    await db.messages.add(newMessage);
    setInputText('');

    if (navigator.onLine) {
      setProcessingId(newMessage.id);
      await db.messages.update(newMessage.id, { status: 'processing' });
      await processMessageWithGemini(newMessage);
      setProcessingId(null);
    }
  };

  const toggleFavorite = async (msg: ChatMessage) => {
    await db.messages.update(msg.id, { isFavorite: !msg.isFavorite });
  };

  const toggleImportant = async (msg: ChatMessage) => {
    await db.messages.update(msg.id, { isImportant: !msg.isImportant });
  };

  const handleForceInsight = async (msg: ChatMessage) => {
    setProcessingId(msg.id);
    await db.messages.update(msg.id, { status: 'processing' });
    await processMessageWithGemini(msg, true);
    setProcessingId(null);
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditingText(msg.text);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editingText.trim()) return;
    const textToSave = editingText.trim();
    setEditingId(null);
    setEditingText('');
    setProcessingId(msgId);
    await editMessage(msgId, textToSave);
    setProcessingId(null);
  };

  const handleConfirmDelete = async (msgId: string) => {
    setDeletingId(null);
    await deleteMessage(msgId);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-amber-50/40 via-amber-50/20 to-stone-50 pb-20">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-3 border-b border-amber-200/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 font-bold text-lg shadow-sm">
            🌻
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-800 leading-tight">Bitácora Fergirasol</h1>
            <p className="text-xs text-amber-700 font-medium">Un espacio seguro para ti</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {(!messages || messages.length === 0) && (
          <div className="text-center my-12 px-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-stone-800 text-base mb-1">¡Hola, Fergis! 🌻</h3>
            <p className="text-sm text-stone-600 leading-relaxed max-w-xs mx-auto">
              Escribe aquí lo que estés sintiendo, pensando o viviendo hoy. Tus miedos, astrología, síntomas o pensamientos... yo me encargo de clasificarlo y acompañarte.
            </p>
          </div>
        )}

        {messages?.map((msg) => {
          const isProcessing = processingId === msg.id || msg.status === 'processing';
          const isEditing = editingId === msg.id;
          const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={msg.id} className="flex flex-col gap-1.5 max-w-[90%] ml-auto">
              <div className="bg-amber-100/90 text-stone-900 border border-amber-200 rounded-2xl rounded-tr-xs p-3.5 shadow-sm relative group">
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-2.5 text-sm bg-white border border-amber-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-400 text-stone-800 resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1 text-xs font-medium text-stone-600 bg-white/80 hover:bg-stone-200/80 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveEdit(msg.id)}
                        disabled={!editingText.trim()}
                        className="px-2.5 py-1 text-xs font-bold text-stone-950 bg-amber-400 hover:bg-amber-500 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed font-normal">{msg.text}</p>
                )}

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-amber-200/60 text-[11px] text-amber-900/70">
                  <span className="flex items-center gap-1">
                    {timeStr}
                    {msg.status === 'pending' && (
                      <span className="flex items-center gap-0.5 text-amber-700 ml-1" title="Pendiente de conexión/clasificación">
                        <Clock className="w-3 h-3" />
                      </span>
                    )}
                    {msg.status === 'processing' && (
                      <span className="flex items-center gap-0.5 text-amber-800 animate-spin ml-1" title="Procesando con Gemini">
                        <RefreshCw className="w-3 h-3" />
                      </span>
                    )}
                    {msg.status === 'classified' && (
                      <span className="flex items-center gap-0.5 text-emerald-700 ml-1" title="Clasificado en el grafo">
                        <CheckCircle2 className="w-3 h-3" />
                      </span>
                    )}
                    {msg.status === 'error' && (
                      <span className="flex items-center gap-0.5 text-rose-600 ml-1" title={msg.errorMessage || 'Error'}>
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleFavorite(msg)}
                      className={`p-1 rounded-full transition-colors ${
                        msg.isFavorite ? 'text-amber-600 fill-amber-500 bg-amber-200/60' : 'hover:bg-amber-200/50 text-stone-400'
                      }`}
                      title={msg.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                    >
                      <Star className={`w-3.5 h-3.5 ${msg.isFavorite ? 'fill-amber-500 text-amber-600' : ''}`} />
                    </button>

                    <button
                      onClick={() => toggleImportant(msg)}
                      className={`p-1 rounded-full transition-colors ${
                        msg.isImportant ? 'text-rose-600 fill-rose-500 bg-rose-100' : 'hover:bg-amber-200/50 text-stone-400'
                      }`}
                      title={msg.isImportant ? 'Quitar de importante' : 'Marcar como importante'}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${msg.isImportant ? 'fill-rose-500 text-rose-600' : ''}`} />
                    </button>

                    <button
                      onClick={() => handleForceInsight(msg)}
                      disabled={isProcessing}
                      className="p-1 rounded-full hover:bg-amber-200/60 text-amber-800 transition-colors disabled:opacity-50"
                      title="Pedir reflexión / aterrizaje de Gemini"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    </button>

                    <button
                      onClick={() => handleStartEdit(msg)}
                      className="p-1 rounded-full hover:bg-amber-200/50 text-stone-400 hover:text-amber-800 transition-colors"
                      title="Editar mensaje"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingId(msg.id)}
                      className="p-1 rounded-full hover:bg-rose-100 text-stone-400 hover:text-rose-600 transition-colors"
                      title="Borrar mensaje"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {msg.geminiInsight && (
                <div className="mr-auto max-w-[95%] bg-white border border-amber-300/80 rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-stone-800 space-y-1.5 relative bg-gradient-to-br from-amber-50/50 to-orange-50/30">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
                    <Bot className="w-4 h-4 text-amber-600" />
                    <span>Acompañamiento Fergirasol 🌻</span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">
                    {msg.geminiInsight}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Confirmation Modal for Message Deletion */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-xl border border-amber-200 text-center space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-stone-800 text-base">¿Borrar mensaje?</h3>
              <p className="text-xs text-stone-500">
                Esta acción eliminará el mensaje y actualizará el grafo de conexiones. No se puede deshacer.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmDelete(deletingId)}
                className="flex-1 py-2 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="fixed bottom-[60px] left-0 right-0 max-w-md mx-auto p-2 bg-white/95 backdrop-blur-md border-t border-amber-200/80 flex items-center gap-2 shadow-md z-30"
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Escribe tus pensamientos, miedos o notas..."
          rows={1}
          className="flex-1 px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-2xl focus:outline-hidden focus:border-amber-400 focus:bg-white resize-none max-h-24 text-stone-800 placeholder:text-stone-400"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-amber-500 shrink-0 shadow-sm"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>
    </div>
  );
};
