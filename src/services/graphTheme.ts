import type { NodeCategory } from '../types';

export interface CategoryTheme {
  bg: string;
  border: string;
  text: string;
  label: string;
}

export const CATEGORY_THEMES: Record<NodeCategory, CategoryTheme> = {
  emocion: {
    bg: '#fef3c7',
    border: '#f59e0b',
    text: '#78350f',
    label: 'Emoción',
  },
  sintoma_fisico: {
    bg: '#fee2e2',
    border: '#ef4444',
    text: '#7f1d1d',
    label: 'Síntoma físico',
  },
  astrologia: {
    bg: '#e0e7ff',
    border: '#6366f1',
    text: '#1e1b4b',
    label: 'Astrología',
  },
  patron: {
    bg: '#f3e8ff',
    border: '#a855f7',
    text: '#581c87',
    label: 'Patrón',
  },
  idea: {
    bg: '#dcfce7',
    border: '#22c55e',
    text: '#14532d',
    label: 'Idea',
  },
  relacion: {
    bg: '#fce7f3',
    border: '#ec4899',
    text: '#831843',
    label: 'Relación',
  },
  otro: {
    bg: '#f3f4f6',
    border: '#9ca3af',
    text: '#1f2937',
    label: 'Otro',
  },
};

export function getCategoryTheme(category: string): CategoryTheme {
  return CATEGORY_THEMES[category as NodeCategory] || CATEGORY_THEMES.otro;
}
