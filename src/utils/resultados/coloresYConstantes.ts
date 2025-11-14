// src/utils/resultados/coloresYConstantes.ts
import type { DimensionColors, ScoreBadgeColors } from '../../types/resultados.types';

/**
 * Colores principales para gráficos
 */
export const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

/**
 * Colores vivos para gráficos de múltiples series
 */
export const PASTEL_COLORS = [
    '#ef4444', // rojo vivo
    '#3b82f6', // azul vivo
    '#10b981', // verde vivo
    '#f59e0b', // amarillo/ámbar vivo
    '#8b5cf6', // morado vivo
    '#06b6d4', // turquesa vivo
    '#ec4899', // rosa fuerte
    '#f97316', // naranja vivo
];

/**
 * Configuración de colores por dimensión
 */
export const DIMENSION_COLORS: Record<string, DimensionColors> & { default: DimensionColors } = {
    'Fiabilidad': {
        bg: '#fef2f2',
        border: '#ef4444',
        text: '#991b1b',
        value: '#dc2626'
    },
    'Armonía': {
        bg: '#eff6ff',
        border: '#3b82f6',
        text: '#1e40af',
        value: '#2563eb'
    },
    'Interés': {
        bg: '#f0fdf4',
        border: '#10b981',
        text: '#065f46',
        value: '#059669'
    },
    'default': {
        bg: '#f9fafb',
        border: '#d1d5db',
        text: '#374151',
        value: '#6b7280'
    }
};

/**
 * Obtiene los colores para una dimensión específica
 */
export function getDimensionColor(dimension: string): DimensionColors {
    return DIMENSION_COLORS[dimension] || DIMENSION_COLORS.default;
}

/**
 * Obtiene el color según el puntaje
 */
export function getScoreColor(score: number): string {
    if (score >= 4.5) return '#10b981'; // Verde
    if (score >= 3.5) return '#4f46e5'; // Azul/Índigo
    if (score >= 2.5) return '#f59e0b'; // Amarillo
    return '#ef4444'; // Rojo
}

/**
 * Obtiene la etiqueta textual según el puntaje
 */
export function getScoreLabel(score: number): string {
    if (score >= 4.5) return 'Excelente';
    if (score >= 3.5) return 'Alto';
    if (score >= 2.5) return 'Promedio';
    return 'Bajo';
}

/**
 * Obtiene los colores del badge según el puntaje
 */
export function getScoreBadgeColors(score: number): ScoreBadgeColors {
    if (score >= 4.5) return { bg: '#d1fae5', color: '#065f46' }; // Verde
    if (score >= 3.5) return { bg: '#dbeafe', color: '#1e40af' }; // Azul
    if (score >= 2.5) return { bg: '#fef3c7', color: '#92400e' }; // Amarillo
    return { bg: '#fee2e2', color: '#991b1b' }; // Rojo
}

/**
 * Obtiene los colores del badge para dimensión
 */
export function getDimensionBadgeColors(dimension: string): ScoreBadgeColors {
    const colors = getDimensionColor(dimension);
    return {
        bg: colors.bg,
        color: colors.text
    };
}