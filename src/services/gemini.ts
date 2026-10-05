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
   Categorías válidas: 'emocion', 'sintoma_fisico', 'astrologia', 'patron', 'idea', 'relacion', 'otro'.
   Si un nodo ya existe en el grafo actual, REUTILIZA el mismo 'id' (ejemplo: si existe "contractura-cuello", usa "contractura-cuello").
2. Crear conexiones (edges) entre esos nodos si existe una causa, relación o correlación entre ellos.
3. Generar un 'insight' cálido, amoroso, sin juicios y estilo hermana girasol 🌻.
   - Analiza si el mensaje actual revela un patrón con sus notas pasadas (ej: "Últimamente cuando hablas de X también sientes contracturas...").
   - ${forceInsight ? 'SE HA SOLICITADO FORZAR RESPUESTA: Proporciona un mensaje amoroso de contención y aterrizaje obligatoriamente (hasInsight = true).' : 'Si el mensaje es corto o no requiere contención profunda, hasInsight puede ser false a menos que detectes algo valioso.'}
   - Mantén un tono sumamente empático, amoroso y contenedor.
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
export async function processPendingMessages(): Promise<void> {
  const apiKey = await getSetting('gemini_api_key', '');
  if (!apiKey || !navigator.onLine) return;

  const pendingMessages = await db.messages
    .where('status')
    .equals('pending')
    .toArray();

  for (const msg of pendingMessages) {
    await db.messages.update(msg.id, { status: 'processing' });
    await processMessageWithGemini(msg);
  }
}
