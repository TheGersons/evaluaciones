// src/services/firestore.ts
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import type {
  Evaluado,
  Evaluador,
  Competencia,
  DashboardStats,
  CargoEvaluador
} from "../types";

const EVALUADOS_COLLECTION = "evaluados";
const EVALUADORES_COLLECTION = "evaluadores";
const COMPETENCIAS_COLLECTION = "competencias";
const EVALUACIONES_COLLECTION = "evaluaciones";

const ALL_CARGOS: CargoEvaluador[] = [
  "Jefe inmediato",
  "Compañero",
  "Sub-alterno",
  "Cliente",
  "Autoevaluacion"
];

// =========================
// Evaluados
// =========================

export async function fetchEvaluados(): Promise<Evaluado[]> {
  const colRef = collection(db, EVALUADOS_COLLECTION);
  const q = query(colRef, orderBy("nombre"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      nombre: data.nombre ?? "",
      puesto: data.puesto ?? "",
      area: data.area ?? "",
      fechaRegistro: data.fechaRegistro,
      activo: data.activo ?? true
    } as Evaluado;
  });
}

export async function createEvaluado(data: {
  nombre: string;
  puesto: string;
  area: string;
}) {
  const colRef = collection(db, EVALUADOS_COLLECTION);
  return addDoc(colRef, {
    ...data,
    fechaRegistro: serverTimestamp(),
    activo: true
  });
}

export async function deleteEvaluado(id: string) {
  const docRef = doc(db, EVALUADOS_COLLECTION, id);
  return deleteDoc(docRef);
}

// =========================
// Evaluadores (admin los carga)
// =========================

export async function fetchEvaluadores(): Promise<Evaluador[]> {
  const colRef = collection(db, EVALUADORES_COLLECTION);
  const q = query(colRef, orderBy("nombre"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      nombre: data.nombre ?? "",
      email: data.email ?? "",
      cargo: data.cargo ?? "",
      token: data.token,
      fechaRegistro: data.fechaRegistro,
      estado: data.estado ?? "Pendiente"
    } as Evaluador;
  });
}

export async function createEvaluador(data: {
  nombre: string;
  email: string;
  cargo: CargoEvaluador | string;
  evaluadoId: string;
}) {
  const colRef = collection(db, EVALUADORES_COLLECTION);
  const token =
   typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return addDoc(colRef, {
    ...data,
    token,
    fechaRegistro: serverTimestamp(),
    estado: "Pendiente"
  });
}

export async function deleteEvaluador(id: string) {
  const docRef = doc(db, EVALUADORES_COLLECTION, id);
  return deleteDoc(docRef);
}

export async function getEvaluador(id: string): Promise<Evaluador | null> {
  const docRef = doc(db, EVALUADORES_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return {
    id: snap.id,
    nombre: data.nombre ?? "",
    email: data.email ?? "",
    cargo: data.cargo ?? "",
    token: data.token,
    fechaRegistro: data.fechaRegistro,
    estado: data.estado ?? "Pendiente"
  };
}

export async function updateEvaluadorEstado(
  id: string,
  estado: "Pendiente" | "Completada"
) {
  const docRef = doc(db, EVALUADORES_COLLECTION, id);
  return updateDoc(docRef, { estado });
}

// =========================
// Competencias
// =========================

export async function fetchCompetencias(): Promise<Competencia[]> {
  const colRef = collection(db, COMPETENCIAS_COLLECTION);
  const q = query(colRef, orderBy("orden"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      clave: data.clave ?? "",
      titulo: data.titulo ?? "",
      descripcion: data.descripcion ?? "",
      orden: data.orden ?? 0,
      activa: data.activa ?? true,
      tipo: data.tipo ?? "likert",
      grupo: data.grupo,
      aplicaA: data.aplicaA ?? ALL_CARGOS,
      escalaMin: data.escalaMin ?? 1,
      escalaMax: data.escalaMax ?? 5,
      etiquetaMin: data.etiquetaMin ?? "Muy bajo",
      etiquetaMax: data.etiquetaMax ?? "Excelente"
    } as Competencia;
  });
}

export async function createCompetencia(data: {
  clave: string;
  titulo: string;
  descripcion: string;
  aplicaA: string[]
}) {
  const colRef = collection(db, COMPETENCIAS_COLLECTION);

  const snapshot = await getDocs(colRef);
  const total = snapshot.size;

  return addDoc(colRef, {
    clave: data.clave,
    titulo: data.titulo,
    descripcion: data.descripcion,
    orden: total + 1,
    activa: true,
    tipo: "likert",
    grupo: null,
    aplicaA: data.aplicaA ?? ["Jefe inmediato", "Compañero", "Sub-alterno", "Cliente", "Autoevaluacion"],
    escalaMin: 1,
    escalaMax: 5,
    etiquetaMin: "Muy bajo",
    etiquetaMax: "Excelente"
  });
}

export async function toggleCompetenciaActiva(id: string, activa: boolean) {
  const docRef = doc(db, COMPETENCIAS_COLLECTION, id);
  return updateDoc(docRef, { activa });
}

// =========================
// Evaluaciones
// =========================

export async function createEvaluacion(data: {
  evaluadorId: string;
  evaluadoId: string;
  cargoEvaluador: string;
  respuestas: Record<string, number>;
  comentarios: string;
}) {
  const colRef = collection(db, EVALUACIONES_COLLECTION);
  return addDoc(colRef, {
    ...data,
    fechaCompletada: serverTimestamp()
  });
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const evaluadoresSnap = await getDocs(collection(db, EVALUADORES_COLLECTION));
  const evaluadosSnap = await getDocs(collection(db, EVALUADOS_COLLECTION));
  const evaluacionesSnap = await getDocs(
    collection(db, EVALUACIONES_COLLECTION)
  );

  return {
    totalEvaluadores: evaluadoresSnap.size,
    totalEvaluados: evaluadosSnap.size,
    totalEvaluaciones: evaluacionesSnap.size
  };
}

// Helper para obtener un evaluado concreto (para la página de evaluación si algún día lo usas)
export async function getEvaluadoById(id: string): Promise<Evaluado | null> {
  const docRef = doc(db, EVALUADOS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return {
    id: snap.id,
    nombre: data.nombre ?? "",
    puesto: data.puesto ?? "",
    area: data.area ?? "",
    fechaRegistro: data.fechaRegistro,
    activo: data.activo ?? true
  };
}
