// src/types.ts

export interface Evaluado {
  id: string;
  nombre: string;
  puesto: string;
  area: string;
  fechaRegistro: string | Date;
  activo: boolean;
}

export interface Evaluador {
  id: string;
  nombre: string;
  email: string;
  cargo: string;
  evaluadoId: string; // ID del evaluado que evaluará
  fechaRegistro: string | Date;
  estado: 'Pendiente' | 'Completada';
  token?: string;
}

export interface Competencia {
  id: string;
  clave: string;
  titulo: string;
  descripcion?: string;
  orden: number;
  activa: boolean;
  aplicaA?: string[]; // Array de cargos a los que aplica
  tipo?: string;
  grupo?: string;
  escalaMin?: number;
  escalaMax?: number;
  etiquetaMin?: string;
  etiquetaMax?: string;
}

export interface Evaluacion {
  id: string;
  evaluadorId: string;
  evaluadoId: string;
  cargoEvaluador: string;
  respuestas: Record<string, number>; // { clave_competencia: valor }
  comentarios?: string;
  fechaCompletada: string | Date;
}

export interface Respuesta {
  evaluacionId: string;
  competenciaId: string;
  valor: number;
}

export interface DashboardStats {
  totalEvaluadores: number;
  totalEvaluados: number;
  totalEvaluaciones: number;
}

export interface Configuracion {
  evaluacionActiva: boolean;
  fechaInicio: string;
  fechaCierre: string;
  nombreEvaluacion: string;
}

export type CargoEvaluador =
  | "Jefe inmediato"
  | "Compañero"
  | "Sub-alterno"
  | "Cliente"
  | "Autoevaluacion";