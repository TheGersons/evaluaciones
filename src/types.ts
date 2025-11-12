// src/types/index.ts

// =====================================================
// CICLOS DE EVALUACIÓN
// =====================================================

export interface CicloEvaluacion {
  id: string;
  nombre: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  estado: 'activa' | 'pausada' | 'finalizada' | 'borrador';
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CicloEvaluacionDTO {
  id: number;
  nombre: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  estado: 'activa' | 'pausada' | 'finalizada' | 'borrador';
  fecha_creacion: string;
  fecha_actualizacion: string;
}

// =====================================================
// EVALUADOS
// =====================================================

export interface Evaluado {
  id: string;
  nombre: string;
  puesto: string;
  area: string;
  fechaRegistro: string;
  activo: boolean;
}

export interface EvaluadoDTO {
  id: number;
  nombre: string;
  puesto: string;
  area: string;
  fecha_registro: string;
  activo: boolean;
}

// =====================================================
// EVALUADORES
// =====================================================

export interface Evaluador {
  id: string;
  nombre: string;
  email: string;
  cargo: string;
  evaluadoId: string;
  cicloId: string;
  fechaRegistro: string;
  estado: 'Pendiente' | 'Completada';
}

export interface EvaluadorDTO {
  id: number;
  nombre: string;
  email: string;
  cargo: string;
  token?: string;
  evaluado_id: number;
  ciclo_id: number;
  fecha_registro: string;
  estado: 'Pendiente' | 'Completada';
}

// =====================================================
// COMPETENCIAS
// =====================================================

export interface Competencia {
  id: string;
  clave: string;
  titulo: string;
  descripcion: string;
  orden: number;
  activa: boolean;
  aplicaA: string[];
  tipo: string;
  dimensionGeneral?: string;
  grupo?: string;
}

export interface CompetenciaDTO {
  id: number;
  clave: string;
  titulo: string;
  descripcion?: string;
  orden: number;
  activa: boolean;
  tipo?: string;
  grupo?: string;
  dimension_general?: string;
  escala_min?: number;
  escala_max?: number;
  etiqueta_min?: string;
  etiqueta_max?: string;
}

export interface CompetenciaAplicaCargoDTO {
  competencia_id: number;
  cargo: string;
}

export interface CicloCompetenciaDTO {
  ciclo_id: number;
  competencia_id: number;
  activa: boolean;
  fecha_agregada: string;
}

// =====================================================
// EVALUACIONES
// =====================================================

export interface EvaluacionDTO {
  id: number;
  evaluador_id: number;
  evaluado_id: number;
  cargo_evaluador: string;
  ciclo_id: number;
  comentarios?: string;
  fecha_completada: string;
}

export interface RespuestaDTO {
  evaluacion_id: number;
  competencia_id: number;
  valor: number;
  comentario: string;
}

// =====================================================
// DASHBOARD STATS
// =====================================================

export interface DashboardStats {
  totalEvaluadores: number;
  totalEvaluados: number;
  totalEvaluaciones: number;
  evaluadoresPendientes: number;
  evaluadoresCompletados: number;
  competenciasActivas?: number;
}

export interface CicloStats {
  ciclo_id: number;
  ciclo_nombre: string;
  ciclo_estado: string;
  total_evaluadores: number;
  total_evaluados: number;
  total_evaluaciones: number;
  evaluadores_pendientes: number;
  evaluadores_completados: number;
  competencias_activas: number;
}

// =====================================================
// FORMULARIOS
// =====================================================

export interface BulkEvaluadorInput {
  nombre: string;
  email: string;
  evaluado_nombre: string;
  cargo: string;
}

export interface NuevoEvaluado {
  nombre: string;
  puesto: string;
  area: string;
}

export interface NuevoEvaluador {
  nombre: string;
  email: string;
  cargo: string;
  evaluadoId: string;
  cicloId: string;
}

export interface NuevaCompetencia {
  clave: string;
  titulo: string;
  descripcion: string;
  aplicaA: string[];
  tipo: string;
  dimensionGeneral?: string;
}

export interface NuevoCiclo {
  nombre: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin?: string;
  estado: 'activa' | 'pausada' | 'finalizada' | 'borrador';
}

// =====================================================
// RESULTADOS
// =====================================================

export interface ResultadoEvaluado {
  evaluado: EvaluadoDTO;
  numEvaluaciones: number;
  promedioGeneral: number;
  promediosPorCompetencia: Record<number, number>;
  promediosPorCargo: Record<string, number>;
  comentarios: string[];
  abiertasPorCompetencia: {
    competenciaId: number;
    titulo: string;
    textos: string[];
    pregunta: string;
  }[];
}

// =====================================================
// CONSTANTES
// =====================================================

export const CARGOS = [
  "Jefe inmediato",
  "Compañero",
  "Sub-alterno",
  "Cliente",
  "Autoevaluacion"
] as const;

export type Cargo = typeof CARGOS[number];

export const ESTADOS_CICLO = {
  activa: 'Activa',
  pausada: 'Pausada',
  finalizada: 'Finalizada',
  borrador: 'Borrador'
} as const;