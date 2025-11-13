// src/services/api.ts
import type {
  EvaluadoDTO,
  EvaluadorDTO,
  CompetenciaDTO,
  CompetenciaAplicaCargoDTO,
  EvaluacionDTO,
  RespuestaDTO,
  CicloEvaluacionDTO,
  CicloCompetenciaDTO,
  BulkEvaluadorInput,
  CicloStats
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/eval360/api';

// =====================================================
// UTILIDADES
// =====================================================

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    return {} as T;
  }

  return JSON.parse(text);
}

// =====================================================
// CICLOS DE EVALUACIÓN
// =====================================================

export async function apiFetchCiclos(): Promise<CicloEvaluacionDTO[]> {
  return apiFetch<CicloEvaluacionDTO[]>('/ciclos_evaluacion?order=fecha_creacion.desc');
}

export async function apiFetchCiclosActivos(): Promise<CicloEvaluacionDTO[]> {
  return apiFetch<CicloEvaluacionDTO[]>('/ciclos_evaluacion?estado=in.(activa,pausada)&order=fecha_creacion.desc');
}

export async function apiGetCiclo(id: number): Promise<CicloEvaluacionDTO | null> {
  const result = await apiFetch<CicloEvaluacionDTO[]>(`/ciclos_evaluacion?id=eq.${id}`);
  return result.length > 0 ? result[0] : null;
}

export async function apiCreateCiclo(data: {
  nombre: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  estado?: 'activa' | 'pausada' | 'finalizada' | 'borrador';
}): Promise<CicloEvaluacionDTO> {
  const result = await apiFetch<CicloEvaluacionDTO[]>('/ciclos_evaluacion', {
    method: 'POST',
    headers: {
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      nombre: data.nombre,
      descripcion: data.descripcion || '',
      fecha_inicio: data.fecha_inicio,
      fecha_fin: data.fecha_fin || null,
      estado: data.estado || 'borrador'
    }),
  });

  return Array.isArray(result) ? result[0] : result;
}

export async function apiUpdateCiclo(
  id: number,
  data: Partial<CicloEvaluacionDTO>
): Promise<void> {
  await apiFetch(`/ciclos_evaluacion?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteCiclo(id: number): Promise<void> {
  await apiFetch(`/ciclos_evaluacion?id=eq.${id}`, {
    method: 'DELETE',
  });
}

export async function apiClonarCiclo(
  cicloOrigenId: number,
  nuevoNombre: string,
  descripcion?: string,
  clonarEvaluadores: boolean = false
): Promise<number> {
  const result = await apiFetch<{ id: number }[]>('/rpc/clonar_ciclo', {
    method: 'POST',
    body: JSON.stringify({
      p_ciclo_origen_id: cicloOrigenId,
      p_nuevo_nombre: nuevoNombre,
      p_descripcion: descripcion,
      p_clonar_evaluadores: clonarEvaluadores
    }),
  });

  return Array.isArray(result) ? result[0].id : (result as any);
}

// =====================================================
// CICLOS - COMPETENCIAS (N:M)
// =====================================================

export async function apiFetchCompetenciasDeCiclo(
  cicloId: number
): Promise<CicloCompetenciaDTO[]> {
  return apiFetch<CicloCompetenciaDTO[]>(
    `/ciclos_competencias?ciclo_id=eq.${cicloId}`
  );
}

export async function apiAgregarCompetenciasACiclo(
  cicloId: number,
  competenciaIds: number[]
): Promise<void> {
  await apiFetch('/rpc/agregar_competencias_a_ciclo', {
    method: 'POST',
    body: JSON.stringify({
      p_ciclo_id: cicloId,
      p_competencia_ids: competenciaIds
    }),
  });
}

export async function apiToggleCompetenciaEnCiclo(
  cicloId: number,
  competenciaId: number,
  activa: boolean
): Promise<void> {
  await apiFetch(`/ciclos_competencias?ciclo_id=eq.${cicloId}&competencia_id=eq.${competenciaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ activa }),
  });
}

// =====================================================
// STATS POR CICLO
// =====================================================

export async function apiFetchStatsPorCiclo(): Promise<CicloStats[]> {
  return apiFetch<CicloStats[]>('/vista_stats_por_ciclo');
}

export async function apiFetchStatsCiclo(cicloId: number): Promise<CicloStats | null> {
  const result = await apiFetch<CicloStats[]>(`/vista_stats_por_ciclo?ciclo_id=eq.${cicloId}`);
  return result.length > 0 ? result[0] : null;
}

// =====================================================
// EVALUADOS
// =====================================================

export async function apiFetchEvaluados(ciclo_id?: number): Promise<EvaluadoDTO[]> {
  // Si no se proporciona ciclo_id, traer todos
  if (!ciclo_id) {
    return apiFetch<EvaluadoDTO[]>('/evaluados?order=id.asc');
  }

  // Si se proporciona, filtrar por ese ciclo
  return apiFetch<EvaluadoDTO[]>(`/evaluados?ciclo_id=eq.${ciclo_id}&order=id.asc`);
}

export async function apiCreateEvaluado(data: {
  nombre: string;
  puesto: string;
  area: string;
  ciclo_id: number;
}): Promise<EvaluadoDTO> {
  const result = await apiFetch<EvaluadoDTO[]>('/evaluados', {
    method: 'POST',
    headers: {
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      nombre: data.nombre,
      puesto: data.puesto,
      area: data.area,
      activo: true,
      ciclo_id: data.ciclo_id
    }),
  });

  return Array.isArray(result) ? result[0] : result;
}

export async function apiDeleteEvaluado(id: number): Promise<void> {
  await apiFetch(`/evaluados?id=eq.${id}`, {
    method: 'DELETE',
  });
}

export async function apiUpdateEvaluado(
  id: number,
  data: Partial<EvaluadoDTO>
): Promise<void> {
  await apiFetch(`/evaluados?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// =====================================================
// EVALUADORES
// =====================================================

export async function apiFetchEvaluadores(cicloId?: number): Promise<EvaluadorDTO[]> {
  const query = cicloId
    ? `/evaluadores?ciclo_id=eq.${cicloId}&order=id.asc`
    : '/evaluadores?order=id.asc';
  return apiFetch<EvaluadorDTO[]>(query);
}

export async function apiGetEvaluador(id: number): Promise<EvaluadorDTO | null> {
  const result = await apiFetch<EvaluadorDTO[]>(`/evaluadores?id=eq.${id}`);
  return result.length > 0 ? result[0] : null;
}

export async function apiCreateEvaluador(data: {
  nombre: string;
  email: string;
  cargo: string;
  evaluado_id: number;
  ciclo_id: number;
}): Promise<EvaluadorDTO> {
  const result = await apiFetch<EvaluadorDTO[]>('/evaluadores', {
    method: 'POST',
    headers: {
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      nombre: data.nombre,
      email: data.email,
      cargo: data.cargo,
      evaluado_id: data.evaluado_id,
      ciclo_id: data.ciclo_id,
      estado: 'Pendiente'
    }),
  });

  return Array.isArray(result) ? result[0] : result;
}

export async function apiUpdateEvaluadorEstado(
  id: number,
  estado: string
): Promise<void> {
  await apiFetch(`/evaluadores?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
}

export async function apiDeleteEvaluador(id: number): Promise<void> {
  await apiFetch(`/evaluadores?id=eq.${id}`, {
    method: 'DELETE',
  });
}

export async function apiImportEvaluadoresBatch(
  items: BulkEvaluadorInput[]
): Promise<{ insertados: number }> {
  return apiFetch<{ insertados: number }>("/rpc/import_evaluadores_batch", {
    method: "POST",
    body: JSON.stringify({ p_items: items })
  });
}

// =====================================================
// COMPETENCIAS
// =====================================================

export async function apiFetchCompetencias(): Promise<CompetenciaDTO[]> {
  return apiFetch<CompetenciaDTO[]>('/competencias?order=orden.asc');
}

export async function apiCreateCompetencia(data: {
  clave: string;
  titulo: string;
  descripcion?: string;
  orden?: number;
  tipo?: string;
  grupo?: string;
  dimension_general?: string;
}): Promise<CompetenciaDTO> {
  const result = await apiFetch<CompetenciaDTO[]>('/competencias', {
    method: 'POST',
    headers: {
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      clave: data.clave,
      titulo: data.titulo,
      descripcion: data.descripcion || '',
      orden: data.orden || 0,
      activa: true,
      tipo: data.tipo || 'likert',
      grupo: data.grupo || null,
      dimension_general: data.dimension_general || null,
      escala_min: 1,
      escala_max: 5,
      etiqueta_min: 'Muy bajo',
      etiqueta_max: 'Excelente'
    }),
  });

  return Array.isArray(result) ? result[0] : result;
}

export async function apiUpdateCompetencia(
  id: number,
  data: Partial<CompetenciaDTO>
): Promise<void> {
  await apiFetch(`/competencias?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function apiToggleCompetenciaActiva(
  id: number,
  activa: boolean
): Promise<void> {
  await apiUpdateCompetencia(id, { activa });
}

export async function apiDeleteCompetencia(id: number): Promise<void> {
  await apiFetch(`/competencias?id=eq.${id}`, {
    method: 'DELETE',
  });
}

// =====================================================
// COMPETENCIAS_APLICA_CARGO
// =====================================================

export async function apiFetchCargosDeCompetencia(
  competenciaId: number
): Promise<CompetenciaAplicaCargoDTO[]> {
  return apiFetch<CompetenciaAplicaCargoDTO[]>(
    `/competencias_aplica_cargo?competencia_id=eq.${competenciaId}`
  );
}

export async function apiSetAplicaCargos(
  competenciaId: number,
  cargos: string[]
): Promise<void> {
  await fetch(`${API_BASE_URL}/competencias_aplica_cargo?competencia_id=eq.${competenciaId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (cargos.length > 0) {
    const filas = cargos.map(cargo => ({
      competencia_id: competenciaId,
      cargo: cargo
    }));

    await apiFetch('/competencias_aplica_cargo', {
      method: 'POST',
      body: JSON.stringify(filas),
    });
  }
}

// =====================================================
// EVALUACIONES
// =====================================================

export async function apiFetchEvaluaciones(cicloId?: number): Promise<EvaluacionDTO[]> {
  const query = cicloId
    ? `/evaluaciones?ciclo_id=eq.${cicloId}&order=id.desc`
    : '/evaluaciones?order=id.desc';
  return apiFetch<EvaluacionDTO[]>(query);
}

export async function apiCreateEvaluacionCabecera(data: {
  evaluador_id: number;
  evaluado_id: number;
  cargo_evaluador: string;
  ciclo_id: number;
  comentarios?: string;
}): Promise<EvaluacionDTO> {
  const result = await apiFetch<EvaluacionDTO[]>('/evaluaciones', {
    method: 'POST',
    headers: {
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      evaluador_id: data.evaluador_id,
      evaluado_id: data.evaluado_id,
      cargo_evaluador: data.cargo_evaluador,
      ciclo_id: data.ciclo_id,
      comentarios: data.comentarios ?? ''
    }),
  });

  return Array.isArray(result) ? result[0] : result;
}

// =====================================================
// RESPUESTAS
// =====================================================

export async function apiFetchRespuestas(
  evaluacionId: number
): Promise<RespuestaDTO[]> {
  return apiFetch<RespuestaDTO[]>(
    `/respuestas?evaluacion_id=eq.${evaluacionId}`
  );
}

export async function apiFetchRespuestasPorEvaluaciones(
  evaluacionIds: number[]
): Promise<RespuestaDTO[]> {
  if (evaluacionIds.length === 0) return [];

  const uniqueIds = Array.from(new Set(evaluacionIds));
  const ids = uniqueIds.join(',');

  return apiFetch<RespuestaDTO[]>(
    `/respuestas?evaluacion_id=in.(${ids})`
  );
}

export async function apiInsertRespuestas(
  evaluacionId: number,
  respuestas: Array<{ competencia_id: number; valor: number; comentario?: string }>
): Promise<void> {
  const filas = respuestas.map(r => ({
    evaluacion_id: evaluacionId,
    competencia_id: r.competencia_id,
    valor: r.valor,
    comentario: r.comentario ?? ''
  }));

  await apiFetch('/respuestas', {
    method: 'POST',
    body: JSON.stringify(filas),
  });
}

// =====================================================
// FUNCIÓN COMBINADA: Crear evaluación completa
// =====================================================

export async function apiCrearEvaluacionCompleta(data: {
  evaluador_id: number;
  evaluado_id: number;
  cargo_evaluador: string;
  ciclo_id: number;
  respuestas: Array<{ competencia_id: number; valor: number; comentario?: string }>;
  comentarios?: string;
}): Promise<void> {
  const evaluacion = await apiCreateEvaluacionCabecera({
    evaluador_id: data.evaluador_id,
    evaluado_id: data.evaluado_id,
    cargo_evaluador: data.cargo_evaluador,
    ciclo_id: data.ciclo_id,
    comentarios: data.comentarios
  });

  await apiInsertRespuestas(evaluacion.id, data.respuestas);
  await apiUpdateEvaluadorEstado(data.evaluador_id, 'Completada');
}

// =====================================================
// AUXILIAR: COMPETENCIAS CON CARGOS
// =====================================================

async function apiFetchTodasCompetenciasAplicaCargo(): Promise<CompetenciaAplicaCargoDTO[]> {
  return apiFetch<CompetenciaAplicaCargoDTO[]>(`/competencias_aplica_cargo`);
}

export async function apiFetchCompetenciasConCargos(): Promise<Array<CompetenciaDTO & { aplicaA: string[] }>> {
  const [competencias, relaciones] = await Promise.all([
    apiFetchCompetencias(),
    apiFetchTodasCompetenciasAplicaCargo(),
  ]);

  const cargosPorCompetencia = new Map<number, string[]>();

  for (const rel of relaciones) {
    const lista = cargosPorCompetencia.get(rel.competencia_id) ?? [];
    lista.push(rel.cargo);
    cargosPorCompetencia.set(rel.competencia_id, lista);
  }

  return competencias.map(comp => ({
    ...comp,
    aplicaA: cargosPorCompetencia.get(comp.id) ?? [],
  }));
}

// =====================================================
// STATS DEL DASHBOARD (Legacy - mantener compatibilidad)
// =====================================================

// DESPUÉS - Agregar parámetro cicloId:
export async function apiFetchDashboardStats(cicloId?: number): Promise<{
  totalEvaluadores: number;
  totalEvaluados: number;
  totalEvaluaciones: number;
  evaluadoresPendientes: number;
  evaluadoresCompletados: number;
}> {
  const [evaluadores, evaluados, evaluaciones] = await Promise.all([
    apiFetchEvaluadores(cicloId),    // ✅ Ahora filtra por ciclo
    apiFetchEvaluados(cicloId),
    apiFetchEvaluaciones(cicloId)    // ✅ Ahora filtra por ciclo
  ]);

  return {
    totalEvaluadores: evaluadores.length,
    totalEvaluados: evaluados.length,
    totalEvaluaciones: evaluaciones.length,
    evaluadoresPendientes: evaluadores.filter(e => e.estado === 'Pendiente').length,
    evaluadoresCompletados: evaluadores.filter(e => e.estado === 'Completada').length
  };
}

// Nueva función: Obtener competencias por ciclo específico
export async function apiFetchCompetenciasConCargosPorCiclo(
  cicloId: number
): Promise<Array<CompetenciaDTO & { aplicaA: string[] }>> {
  // Obtener competencias vinculadas al ciclo
  const cicloCompetencias = await apiFetchCompetenciasDeCiclo(cicloId);

  if (cicloCompetencias.length === 0) {
    return [];
  }

  const competenciaIds = cicloCompetencias.map(cc => cc.competencia_id);

  // Obtener datos completos de competencias
  const competencias = await apiFetch<CompetenciaDTO[]>(
    `/competencias?id=in.(${competenciaIds.join(',')})&order=orden.asc`
  );

  // Obtener cargos
  const relaciones = await apiFetch<CompetenciaAplicaCargoDTO[]>(
    `/competencias_aplica_cargo?competencia_id=in.(${competenciaIds.join(',')})`
  );

  const cargosPorCompetencia = new Map<number, string[]>();
  for (const rel of relaciones) {
    const lista = cargosPorCompetencia.get(rel.competencia_id) ?? [];
    lista.push(rel.cargo);
    cargosPorCompetencia.set(rel.competencia_id, lista);
  }

  return competencias.map(comp => ({
    ...comp,
    aplicaA: cargosPorCompetencia.get(comp.id) ?? [],
  }));
}

// Nueva función: Crear competencia Y vincularla a un ciclo
export async function apiCreateCompetenciaEnCiclo(
  cicloId: number,
  data: {
    clave: string;
    titulo: string;
    descripcion?: string;
    orden?: number;
    tipo?: string;
    grupo?: string;
    dimension_general?: string;
  },
  aplicaA: string[]
): Promise<CompetenciaDTO> {
  // 1. Crear la competencia
  const competencia = await apiCreateCompetencia(data);

  // 2. Vincularla al ciclo
  await apiFetch('/ciclos_competencias', {
    method: 'POST',
    body: JSON.stringify({
      ciclo_id: cicloId,
      competencia_id: competencia.id,
      activa: true
    }),
  });

  // 3. Asignar cargos
  if (aplicaA.length > 0) {
    await apiSetAplicaCargos(competencia.id, aplicaA);
  }

  return competencia;
}