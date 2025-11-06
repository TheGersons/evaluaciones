// src/App.tsx
import React, { useEffect, useState } from "react";
import "./App.css";

import type {
  Evaluado,
  Evaluador,
  Competencia,
  DashboardStats
} from "./types";

// ✅ SERVICIOS POSTGREST (ya migrados)
import {
  apiFetchEvaluados,
  apiCreateEvaluado,
  apiDeleteEvaluado,
  apiFetchEvaluadores,
  apiCreateEvaluador,
  apiDeleteEvaluador,
  apiGetEvaluador,
  apiUpdateEvaluadorEstado,
  apiFetchDashboardStats
} from "./services/api";

import {
  apiFetchCompetenciasConCargos,
  apiCreateCompetencia,
  apiSetAplicaCargos,
  apiToggleCompetenciaActiva,
  apiCrearEvaluacionCompleta,
} from "./services/api";


const BASE_PATH = import.meta.env.BASE_URL || "/";

export function navigate(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  window.location.href = `${BASE_PATH}${clean}`;
}

const SESSION_KEY = "eval360_admin_session";
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutos
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "1234";

function isSessionValid(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    const lastActivity = typeof data.lastActivity === "number" ? data.lastActivity : 0;
    const now = Date.now();
    return now - lastActivity < SESSION_TTL_MS;
  } catch {
    return false;
  }
}

function startSession() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ lastActivity: now })
  );
}

function touchSession() {
  if (!isSessionValid()) return;
  if (typeof window === "undefined") return;
  const now = Date.now();
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ lastActivity: now })
  );
}

/*function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
  */




// =====================================================
// Utilidad: decidir qué vista mostrar según la URL
// =====================================================
function App() {
  const basePath = import.meta.env.BASE_URL || "/";
  let path = window.location.pathname;

  // Normalizar: quitar el prefijo base (/eval360/)
  if (path.startsWith(basePath)) {
    path = path.slice(basePath.length - 1); // deja el primer "/" para comparaciones
  }

  useEffect(() => {
    function handleActivity() {
      if (isSessionValid()) {
        touchSession();
      }
    }
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, []);

  if (path.startsWith("/evaluar")) {
    // El formulario de evaluación NO requiere PIN
    return <EvaluarPage />;
  }

  if (path === "/resultados" || path.startsWith("/resultados")) {
    const Resultados = React.lazy(() => import("./pages/Resultados"));
    return (
      <AdminGate>
        <React.Suspense
          fallback={
            <div className="root">
              <div className="app">
                <div className="panel">
                  <p>Cargando resultados...</p>
                </div>
              </div>
            </div>
          }
        >
          <Resultados />
        </React.Suspense>
      </AdminGate>
    );
  }

  // Dashboard por defecto, protegido
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}


export default App;

// =====================================================
// DASHBOARD (admin)
// =====================================================

type SortDirection = "asc" | "desc";

interface DataTableColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  getSortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  getSearchText?: (row: T) => string;
  initialPageSize?: number;
}

function DataTable<T>({
  rows,
  columns,
  searchPlaceholder = "Buscar...",
  getSearchText,
  initialPageSize = 10
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [sortIndex, setSortIndex] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Filtro por texto
  const filtered = rows.filter((row) => {
    if (!search.trim() || !getSearchText) return true;
    const haystack = getSearchText(row).toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  // Orden
  let sorted = filtered;
  if (sortIndex !== null) {
    const col = columns[sortIndex];
    if (col.getSortValue) {
      sorted = [...filtered].sort((a, b) => {
        const va = col.getSortValue!(a);
        const vb = col.getSortValue!(b);
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
  }

  // Paginación
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = sorted.slice(start, end);

  function handleHeaderClick(index: number) {
    const col = columns[index];
    if (!col.getSortValue) return;
    if (sortIndex === index) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortIndex(index);
      setSortDir("asc");
    }
  }

  function handlePageChange(next: number) {
    if (next < 1 || next > totalPages) return;
    setPage(next);
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setPage(1);
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
        gap: "8px",
        flexWrap: "wrap"
      }}>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            flex: "1",
            minWidth: "200px",
            padding: "6px 10px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            fontSize: "14px",
            background: "#ffffff",   // fondo blanco
            color: "#111827"         // texto negro
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>Filas por página</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            style={{
              padding: "4px 8px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "13px"
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                onClick={() => handleHeaderClick(idx)}
                style={col.getSortValue ? { cursor: "pointer" } : {}}
              >
                {col.header}
                {sortIndex === idx && (
                  <span style={{ marginLeft: "4px", fontSize: "10px" }}>
                    {sortDir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center" }}>
                Sin registros
              </td>
            </tr>
          ) : (
            pageRows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col, cIdx) => (
                  <td key={cIdx}>{col.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "8px",
        fontSize: "13px",
        color: "#6b7280",
        flexWrap: "wrap",
        gap: "8px"
      }}>
        <div>
          Mostrando {total === 0 ? 0 : start + 1}–{Math.min(end, total)} de {total}
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "none",
              background: currentPage === 1 ? "#e5e7eb" : "#4b5563",
              color: currentPage === 1 ? "#9ca3af" : "#ffffff",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontSize: "13px"
            }}
          >
            « Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "none",
              background: currentPage === totalPages ? "#e5e7eb" : "#4b5563",
              color: currentPage === totalPages ? "#9ca3af" : "#ffffff",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              fontSize: "13px"
            }}
          >
            Siguiente »
          </button>
        </div>
      </div>
    </div>
  );
}


function AdminGate({ children }: { children: React.ReactNode }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState(() => isSessionValid());

  useEffect(() => {
    if (allowed) {
      touchSession();
    }
  }, [allowed]);

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="root">
      <div className="app">
        <div className="panel" style={{ maxWidth: 480, margin: "40px auto" }}>
          <h2>🔒 Acceso restringido</h2>
          <p className="sub">
            Ingresa el PIN para acceder al panel de administración.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pin === ADMIN_PIN) {
                startSession();
                setAllowed(true);
                setError("");
              } else {
                setError("PIN incorrecto");
              }
            }}
          >
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN de acceso"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                marginBottom: "8px"
              }}
            />
            {error && (
              <p style={{ color: "#b91c1c", fontSize: "13px", marginBottom: "8px" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                background: "#4f46e5",
                color: "white",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}



function Dashboard() {
  const CARGOS = [
    "Jefe inmediato",
    "Compañero",
    "Sub-alterno",
    "Cliente",
    "Autoevaluacion"
  ];

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [evaluados, setEvaluados] = useState<Evaluado[]>([]);
  const [evaluadores, setEvaluadores] = useState<Evaluador[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevoEvaluado, setNuevoEvaluado] = useState({
    nombre: "",
    puesto: "",
    area: ""
  });

  const [nuevoEvaluador, setNuevoEvaluador] = useState({
    nombre: "",
    email: "",
    cargo: "",
    evaluadoId: ""
  });

  const [nuevaCompetencia, setNuevaCompetencia] = useState({
    clave: "",
    titulo: "",
    descripcion: "",
    aplicaA: [] as string[],
    tipo: "likert"
  });

  const [openCargos, setOpenCargos] = useState(false);

  const evaluadoresPendientes = evaluadores.filter(
    (e) => e.estado !== "Completada"
  ).length;

  const competenciasActivas = competencias.filter((c) => c.activa).length;

  const tasaCompletado =
    stats && stats.totalEvaluadores > 0
      ? Math.round(
        (stats.totalEvaluaciones / stats.totalEvaluadores) * 100
      )
      : 0;
  const [mostrarModalLink, setMostrarModalLink] = useState(false);
  const [linkCopiar, setLinkCopiar] = useState("");


  // ✅ MIGRADO A POSTGREST
  async function cargarTodo() {
    try {
      setLoading(true);
      setError(null);

      const [evaluadosRes, evaluadoresRes, competenciasRes, statsRes] = await Promise.all([
        apiFetchEvaluados(),
        apiFetchEvaluadores(), // ✅ Ahora usa PostgREST
        apiFetchCompetenciasConCargos(),
        apiFetchDashboardStats()
      ]);

      // Mapear evaluados desde PostgreSQL
      setEvaluados(
        evaluadosRes.map((e) => ({
          id: String(e.id),
          nombre: e.nombre,
          puesto: e.puesto,
          area: e.area,
          fechaRegistro: e.fecha_registro,
          activo: e.activo
        }))
      );

      // Mapear evaluadores desde PostgreSQL
      setEvaluadores(
        evaluadoresRes.map((e) => ({
          id: String(e.id),
          nombre: e.nombre,
          email: e.email,
          cargo: e.cargo,
          evaluadoId: String(e.evaluado_id),
          fechaRegistro: e.fecha_registro,
          estado: e.estado
        }))
      );

      setCompetencias(
        competenciasRes.map((c) => ({
          id: String(c.id),
          clave: c.clave,
          titulo: c.titulo,
          descripcion: c.descripcion || "",
          orden: c.orden,
          activa: c.activa,
          aplicaA: c.aplicaA || [],
          tipo: c.tipo || "likert"
        }))
      );



      // Stats calculadas desde los datos
      setStats(statsRes);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  // ==========================
  // Handlers Evaluados (✅ Ya migrados)
  // ==========================

  async function handleAgregarEvaluado(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoEvaluado.nombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    try {
      await apiCreateEvaluado({
        nombre: nuevoEvaluado.nombre.trim(),
        puesto: nuevoEvaluado.puesto.trim(),
        area: nuevoEvaluado.area.trim()
      });

      setNuevoEvaluado({ nombre: "", puesto: "", area: "" });
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error agregando evaluado");
    }
  }

  async function handleEliminarEvaluado(id: string) {
    if (!confirm("¿Eliminar esta persona a evaluar?")) return;
    try {
      await apiDeleteEvaluado(Number(id));
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error eliminando evaluado");
    }
  }

  // ==========================
  // Handlers Evaluadores (✅ MIGRADOS A POSTGREST)
  // ==========================

  async function handleAgregarEvaluador(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoEvaluador.nombre.trim() || !nuevoEvaluador.email.trim()) {
      alert("Nombre y correo son obligatorios");
      return;
    }
    if (!nuevoEvaluador.cargo.trim()) {
      alert("Selecciona un cargo");
      return;
    }
    if (!nuevoEvaluador.evaluadoId) {
      alert("Selecciona a quién evaluará esta persona");
      return;
    }

    try {
      await apiCreateEvaluador({
        nombre: nuevoEvaluador.nombre.trim(),
        email: nuevoEvaluador.email.trim(),
        cargo: nuevoEvaluador.cargo,
        evaluado_id: Number(nuevoEvaluador.evaluadoId)
      });

      setNuevoEvaluador({ nombre: "", email: "", cargo: "", evaluadoId: "" });
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error agregando evaluador");
    }
  }

  async function handleEliminarEvaluador(id: string) {
    if (!confirm("¿Eliminar este evaluador?")) return;
    try {
      await apiDeleteEvaluador(Number(id));
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error eliminando evaluador");
    }
  }

  async function handleEnviarCorreosMasivo() {
    const pendientes = evaluadores.filter(e => e.estado === 'Pendiente');

    if (pendientes.length === 0) {
      alert("No hay evaluadores pendientes para enviar correos");
      return;
    }

    if (!confirm(`¿Enviar ${pendientes.length} correos de evaluación?`)) return;

    try {
      setLoading(true);

      // Llamar al backend de NestJS
      const response = await fetch('http://192.168.3.87/eval360/api/email/enviar-masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evaluadores: pendientes.map(ev => ({
            id: ev.id,
            nombre: ev.nombre,
            email: ev.email,
            cargo: ev.cargo,
            evaluadoNombre: evaluados.find(e => e.id === ev.evaluadoId)?.nombre || 'Desconocido'
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Error en el servidor');
      }

      const result = await response.json();
      alert(`✅ ${result.enviados || pendientes.length} correos enviados correctamente`);

    } catch (e: any) {
      console.error(e);
      alert("Error enviando correos: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopiarLinkEvaluacion(evaluador: Evaluador) {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}evaluar?evaluadorId=${evaluador.id}`;
    setLinkCopiar(url);
    setMostrarModalLink(true);
  }


  // ==========================
  // Handlers Competencias (⚠️ Todavía Firebase - migrar Fase 3)
  // ==========================

  async function handleAgregarCompetencia(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaCompetencia.clave.trim() || !nuevaCompetencia.titulo.trim()) {
      alert("La clave y el título son obligatorios");
      return;
    }

    try {
      // 1. Crear la competencia
      const competenciaCreada = await apiCreateCompetencia({
        clave: nuevaCompetencia.clave.trim(),
        titulo: nuevaCompetencia.titulo.trim(),
        descripcion: nuevaCompetencia.descripcion.trim(),
        orden: competencias.length, // Asignar el siguiente orden disponible
        tipo: nuevaCompetencia.tipo
      });

      // 2. Asignar los cargos seleccionados
      await apiSetAplicaCargos(competenciaCreada.id, nuevaCompetencia.aplicaA);

      setNuevaCompetencia({ clave: "", titulo: "", descripcion: "", aplicaA: [], tipo: "likert" });
      setOpenCargos(false);
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error agregando competencia: " + e.message);
    }
  }

  async function handleToggleActiva(c: Competencia) {
    try {
      await apiToggleCompetenciaActiva(Number(c.id), !c.activa);
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error actualizando competencia");
    }
  }

  async function handleEliminarCompetencia(id: string) {
    if (!confirm("¿Eliminar esta competencia? Esta acción no se puede deshacer.")) return;
    try {
      const comp = competencias.find(c => c.id === id);
      if (comp) {
        // la “eliminación” se implementa como desactivar en PostgreSQL
        await apiToggleCompetenciaActiva(Number(id), false);
        alert("Competencia desactivada (no se puede eliminar si tiene evaluaciones asociadas)");
        await cargarTodo();
      }
    } catch (e: any) {
      console.error(e);
      alert("Error eliminando competencia");
    }
  }


  function toggleCargoAplica(cargo: string) {
    setNuevaCompetencia((prev) => {
      const seleccionados = prev.aplicaA || [];
      if (seleccionados.includes(cargo)) {
        return {
          ...prev,
          aplicaA: seleccionados.filter((c) => c !== cargo)
        };
      } else {
        return {
          ...prev,
          aplicaA: [...seleccionados, cargo]
        };
      }
    });
  }

  // ==========================
  // Render Dashboard
  // ==========================




  return (

    <div className="root">
      <div className="app">
        <header className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1>🎯 Evaluación 360° - Dashboard</h1>
              <p>Administra el personal a evaluar, los evaluadores y las preguntas.</p>
            </div>
            <button
              onClick={() => navigate('/resultados')}
              style={{
                padding: '10px 20px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📊 Ver Resultados
            </button>
          </div>
        </header>

        {loading && (
          <div className="panel">
            <p>Cargando datos...</p>
          </div>
        )}

        {error && (
          <div className="panel error">
            <p>{error}</p>
          </div>
        )}

        {!loading && stats && (
          <section className="grid">
            <div className="card">
              <h3>Total Evaluadores</h3>
              <p className="big-number">{stats.totalEvaluadores}</p>
            </div>
            <div className="card">
              <h3>Total Evaluados</h3>
              <p className="big-number">{stats.totalEvaluados}</p>
            </div>
            <div className="card">
              <h3>Evaluaciones Completadas</h3>
              <p className="big-number">{stats.totalEvaluaciones}</p>
            </div>
            <div className="card">
              <h3>Evaluadores Pendientes</h3>
              <p className="big-number">{evaluadoresPendientes}</p>
            </div>
            <div className="card">
              <h3>Competencias Activas</h3>
              <p className="big-number">{competenciasActivas}</p>
            </div>
            <div className="card">
              <h3>Tasa de Completado</h3>
              <p className="big-number">{tasaCompletado}%</p>
            </div>
          </section>
        )}

        {/* Evaluadores */}
        <section className="panel">
          <h2>🧑‍💼 Evaluadores</h2>
          <p className="sub">
            Registra manualmente a las personas que van a evaluar. Cada una tendrá
            un link único de evaluación que puedes copiar.
          </p>

          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleEnviarCorreosMasivo}
              disabled={loading || evaluadores.filter(e => e.estado === 'Pendiente').length === 0}
              style={{
                padding: '10px 20px',
                background: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📧 {loading ? 'Enviando...' : `Enviar ${evaluadores.filter(e => e.estado === 'Pendiente').length} correos pendientes`}
            </button>
          </div>

          <form className="form-row" onSubmit={handleAgregarEvaluador}>
            <input
              type="text"
              placeholder="Nombre del evaluador"
              value={nuevoEvaluador.nombre}
              onChange={(e) =>
                setNuevoEvaluador({ ...nuevoEvaluador, nombre: e.target.value })
              }
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={nuevoEvaluador.email}
              onChange={(e) =>
                setNuevoEvaluador({ ...nuevoEvaluador, email: e.target.value })
              }
            />
            <select
              className="select-cargo"
              value={nuevoEvaluador.evaluadoId}
              onChange={(e) =>
                setNuevoEvaluador({ ...nuevoEvaluador, evaluadoId: e.target.value })
              }
            >
              <option value="">Selecciona a quién evaluará</option>
              {evaluados.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nombre} — {ev.puesto} ({ev.area})
                </option>
              ))}
            </select>
            <select
              className="select-cargo"
              value={nuevoEvaluador.cargo}
              onChange={(e) =>
                setNuevoEvaluador({ ...nuevoEvaluador, cargo: e.target.value })
              }
            >
              <option value="">Cargo respecto al evaluado</option>
              <option>Jefe inmediato</option>
              <option>Compañero</option>
              <option>Sub-alterno</option>
              <option>Cliente</option>
              <option>Autoevaluacion</option>
            </select>
            <button type="submit">➕ Agregar evaluador</button>
          </form>

          <DataTable
            rows={evaluadores}
            columns={[
              {
                header: "Nombre",
                render: (ev) => ev.nombre,
                getSortValue: (ev) => ev.nombre.toLowerCase()
              },
              {
                header: "Correo",
                render: (ev) => ev.email,
                getSortValue: (ev) => ev.email.toLowerCase()
              },
              {
                header: "Evalúa a",
                render: (ev) => {
                  const evaluado = evaluados.find(e => e.id === ev.evaluadoId);
                  return evaluado?.nombre || "—";
                },
                getSortValue: (ev) => {
                  const evaluado = evaluados.find(e => e.id === ev.evaluadoId);
                  return (evaluado?.nombre || "").toLowerCase();
                }
              },
              {
                header: "Cargo",
                render: (ev) => ev.cargo,
                getSortValue: (ev) => ev.cargo.toLowerCase()
              },
              {
                header: "Estado",
                render: (ev) => (
                  <span className={`badge ${ev.estado === 'Completada' ? 'badge-success' : 'badge-warning'}`}>
                    {ev.estado}
                  </span>
                ),
                getSortValue: (ev) => ev.estado.toLowerCase()
              },
              {
                header: "Enlace",
                render: (ev) => (
                  <button
                    type="button"
                    onClick={() => handleCopiarLinkEvaluacion(ev)}
                  >
                    Copiar enlace
                  </button>
                )
              },
              {
                header: "Acciones",
                render: (ev) => (
                  <button
                    className="btn-danger"
                    type="button"
                    onClick={() => handleEliminarEvaluador(ev.id)}
                  >
                    Eliminar
                  </button>
                )
              }
            ]}
            searchPlaceholder="Buscar evaluadores..."
            getSearchText={(ev) => {
              const evaluado = evaluados.find(e => e.id === ev.evaluadoId);
              return `${ev.nombre} ${ev.email} ${ev.cargo} ${evaluado?.nombre || ""}`;
            }}
            initialPageSize={10}
          />

        </section>

        {/* Evaluados */}
        <section className="panel">
          <h2>👤 Personal a Evaluar</h2>
          <p className="sub">
            Aquí agregas solo a las personas que podrán ser seleccionadas en el formulario.
          </p>

          <form className="form-row" onSubmit={handleAgregarEvaluado}>
            <input
              type="text"
              placeholder="Nombre completo"
              value={nuevoEvaluado.nombre}
              onChange={(e) =>
                setNuevoEvaluado({ ...nuevoEvaluado, nombre: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Puesto (ej: Ingeniero Senior)"
              value={nuevoEvaluado.puesto}
              onChange={(e) =>
                setNuevoEvaluado({ ...nuevoEvaluado, puesto: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Área (ej: Desarrollo)"
              value={nuevoEvaluado.area}
              onChange={(e) =>
                setNuevoEvaluado({ ...nuevoEvaluado, area: e.target.value })
              }
            />
            <button type="submit">➕ Agregar</button>
          </form>

          <DataTable
            rows={evaluados}
            columns={[
              {
                header: "Nombre",
                render: (e) => e.nombre,
                getSortValue: (e) => e.nombre.toLowerCase()
              },
              {
                header: "Puesto",
                render: (e) => e.puesto,
                getSortValue: (e) => e.puesto.toLowerCase()
              },
              {
                header: "Área",
                render: (e) => e.area,
                getSortValue: (e) => e.area.toLowerCase()
              },
              {
                header: "Acciones",
                render: (e) => (
                  <button
                    className="btn-danger"
                    type="button"
                    onClick={() => handleEliminarEvaluado(e.id)}
                  >
                    Eliminar
                  </button>
                )
              }
            ]}
            searchPlaceholder="Buscar personal..."
            getSearchText={(e) => `${e.nombre} ${e.puesto} ${e.area}`}
            initialPageSize={10}
          />

        </section>

        {/* Competencias */}
        <section className="panel">
          <h2>📋 Preguntas / Competencias</h2>
          <p className="sub">
            Estas competencias se usarán para construir el formulario de evaluación.
            Puedes limitar por cargo usando el selector.
          </p>

          <form className="form-row" onSubmit={handleAgregarCompetencia}>
            <input
              type="text"
              placeholder="Clave interna (ej: Comunicación_pregunta1)"
              value={nuevaCompetencia.clave}
              onChange={(e) =>
                setNuevaCompetencia({ ...nuevaCompetencia, clave: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Título o tema (ej: Comunicación / Responsabilidad / Compromiso)"
              value={nuevaCompetencia.titulo}
              onChange={(e) =>
                setNuevaCompetencia({ ...nuevaCompetencia, titulo: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Aqui se escribe la pregunta a realizar"
              value={nuevaCompetencia.descripcion}
              onChange={(e) =>
                setNuevaCompetencia({
                  ...nuevaCompetencia,
                  descripcion: e.target.value
                })
              }
            />
            <select
              className="select-cargo"
              value={nuevaCompetencia.tipo}
              onChange={(e) =>
                setNuevaCompetencia({ ...nuevaCompetencia, tipo: e.target.value })
              }
            >
              <option value="likert">Escala 1 a 5</option>
              <option value="texto">Pregunta abierta</option>
            </select>

            <div className="multi-select">
              <div
                className="multi-select-trigger"
                onClick={() => setOpenCargos((o) => !o)}
              >
                <span>
                  {nuevaCompetencia.aplicaA.length === 0
                    ? "Aplica a: todos los cargos"
                    : `Aplica a: ${nuevaCompetencia.aplicaA.join(", ")}`}
                </span>
                <span className="multi-select-arrow">▾</span>
              </div>

              {openCargos && (
                <div className="multi-select-dropdown">
                  {CARGOS.map((cargo) => (
                    <label key={cargo} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={nuevaCompetencia.aplicaA.includes(cargo)}
                        onChange={() => toggleCargoAplica(cargo)}
                      />
                      <span>{cargo}</span>
                    </label>
                  ))}

                  <button
                    type="button"
                    className="multi-select-clear"
                    onClick={() =>
                      setNuevaCompetencia((prev) => ({ ...prev, aplicaA: [] }))
                    }
                  >
                    Todos los cargos
                  </button>
                </div>
              )}
            </div>
            <button type="submit">➕ Agregar pregunta</button>
          </form>

          <DataTable
            rows={competencias}
            columns={[
              {
                header: "Orden",
                render: (c) => c.orden,
                getSortValue: (c) => c.orden
              },
              {
                header: "Clave",
                render: (c) => c.clave,
                getSortValue: (c) => c.clave.toLowerCase()
              },
              {
                header: "Título",
                render: (c) => c.titulo,
                getSortValue: (c) => c.titulo.toLowerCase()
              },
              {
                header: "Aplica a",
                render: (c) =>
                  !c.aplicaA || c.aplicaA.length === 0
                    ? "Todos"
                    : c.aplicaA.join(", "),
                getSortValue: (c) =>
                  (!c.aplicaA || c.aplicaA.length === 0
                    ? "Todos"
                    : c.aplicaA.join(", ")).toLowerCase()
              },
              {
                header: "Activa",
                render: (c) => (c.activa ? "Sí" : "No"),
                getSortValue: (c) => (c.activa ? 1 : 0)
              },
              {
                header: "Acciones",
                render: (c) => (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleActiva(c)}
                    >
                      {c.activa ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      className="btn-danger"
                      type="button"
                      onClick={() => handleEliminarCompetencia(c.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )
              }
            ]}
            searchPlaceholder="Buscar preguntas..."
            getSearchText={(c) =>
              `${c.clave} ${c.titulo} ${(c.descripcion || "")} ${(c.aplicaA || []).join(" ")}`
            }
            initialPageSize={10}
          />

        </section>
      </div>
      {mostrarModalLink && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255, 255, 255, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setMostrarModalLink(false)}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
              width: "90%",
              maxWidth: "480px",
              textAlign: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "12px", color: "#111827" }}>Enlace de evaluación</h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
                marginBottom: "16px",
                flexWrap: "wrap"
              }}
            >
              <input
                type="text"
                readOnly
                value={linkCopiar}
                style={{
                  flex: 1,
                  minWidth: "240px",
                  padding: "8px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "14px",
                  background: "#ffffff",  // fondo blanco
                  color: "#111827"
                }}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkCopiar);
                    alert("Enlace copiado al portapapeles");
                  } catch {
                    alert("Copia no soportada, seleccione el texto y cópielo manualmente.");
                  }
                }}
                style={{
                  background: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Copiar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMostrarModalLink(false)}
              style={{
                padding: "6px 12px",
                background: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>


  );
}

// =====================================================
// PÁGINA DE EVALUACIÓN (público) /evaluar?evaluadorId=...
// =====================================================

function EvaluarPage() {
  const search = new URLSearchParams(window.location.search);
  const evaluadorId = search.get("evaluadorId") || "";

  const [evaluador, setEvaluador] = useState<Evaluador | null>(null);
  const [evaluado, setEvaluado] = useState<Evaluado | null>(null);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [respuestasLikert, setRespuestasLikert] = useState<Record<string, number>>({});
  const [respuestasTexto, setRespuestasTexto] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState("");

  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        setError(null);

        if (!evaluadorId) {
          setError("Falta el parámetro evaluadorId en la URL.");
          setLoading(false);
          return;
        }

        // ✅ Obtener evaluador desde PostgreSQL
        const ev = await apiGetEvaluador(Number(evaluadorId));

        if (!ev) {
          setError("No se encontró el evaluador.");
          setLoading(false);
          return;
        }

        if (ev.estado === "Completada") {
          setError("Este evaluador ya ha completado su evaluación.");
          setLoading(false);
          return;
        }

        // ✅ Obtener el evaluado asignado
        const evaluadosRes = await apiFetchEvaluados();
        const evaluadoAsignado = evaluadosRes.find(e => e.id === ev.evaluado_id);

        if (!evaluadoAsignado) {
          setError("No se encontró la persona a evaluar.");
          setLoading(false);
          return;
        }

        // ⚠️ Competencias todavía desde Firebase
        const listaCompetencias = await apiFetchCompetenciasConCargos();

        // Filtrar competencias por cargo y activas
        const cargo = ev.cargo;
        const compsFiltradas = listaCompetencias.filter((c) => {
          if (!c.activa) return false;
          if (!c.aplicaA || c.aplicaA.length === 0) return true;
          return c.aplicaA.includes(cargo as any);
        });

        setEvaluador({
          id: String(ev.id),
          nombre: ev.nombre,
          email: ev.email,
          cargo: ev.cargo,
          evaluadoId: String(ev.evaluado_id),
          fechaRegistro: ev.fecha_registro,
          estado: ev.estado
        });

        setEvaluado({
          id: String(evaluadoAsignado.id),
          nombre: evaluadoAsignado.nombre,
          puesto: evaluadoAsignado.puesto,
          area: evaluadoAsignado.area,
          fechaRegistro: evaluadoAsignado.fecha_registro,
          activo: evaluadoAsignado.activo
        });

        setCompetencias(
          compsFiltradas.map((c) => ({
            id: String(c.id),
            clave: c.clave,
            titulo: c.titulo,
            descripcion: c.descripcion || "",
            orden: c.orden,
            activa: c.activa,
            aplicaA: c.aplicaA || [],
            tipo: c.tipo || "likert"
          }))
        );

      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Error cargando formulario");
      } finally {
        setLoading(false);
      }
    }

    cargar();
  }, [evaluadorId]);

  function handleCambioRespuestaLikert(clave: string, valor: number) {
    setRespuestasLikert((prev) => ({ ...prev, [clave]: valor }));
  }

  function handleCambioRespuestaTexto(clave: string, texto: string) {
    setRespuestasTexto((prev) => ({ ...prev, [clave]: texto }));
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!evaluador || !evaluado) {
      alert("Error: no se pudo cargar la información.");
      return;
    }

    // Verificar SOLO las competencias de tipo escala (likert)
    const faltantesLikert = competencias.filter(
      (c) => c.tipo !== "texto" && respuestasLikert[c.clave] == null
    );

    if (faltantesLikert.length > 0) {
      alert("Por favor responde todas las preguntas de escala.");
      return;
    }



    try {
      // Construir payload para PostgREST
      const payload = {
        evaluador_id: Number(evaluador.id),
        evaluado_id: Number(evaluado.id),
        cargo_evaluador: evaluador.cargo,
        respuestas: competencias.map((c) => {
          if (c.tipo === "texto") {
            return {
              competencia_id: Number(c.id),
              valor: 0,
              comentario: (respuestasTexto[c.clave] || "").trim()
            };
          }
          return {
            competencia_id: Number(c.id),
            valor: respuestasLikert[c.clave],
            comentario: ""
          };
        }),
        comentarios: comentarios.trim()
      };


      // Crear evaluación completa en PostgreSQL
      await apiCrearEvaluacionCompleta(payload);

      // Actualizar estado del evaluador
      await apiUpdateEvaluadorEstado(Number(evaluador.id), "Completada");
      setEnviado(true);
    } catch (e: any) {
      console.error(e);
      alert("Error guardando la evaluación.");
    }

  }

  if (loading) {
    return (
      <div className="root">
        <div className="app">
          <div className="panel">
            <p>Cargando formulario...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="root">
        <div className="app">
          <div className="panel error">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!evaluador) {
    return (
      <div className="root">
        <div className="app">
          <div className="panel error">
            <p>No se pudo cargar el evaluador.</p>
          </div>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="root">
        <div className="app">
          <div className="panel">
            <h2>✅ ¡Gracias por completar la evaluación!</h2>
            <p>
              Tu evaluación ha sido registrada correctamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="root">
      <div className="app">
        <header className="header">
          <h1>📝 Evaluación 360°</h1>
          <p>
            Evaluador: <strong>{evaluador.nombre}</strong> ({evaluador.cargo})
          </p>
        </header>

        <section className="panel">
          <h2>👤 Persona a evaluar</h2>
          <div className="evaluado-card">
            <p><strong>👤 Nombre:</strong> {evaluado?.nombre}</p>
            <p><strong>💼 Puesto:</strong> {evaluado?.puesto}</p>
            <p><strong>🏢 Área:</strong> {evaluado?.area}</p>
          </div>
        </section>

        <section className="panel">
          <h2>📋 Preguntas</h2>
          <p className="sub">
            Responde cada afirmación usando la escala de 1 a 5
            (1 = Nunca
            2 = Rara vez
            3 = Algunas veces
            4 = Casi siempre
            5 = Excelente).
            Las preguntas abiertas deben responderse en el cuadro de texto.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="preguntas-lista">
              {competencias.map((c) => (
                <div key={c.id} className="pregunta-item">
                  <div className="pregunta-texto">
                    <strong>{c.titulo}</strong>
                    {c.descripcion && (
                      <p className="sub">{c.descripcion}</p>
                    )}
                  </div>

                  {c.tipo === "texto" ? (
                    <div className="comentarios">
                      <textarea
                        value={respuestasTexto[c.clave] || ""}
                        onChange={(e) => handleCambioRespuestaTexto(c.clave, e.target.value)}
                        rows={3}
                        placeholder="Escribe tu respuesta..."
                        style={{ width: "100%" }}
                      />
                    </div>
                  ) : (
                    <div className="pregunta-escalas">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n}>
                          <input
                            type="radio"
                            name={c.clave}
                            value={n}
                            checked={respuestasLikert[c.clave] === n}
                            onChange={() => handleCambioRespuestaLikert(c.clave, n)}
                          />
                          <span>{n}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>


            <div className="comentarios">
              <label>
                Comentarios adicionales (opcional)
                <textarea
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  rows={4}
                />
              </label>
            </div>

            <button className="btn-enviar" type="submit">
              Enviar evaluación
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}