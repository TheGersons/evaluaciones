// src/types.ts

export type CargoEvaluador =
  | "Jefe inmediato"
  | "Compañero"
  | "Sub-alterno"
  | "Cliente"
  | "Partner";

export interface Evaluado {
  id: string;
  nombre: string;
  puesto: string;
  area: string;
  fechaRegistro?: any; // Firestore Timestamp
  activo?: boolean;
}

export interface Evaluador {
  id: string;
  nombre: string;
  email: string;
  cargo: CargoEvaluador | string;
  token?: string;
  fechaRegistro?: any;
  estado: "Pendiente" | "Completada" | string;
}

export interface Competencia {
  id: string;
  clave: string;
  titulo: string;
  descripcion: string;
  orden: number;
  activa: boolean;
  tipo: "likert" | "texto";
  grupo?: string;                // Para agrupar en secciones en el futuro
  aplicaA?: CargoEvaluador[];    // Qué cargos responden esta pregunta
  escalaMin?: number;
  escalaMax?: number;
  etiquetaMin?: string;
  etiquetaMax?: string;
}

export interface DashboardStats {
  totalEvaluadores: number;
  totalEvaluados: number;
  totalEvaluaciones: number;
}
