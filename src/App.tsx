// src/App.tsx
import React, { useEffect, useState } from "react";
import "./App.css";

import type {
  Evaluado,
  Evaluador,
  Competencia,
  DashboardStats,
  BulkEvaluadorInput
} from "./types";

import {
  apiFetchCompetenciasConCargos,
  apiCreateCompetencia,
  apiSetAplicaCargos,
  apiToggleCompetenciaActiva,
  apiCrearEvaluacionCompleta,
  apiFetchEvaluados,
  apiCreateEvaluado,
  apiDeleteEvaluado,
  apiFetchEvaluadores,
  apiCreateEvaluador,
  apiDeleteEvaluador,
  apiGetEvaluador,
  apiFetchDashboardStats,
  apiImportEvaluadoresBatch,
  apiFetchCiclosActivos,
  apiGetCiclo
} from "./services/api";
import { DataTable } from "./components/common/DataTable";
import { DashboardStatsCards } from "./components/dashboard/DashboardStats";
import { FormEvaluador } from "./components/dashboard/FormEvaluadores";
import { FormEvaluado } from "./components/dashboard/FormEvaluados";
import { FormCompetencia } from "./pages/Dashboard";


const BASE_PATH = import.meta.env.BASE_URL || "/";

export function navigate(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  window.location.href = `${BASE_PATH}${clean}`;
}

// =====================================================
// GESTIÓN DE SESIÓN
// =====================================================

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

// =====================================================
// GESTIÓN DE CICLO ACTIVO
// =====================================================

const CICLO_KEY = "ciclo_activo_id";

function getCicloActivo(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CICLO_KEY);
}

function setCicloActivo(cicloId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CICLO_KEY, cicloId);
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

function App() {
  const basePath = import.meta.env.BASE_URL || "/";
  let path = window.location.pathname;

  if (path.startsWith(basePath)) {
    path = path.slice(basePath.length - 1);
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

  // Ruta pública - sin protección
  if (path.startsWith("/evaluar")) {
    return <EvaluarPage />;
  }

  // Rutas protegidas
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

  if (path === "/ciclos" || path.startsWith("/ciclos")) {
    const GestionCiclos = React.lazy(() => import("./pages/GestionCiclos"));
    return (
      <AdminGate>
        <React.Suspense
          fallback={
            <div className="root">
              <div className="app">
                <div className="panel">
                  <p>Cargando gestión de ciclos...</p>
                </div>
              </div>
            </div>
          }
        >
          <GestionCiclos />
        </React.Suspense>
      </AdminGate>
    );
  }

  // Dashboard por defecto
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}

export default App;

// =====================================================
// ADMIN GATE - Protección con PIN
// =====================================================

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

// =====================================================
// DASHBOARD
// =====================================================

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [evaluados, setEvaluados] = useState<Evaluado[]>([]);
  const [evaluadores, setEvaluadores] = useState<Evaluador[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cicloActualId, setCicloActualId] = useState<string | null>(null);
  const [cicloActualNombre, setCicloActualNombre] = useState<string>("");

  const [mostrarModalLink, setMostrarModalLink] = useState(false);
  const [linkCopiar, setLinkCopiar] = useState("");

  const evaluadoresPendientes = evaluadores.filter(
    (e) => e.estado !== "Completada"
  ).length;

  const competenciasActivas = competencias.filter((c) => c.activa).length;

  // Cargar ciclo activo y datos
  useEffect(() => {
    cargarCicloYDatos();
  }, []);

  async function cargarCicloYDatos() {
    try {
      setLoading(true);
      setError(null);

      // Verificar si hay un ciclo guardado
      let cicloId = getCicloActivo();

      // Si no hay ciclo guardado, buscar el primer ciclo activo
      if (!cicloId) {
        const ciclosActivos = await apiFetchCiclosActivos();
        if (ciclosActivos.length > 0) {
          cicloId = String(ciclosActivos[0].id);
          setCicloActivo(cicloId);
        } else {
          setError("No hay ciclos de evaluación activos. Crea uno en 'Gestión de Evaluaciones'.");
          setLoading(false);
          return;
        }
      }

      // Cargar info del ciclo
      const ciclo = await apiGetCiclo(Number(cicloId));
      if (!ciclo) {
        setError("El ciclo seleccionado no existe.");
        setLoading(false);
        return;
      }

      setCicloActualId(cicloId);
      setCicloActualNombre(ciclo.nombre);

      // Cargar datos del ciclo
      await cargarDatosCiclo(Number(cicloId));
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  async function cargarDatosCiclo(cicloId: number) {
    const [evaluadosRes, evaluadoresRes, competenciasRes, statsRes] = await Promise.all([
      apiFetchEvaluados(),
      apiFetchEvaluadores(cicloId), // Filtrado por ciclo
      apiFetchCompetenciasConCargos(),
      apiFetchDashboardStats()
    ]);

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

    setEvaluadores(
      evaluadoresRes.map((e) => ({
        id: String(e.id),
        nombre: e.nombre,
        email: e.email,
        cargo: e.cargo,
        evaluadoId: String(e.evaluado_id),
        fechaRegistro: e.fecha_registro,
        estado: e.estado,
        cicloId: String(e.ciclo_id)
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

    setStats(statsRes);
  }

  // Handlers Evaluados
  async function handleAgregarEvaluado(data: { nombre: string; puesto: string; area: string }) {
    try {
      await apiCreateEvaluado(data);
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      alert("Error agregando evaluado");
    }
  }

  async function handleEliminarEvaluado(id: string) {
    if (!confirm("¿Eliminar esta persona a evaluar?")) return;
    try {
      await apiDeleteEvaluado(Number(id));
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      alert("Error eliminando evaluado");
    }
  }

  // Handlers Evaluadores
  async function handleAgregarEvaluador(data: {
    nombre: string;
    email: string;
    cargo: string;
    evaluadoId: string;
    cicloId: number;
  }) {
    try {
      await apiCreateEvaluador({
        nombre: data.nombre,
        email: data.email,
        cargo: data.cargo,
        evaluado_id: Number(data.evaluadoId),
        ciclo_id: data.cicloId
      });
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      alert("Error agregando evaluador");
    }
  }

  async function handleEliminarEvaluador(id: string) {
    if (!confirm("¿Eliminar este evaluador?")) return;
    try {
      await apiDeleteEvaluador(Number(id));
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      alert("Error eliminando evaluador");
    }
  }

  async function handleImportarEvaluadores(items: BulkEvaluadorInput[]) {
    try {
      await apiImportEvaluadoresBatch(items);
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  function handleCopiarLinkEvaluacion(evaluador: Evaluador) {
    const url = `${window.location.origin}${BASE_PATH}evaluar?evaluadorId=${evaluador.id}`;
    setLinkCopiar(url);
    setMostrarModalLink(true);
  }

  // Handlers Competencias
  async function handleAgregarCompetencia(data: {
    clave: string;
    titulo: string;
    descripcion: string;
    aplicaA: string[];
    tipo: string;
  }) {
    try {
      const competenciaCreada = await apiCreateCompetencia({
        clave: data.clave,
        titulo: data.titulo,
        descripcion: data.descripcion,
        orden: competencias.length,
        tipo: data.tipo
      });

      await apiSetAplicaCargos(competenciaCreada.id, data.aplicaA);
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  async function handleToggleActiva(c: Competencia) {
    try {
      await apiToggleCompetenciaActiva(Number(c.id), !c.activa);
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      alert("Error actualizando competencia");
    }
  }

  async function handleEliminarCompetencia(id: string) {
    if (!confirm("¿Desactivar esta competencia?")) return;
    try {
      await apiToggleCompetenciaActiva(Number(id), false);
      await cargarDatosCiclo(Number(cicloActualId));
    } catch (e: any) {
      console.error(e);
      alert("Error desactivando competencia");
    }
  }

  // Envío masivo de correos (comentado por ahora)
  /*
  async function handleEnviarCorreosMasivo() {
    const pendientes = evaluadores.filter(e => e.estado === 'Pendiente');
    if (pendientes.length === 0) {
      alert("No hay evaluadores pendientes");
      return;
    }
    if (!confirm(`¿Enviar ${pendientes.length} correos?`)) return;

    try {
      const response = await fetch('http://192.168.3.87/eval360/api/email/enviar-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (!response.ok) throw new Error('Error en servidor');
      alert(`✅ ${pendientes.length} correos enviados`);
    } catch (e: any) {
      alert("Error enviando correos: " + e.message);
    }
  }
  */

  if (loading) {
    return (
      <div className="root">
        <div className="app">
          <div className="panel">
            <p>Cargando datos...</p>
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
            <button
              onClick={() => navigate('/ciclos')}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              📊 Ir a Gestión de Evaluaciones
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="root">
      <div className="app">
        <header className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1>🎯 Evaluación 360° - Dashboard</h1>
              <p>
                <strong>Evaluación actual:</strong> {cicloActualNombre}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/ciclos')}
                style={{
                  padding: '10px 20px',
                  background: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📋 Gestión de Evaluaciones
              </button>
              <button
                onClick={() => navigate('/resultados')}
                style={{
                  padding: '10px 20px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📊 Ver Resultados
              </button>
            </div>
          </div>
        </header>

        {stats && (
          <DashboardStatsCards
            stats={stats}
            evaluadoresPendientes={evaluadoresPendientes}
            competenciasActivas={competenciasActivas}
          />
        )}

        {/* Evaluadores */}
        <section className="panel">
          <h2>🧑‍💼 Evaluadores</h2>
          <p className="sub">
            Registra a las personas que evaluarán en este ciclo. Cada una tendrá un enlace único.
          </p>

          <FormEvaluador
            evaluados={evaluados}
            cicloId={cicloActualId || "0"}
            onSubmit={handleAgregarEvaluador}
            onImportBatch={handleImportarEvaluadores}
          />

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
            Personas que pueden ser evaluadas en cualquier ciclo.
          </p>

          <FormEvaluado onSubmit={handleAgregarEvaluado} />

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
          </p>

          <FormCompetencia
            onSubmit={handleAgregarCompetencia}
            totalCompetencias={competencias.length}
          />

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
                header: "Tipo",
                render: (c) => c.tipo === "texto" ? "Abierta" : "Escala 1-5",
                getSortValue: (c) => c.tipo
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

      {/* Modal Link */}
      {mostrarModalLink && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
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
              maxWidth: "480px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "12px", color: "#111827" }}>Enlace de evaluación</h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
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
                  background: "#ffffff",
                  color: "#111827"
                }}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkCopiar);
                    alert("Enlace copiado");
                  } catch {
                    alert("Selecciona y copia manualmente");
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
// PÁGINA DE EVALUACIÓN
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

        const evaluadosRes = await apiFetchEvaluados();
        const evaluadoAsignado = evaluadosRes.find(e => e.id === ev.evaluado_id);

        if (!evaluadoAsignado) {
          setError("No se encontró la persona a evaluar.");
          setLoading(false);
          return;
        }

        const listaCompetencias = await apiFetchCompetenciasConCargos();

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
          estado: ev.estado,
          cicloId: String(ev.ciclo_id)
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

    const faltantesLikert = competencias.filter(
      (c) => c.tipo !== "texto" && respuestasLikert[c.clave] == null
    );

    if (faltantesLikert.length > 0) {
      alert("Por favor responde todas las preguntas de escala.");
      return;
    }

    try {
      const payload = {
        evaluador_id: Number(evaluador.id),
        evaluado_id: Number(evaluado.id),
        cargo_evaluador: evaluador.cargo,
        ciclo_id: Number(evaluador.cicloId),
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

      await apiCrearEvaluacionCompleta(payload);
      setEnviado(true);
    } catch (e: any) {
      console.error(e);
      alert("Error guardando la evaluación: " + e.message);
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
            <p>Tu evaluación ha sido registrada correctamente.</p>
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
          {/* ✅ FIX VISUAL: Card mejorado con colores legibles */}
          <div style={{
            background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid #4f46e5',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{ margin: '8px 0', color: '#1e1b4b', fontSize: '16px' }}>
              <strong>👤 Nombre:</strong> {evaluado?.nombre}
            </p>
            <p style={{ margin: '8px 0', color: '#1e1b4b', fontSize: '16px' }}>
              <strong>💼 Puesto:</strong> {evaluado?.puesto}
            </p>
            <p style={{ margin: '8px 0', color: '#1e1b4b', fontSize: '16px' }}>
              <strong>🏢 Área:</strong> {evaluado?.area}
            </p>
          </div>
        </section>

        <section className="panel">
          <h2>📋 Preguntas</h2>
          <p className="sub">
            Responde cada afirmación usando la escala de 1 a 5 (1 = Nunca, 2 = Rara vez, 
            3 = Algunas veces, 4 = Casi siempre, 5 = Excelente). Las preguntas abiertas 
            deben responderse en el cuadro de texto.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="preguntas-lista">
              {competencias.map((c) => (
                <div key={c.id} className="pregunta-item">
                  <div className="pregunta-texto">
                    <strong>{c.titulo}</strong>
                    {c.descripcion && <p className="sub">{c.descripcion}</p>}
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