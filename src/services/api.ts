// src/services/api.ts

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "/api";

export interface EvaluadoDTO {
  id?: number;
  nombre: string;
  puesto: string;
  area: string;
  fecha_registro?: string;
  activo?: boolean;
}

// ================
// EVALUADOS
// ================

export async function apiFetchEvaluados(): Promise<EvaluadoDTO[]> {
  const res = await fetch(`${API_BASE}/evaluados`);
  if (!res.ok) {
    throw new Error(`Error al cargar evaluados: ${res.statusText}`);
  }
  return res.json();
}

export async function apiCreateEvaluado(data: {
  nombre: string;
  puesto: string;
  area: string;
}) {
  const res = await fetch(`${API_BASE}/evaluados`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      nombre: data.nombre,
      puesto: data.puesto,
      area: data.area
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Error creando evaluado: ${res.status} ${txt}`);
  }

  // PostgREST devuelve el registro insertado (por return=representation)
  const body = await res.json();
  return body[0]; // primer (y único) registro
}

export async function apiDeleteEvaluado(id: number) {
  const res = await fetch(`${API_BASE}/evaluados?id=eq.${id}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Error eliminando evaluado: ${res.status} ${txt}`);
  }
}
