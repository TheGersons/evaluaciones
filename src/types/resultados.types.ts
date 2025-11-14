// ===========================================
// 1. types/resultados.types.ts
// ===========================================

import type { EvaluadoDTO } from '../types';

export interface ResultadoEvaluado {
    evaluado: EvaluadoDTO;
    numEvaluaciones: number;
    promedioGeneral: number;
    promediosPorCompetencia: Record<number, number>;
    promediosPorCargo: Record<string, number>;
    promediosPorDimension: Record<string, number>;
    promediosPorHabilidad: Record<string, number>;
    promediosPorGrupo: Record<string, number>;
    comentarios: string[];
    abiertasPorCompetencia: {
        competenciaId: number;
        titulo: string;
        textos: string[];
        pregunta: string;
    }[];
    sumasPorDimensionYCargo: Record<string, Record<string, number>>;
    sumasPorGrupoYCargo: Record<string, Record<string, Record<string, number>>>;
    countsPorDimensionYCargo: Record<string, Record<string, number>>;
    countsPorGrupoYCargo: Record<string, Record<string, Record<string, number>>>;
}

export type ModoMetricas = 'promedio' | 'suma';


/**
 * Respuesta a una pregunta abierta
 */
export interface RespuestaAbierta {
    competenciaId: number;
    titulo: string;
    textos: string[];
    pregunta: string;
}

/**
 * Datos para gráfico de ranking
 */
export interface RankingData {
    nombre: string;
    promedio: number;
}

/**
 * Datos para radar de dimensiones
 */
export interface RadarDimensionData {
    dimension: string;
    valor: number;
}

/**
 * Datos para radar de grupos/habilidades
 */
export interface RadarGrupoData {
    grupo: string;
    promedio: number;
}

/**
 * Datos para gráfico de cargos
 */
export interface CargoData {
    cargo: string;
    promedio: number;
}

/**
 * Colores para dimensiones específicas
 */
export interface DimensionColors {
    bg: string;
    border: string;
    text: string;
    value: string;
}

/**
 * Colores para badges de score
 */
export interface ScoreBadgeColors {
    bg: string;
    color: string;
}