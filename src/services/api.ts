// src/services/api.ts
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

  // ✅ FIX: Si la respuesta es 204 No Content, devolver objeto vacío
  if (response.status === 204) {
    return {} as T;
  }

  // ✅ FIX: Si no hay contenido en el body, devolver objeto vacío
  const text = await response.text();
  if (!text || text.trim() === '') {
    return {} as T;
  }

  // Parsear el JSON solo si hay contenido
  return JSON.parse(text);
}

// =====================================================
// TIPOS (DTOs desde PostgreSQL)
// =====================================================

export interface EvaluadoDTO {
  id: number;
  nombre: string;
  puesto: string;
  area: string;
  fecha_registro: string;
  activo: boolean;
}

export interface EvaluadorDTO {
  id: number;
  nombre: string;
  email: string;
  cargo: string;
  token?: string;
  evaluado_id: number;
  fecha_registro: string;
  estado: 'Pendiente' | 'Completada';
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
  escala_min?: number;
  escala_max?: number;
  etiqueta_min?: string;
  etiqueta_max?: string;
}

export interface CompetenciaAplicaCargoDTO {
  competencia_id: number;
  cargo: string;
}

export interface EvaluacionDTO {
  id: number;
  evaluador_id: number;
  evaluado_id: number;
  cargo_evaluador: string;
  comentarios?: string;
  fecha_completada: string;
}

export interface RespuestaDTO {
  evaluacion_id: number;
  competencia_id: number;
  valor: number;      // para tipo 'likert'; en abiertas puedes usar 0 o ignorarlo
  comentario: string; // texto libre, '' cuando no aplica
}


export interface ConfiguracionDTO {
  clave: string;
  valor: string;
}

export interface BulkEvaluadorInput {
  nombre: string;
  email: string;
  evaluado_nombre: string;
  cargo: string;
}


// =====================================================
// EVALUADOS
// =====================================================

export async function apiFetchEvaluados(): Promise<EvaluadoDTO[]> {
  return apiFetch<EvaluadoDTO[]>('/evaluados?order=id.asc');
}

export async function apiCreateEvaluado(data: {
  nombre: string;
  puesto: string;
  area: string;
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
      activo: true
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

export async function apiFetchEvaluadores(): Promise<EvaluadorDTO[]> {
  return apiFetch<EvaluadorDTO[]>('/evaluadores?order=id.asc');
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
      escala_min: 1,
      escala_max: 5,
      etiqueta_min: 'Muy bajo',
      etiqueta_max: 'Excelente'
    }),
  });

  // PostgREST con 'Prefer: return=representation' devuelve un array
  // Retornar el primer elemento
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
// COMPETENCIAS_APLICA_CARGO (relación N-M)
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
  // 1. Eliminar relaciones anteriores
  // ✅ FIX: No esperar respuesta JSON del DELETE
  await fetch(`${API_BASE_URL}/competencias_aplica_cargo?competencia_id=eq.${competenciaId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  // 2. Si hay cargos seleccionados, insertarlos
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
// EVALUACIONES (cabecera)
// =====================================================

export async function apiFetchEvaluaciones(): Promise<EvaluacionDTO[]> {
  return apiFetch<EvaluacionDTO[]>('/evaluaciones?order=id.desc');
}

export async function apiCreateEvaluacionCabecera(data: {
  evaluador_id: number;
  evaluado_id: number;
  cargo_evaluador: string;
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
      comentarios: data.comentarios ?? ''  // nunca null
    }),
  });

  return Array.isArray(result) ? result[0] : result;
}


// =====================================================
// RESPUESTAS (detalle de evaluaciones)
// =====================================================

export async function apiFetchRespuestas(
  evaluacionId: number
): Promise<RespuestaDTO[]> {
  return apiFetch<RespuestaDTO[]>(
    `/respuestas?evaluacion_id=eq.${evaluacionId}`
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
    comentario: r.comentario ?? ''  // likert: '', abiertas: texto
  }));

  await apiFetch('/respuestas', {
    method: 'POST',
    body: JSON.stringify(filas),
  });
}


// =====================================================
// CONFIGURACIÓN
// =====================================================

export async function apiFetchConfiguracion(): Promise<Record<string, string>> {
  const result = await apiFetch<ConfiguracionDTO[]>('/configuracion');
  
  const config: Record<string, string> = {};
  result.forEach(item => {
    config[item.clave] = item.valor;
  });
  
  return config;
}

export async function apiUpdateConfiguracion(
  clave: string,
  valor: string
): Promise<void> {
  await apiFetch(`/configuracion?clave=eq.${clave}`, {
    method: 'PATCH',
    body: JSON.stringify({ valor }),
  });
}

// =====================================================
// FUNCIÓN COMBINADA: Crear evaluación completa
// =====================================================

export async function apiCrearEvaluacionCompleta(data: {
  evaluador_id: number;
  evaluado_id: number;
  cargo_evaluador: string;
  respuestas: Array<{ competencia_id: number; valor: number; comentario?: string }>;
  comentarios?: string; // comentario global de la evaluación
}): Promise<void> {
  const evaluacion = await apiCreateEvaluacionCabecera({
    evaluador_id: data.evaluador_id,
    evaluado_id: data.evaluado_id,
    cargo_evaluador: data.cargo_evaluador,
    comentarios: data.comentarios 
  });

  await apiInsertRespuestas(evaluacion.id, data.respuestas);

  await apiUpdateEvaluadorEstado(data.evaluador_id, 'Completada');
}


// =====================================================
// FUNCIONES AUXILIARES PARA COMBINAR COMPETENCIAS + CARGOS
// =====================================================

export async function apiFetchCompetenciasConCargos(): Promise<Array<CompetenciaDTO & { aplicaA: string[] }>> {
  const competencias = await apiFetchCompetencias();
  
  const competenciasConCargos = await Promise.all(
    competencias.map(async (comp) => {
      const cargos = await apiFetchCargosDeCompetencia(comp.id);
      return {
        ...comp,
        aplicaA: cargos.map(c => c.cargo)
      };
    })
  );

  return competenciasConCargos;
}

// =====================================================
// STATS DEL DASHBOARD
// =====================================================

export async function apiFetchDashboardStats(): Promise<{
  totalEvaluadores: number;
  totalEvaluados: number;
  totalEvaluaciones: number;
  evaluadoresPendientes: number;
  evaluadoresCompletados: number;
}> {
  const [evaluadores, evaluados, evaluaciones] = await Promise.all([
    apiFetchEvaluadores(),
    apiFetchEvaluados(),
    apiFetchEvaluaciones()
  ]);

  return {
    totalEvaluadores: evaluadores.length,
    totalEvaluados: evaluados.length,
    totalEvaluaciones: evaluaciones.length,
    evaluadoresPendientes: evaluadores.filter(e => e.estado === 'Pendiente').length,
    evaluadoresCompletados: evaluadores.filter(e => e.estado === 'Completada').length
  };
}