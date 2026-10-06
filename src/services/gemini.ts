import { GoogleGenAI, type Schema, Type } from '@google/genai';
import { db, getSetting } from '../db';
import type { ChatMessage, NodeCategory } from '../types';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

// Gemini response interface structured JSON
export interface GeminiAnalysisResponse {
  nodes: {
    id: string;
    label: string;
    category: NodeCategory;
    description?: string;
  }[];
  edges: {
    fromNodeId: string;
    toNodeId: string;
    label?: string;
  }[];
  insight?: {
    hasInsight: boolean;
    message?: string;
  };
}

const analysisResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      description: 'Nodos de conceptos, emociones, miedos, astrología o molestias físicas identicados en la nota.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Identificador único en minúsculas y guiones (ej. "contractura-cuello", "miedo-al-rechazo")' },
          label: { type: Type.STRING, description: 'Etiqueta bonita y clara para mostrar en el nodo del grafo' },
          category: {
            type: Type.STRING,
            enum: ['emocion', 'sintoma_fisico', 'astrologia', 'patron', 'idea', 'relacion', 'otro'],
            description: 'Categoría principal del nodo'
          },
          description: { type: Type.STRING, description: 'Breve explicación o contexto sobre cómo se manifiesta este concepto' }
        },
        required: ['id', 'label', 'category']
      }
    },
    edges: {
      type: Type.ARRAY,
      description: 'Conexiones/Relaciones entre nodos identificados en este mensaje o entre este mensaje y conceptos previos.',
      items: {
        type: Type.OBJECT,
        properties: {
          fromNodeId: { type: Type.STRING, description: 'ID del nodo origen' },
          toNodeId: { type: Type.STRING, description: 'ID del nodo destino' },
          label: { type: Type.STRING, description: 'Relación o causa que los conecta (ej: "provoca", "asociado a", "transito en")' }
        },
        required: ['fromNodeId', 'toNodeId']
      }
    },
    insight: {
      type: Type.OBJECT,
      description: 'Reflexión cálida y amorosa de acompañamiento emocional o detección de patrón recurrente.',
      properties: {
        hasInsight: { type: Type.BOOLEAN, description: 'True si es pertinente brindar un comentario/patrón/contención para este mensaje' },
        message: { type: Type.STRING, description: 'Mensaje amoroso estilo hermana girasol ayudando a aterrizar la emoción o notar un patrón' }
      },
      required: ['hasInsight']
    }
  },
  required: ['nodes', 'edges', 'insight']
};

export async function processMessageWithGemini(
  targetMessage: ChatMessage,
  forceInsight = false
): Promise<{ success: boolean; insight?: string; error?: string }> {
  const apiKey = await getSetting('gemini_api_key', '');
  if (!apiKey) {
    return { success: false, error: 'No se ha configurado la API Key de Gemini en Ajustes.' };
  }

  const modelName = (await getSetting('gemini_model', '')) || DEFAULT_GEMINI_MODEL;

  // Retrieve existing nodes context to help Gemini make connections with prior knowledge
  const existingNodes = await db.nodes.toArray();
  const recentMessages = await db.messages
    .orderBy('timestamp')
    .reverse()
    .limit(10)
    .toArray();

  const existingNodesContext = existingNodes.map(n => ({ id: n.id, label: n.label, category: n.category }));
  const contextHistory = recentMessages
    .filter(m => m.id !== targetMessage.id && m.text)
    .map(m => `- ${m.text}`);

  const systemInstruction = `
Eres la acompañante virtual para la app personal de Fergis (Fergirasol - Tarotista, Astróloga y Acompañante Emocional).
Tu propósito es tomar los pensamientos, miedos, notas de astrología, o desregulaciones que ella escribe en su bitácora y:
1. Extraer o reutilizar nodos (conceptos clave) para clasificarlos en un grafo del mundo interior de Fergis.
   CRITERIO MUY ESTRICTO PARA NODOS:
   - Extrae ÚNICAMENTE de 1 a 3 nodos verdaderamente fundamentales por mensaje. Sé extremadamente selectivo.
   - Categorías válidas: 'emocion', 'sintoma_fisico', 'astrologia', 'patron', 'idea', 'relacion', 'otro'.
   - OBLIGATORIO: Si el concepto ya coincide con la lista de [NODOS EXISTENTES], REUTILIZA exactamente el mismo 'id'. Evita crear nodos duplicados o redundantes.
2. Crear conexiones (edges) entre esos nodos únicamente cuando exista una relación causal o correlación muy clara.
3. Generar un 'insight' cálido, amoroso, sin juicios y estilo hermana girasol 🌻.
   CRITERIO MUY ESTRICTO PARA RESPONDER / INSIGHTS:
   - ${forceInsight ? 'SE HA SOLICITADO FORZAR RESPUESTA: Proporciona un mensaje amoroso de contención y aterrizaje obligatoriamente (hasInsight = true).' : 'Sé selectivo: SOLO establece hasInsight = true si el mensaje expresa una desregulación emocional profunda, una vulnerabilidad clara o la detección de un patrón clave. Para notas sencillas, resúmenes, saludos, ideas o textos de organización, pon HASINSIGHT = FALSE (message = undefined) para no sobrecargar el chat.'}
   - Si respondes (hasInsight = true), mantén un tono sumamente empático, amoroso y contenedor.
`;

  const prompt = `
[NODOS EXISTENTES EN EL GRAFO DE FERGIS]
${JSON.stringify(existingNodesContext, null, 2)}

[HISTORIAL RECIENTE DE NOTAS DE FERGIS]
${contextHistory.join('\n')}

[MENSAJE ACTUAL A CLASIFICAR]
"${targetMessage.text}"
`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: analysisResponseSchema,
        temperature: 0.4
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini devolvió una respuesta vacía.');
    }

    const parsed: GeminiAnalysisResponse = JSON.parse(responseText);

    const now = Date.now();
    const createdNodeIds: string[] = [];

    await db.transaction('rw', [db.messages, db.nodes, db.edges], async () => {
      // 1. Save or update nodes
      for (const nodeData of parsed.nodes) {
        const existingNode = await db.nodes.get(nodeData.id);
        if (existingNode) {
          await db.nodes.update(nodeData.id, {
            label: nodeData.label || existingNode.label,
            category: nodeData.category || existingNode.category,
            description: nodeData.description || existingNode.description,
            updatedAt: now
          });
        } else {
          await db.nodes.put({
            id: nodeData.id,
            label: nodeData.label,
            category: nodeData.category,
            description: nodeData.description,
            createdAt: now,
            updatedAt: now
          });
        }
        createdNodeIds.push(nodeData.id);
      }

      // 2. Save edges
      for (const edgeData of parsed.edges) {
        const edgeId = `${edgeData.fromNodeId}->${edgeData.toNodeId}`;
        const existingEdge = await db.edges.get(edgeId);
        if (!existingEdge) {
          await db.edges.put({
            id: edgeId,
            fromNodeId: edgeData.fromNodeId,
            toNodeId: edgeData.toNodeId,
            label: edgeData.label,
            createdAt: now
          });
        }
      }

      // 3. Update message state
      const insightMsg = parsed.insight?.hasInsight ? parsed.insight.message : undefined;
      await db.messages.update(targetMessage.id, {
        status: 'classified',
        nodeIds: createdNodeIds,
        geminiInsight: insightMsg,
        errorMessage: undefined
      });
    });

    return {
      success: true,
      insight: parsed.insight?.hasInsight ? parsed.insight.message : undefined
    };
  } catch (err: any) {
    console.error('Error procesando mensaje con Gemini:', err);
    await db.messages.update(targetMessage.id, {
      status: 'error',
      errorMessage: err.message || 'Error de comunicación con la API de Gemini.'
    });
    return {
      success: false,
      error: err.message || 'Ocurrió un error al procesar el mensaje con Gemini.'
    };
  }
}

// Function to process all pending messages in background when online
export async function testGeminiConnection(
  apiKey: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'Por favor, ingresa una API Key válida.' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    await ai.models.generateContent({
      model: modelName || DEFAULT_GEMINI_MODEL,
      contents: 'Hola',
      config: {
        maxOutputTokens: 5
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error al probar conexión con Gemini:', err);
    let msg = err.message || 'Error de conexión con la API de Gemini.';
    if (typeof msg === 'string') {
      const jsonStart = msg.indexOf('{');
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(msg.substring(jsonStart));
          if (parsed?.error?.message) {
            msg = parsed.error.message;
          }
        } catch {
          // keep original if parsing fails
        }
      }
    }
    return {
      success: false,
      error: msg
    };
  }
}

export async function reprocessAllUnclassifiedMessages(): Promise<{ total: number; processed: number }> {
  const apiKey = await getSetting('gemini_api_key', '');
  if (!apiKey || !navigator.onLine) {
    return { total: 0, processed: 0 };
  }

  // Reset any stuck 'processing' messages or 'error' / 'pending' messages back to pending
  const allMessages = await db.messages.toArray();
  const unclassified = allMessages.filter(m => m.status !== 'classified');

  if (unclassified.length === 0) {
    return { total: 0, processed: 0 };
  }

  for (const msg of unclassified) {
    await db.messages.update(msg.id, { status: 'pending', errorMessage: undefined });
  }

  let processedCount = 0;
  for (const msg of unclassified) {
    await db.messages.update(msg.id, { status: 'processing' });
    const res = await processMessageWithGemini(msg);
    if (res.success) {
      processedCount++;
    }
    // Small delay between requests to avoid Gemini rate limits on batch processing
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  return { total: unclassified.length, processed: processedCount };
}

export async function processPendingMessages(): Promise<void> {
  const apiKey = await getSetting('gemini_api_key', '');
  if (!apiKey || !navigator.onLine) return;

  // Reset any messages stuck in 'processing' (e.g. from app close or net drop) to 'pending'
  const stuckMessages = await db.messages.where('status').equals('processing').toArray();
  for (const msg of stuckMessages) {
    await db.messages.update(msg.id, { status: 'pending' });
  }

  const pendingMessages = await db.messages
    .where('status')
    .equals('pending')
    .toArray();

  for (const msg of pendingMessages) {
    await db.messages.update(msg.id, { status: 'processing' });
    await processMessageWithGemini(msg);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Function to cleanup nodes and edges that are no longer associated with any message
export async function cleanupOrphanNodesAndEdges(): Promise<void> {
  const allMessages = await db.messages.toArray();
  const referencedNodeIds = new Set<string>();
  for (const msg of allMessages) {
    if (msg.nodeIds && Array.isArray(msg.nodeIds)) {
      for (const nid of msg.nodeIds) {
        referencedNodeIds.add(nid);
      }
    }
  }

  const allNodes = await db.nodes.toArray();
  const orphanNodeIds = allNodes.filter(n => !referencedNodeIds.has(n.id)).map(n => n.id);

  if (orphanNodeIds.length > 0) {
    const orphanSet = new Set(orphanNodeIds);
    await db.transaction('rw', [db.nodes, db.edges], async () => {
      for (const nid of orphanNodeIds) {
        await db.nodes.delete(nid);
      }
      const allEdges = await db.edges.toArray();
      for (const edge of allEdges) {
        if (orphanSet.has(edge.fromNodeId) || orphanSet.has(edge.toNodeId)) {
          await db.edges.delete(edge.id);
        }
      }
    });
  }
}

// Function to delete a message and clean up orphaned graph elements
export async function deleteMessage(messageId: string): Promise<void> {
  await db.messages.delete(messageId);
  await cleanupOrphanNodesAndEdges();
}

// Function to edit a message and trigger re-classification
export async function editMessage(messageId: string, newText: string): Promise<void> {
  const existing = await db.messages.get(messageId);
  if (!existing) return;

  const updatedMessage: ChatMessage = {
    ...existing,
    text: newText,
    status: 'pending',
    nodeIds: [],
    geminiInsight: undefined,
    errorMessage: undefined
  };

  await db.messages.put(updatedMessage);
  await cleanupOrphanNodesAndEdges();

  if (navigator.onLine) {
    await db.messages.update(messageId, { status: 'processing' });
    await processMessageWithGemini(updatedMessage);
  }
}
