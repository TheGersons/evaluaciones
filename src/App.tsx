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

  if (path.startsWith("/evaluar")) {
    return <EvaluarPage />;
  }

  if (path === "/resultados" || path.startsWith("/resultados")) {
    const Resultados = React.lazy(() => import('./pages/Resultados'));
    return (
      <React.Suspense fallback={
        <div className="root">
          <div className="app">
            <div className="panel">
              <p>Cargando resultados...</p>
            </div>
          </div>
        </div>
      }>
        <Resultados />
      </React.Suspense>
    );
  }

  return <Dashboard />;
}


export default App;

// =====================================================
// DASHBOARD (admin)
// =====================================================

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
    aplicaA: [] as string[]
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
          aplicaA: c.aplicaA || []
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
    const base = window.location.origin;
    // Usar la ruta base correcta
    const basePath = import.meta.env.BASE_URL || '/';
    const url = `${base}${basePath}evaluar?evaluadorId=${encodeURIComponent(evaluador.id)}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => alert("Link copiado al portapapeles"))
        .catch(() => {
          alert("No se pudo copiar automáticamente. Usa copiar/pegar:\n" + url);
        });
    } else {
      alert("Copia este link:\n" + url);
    }
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
        orden: competencias.length // Asignar el siguiente orden disponible
      });

      // 2. Asignar los cargos seleccionados
      await apiSetAplicaCargos(competenciaCreada.id, nuevaCompetencia.aplicaA);

      setNuevaCompetencia({ clave: "", titulo: "", descripcion: "", aplicaA: [] });
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

          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Evalúa a</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th>Enlace</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {evaluadores.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    No hay evaluadores registrados
                  </td>
                </tr>
              ) : (
                evaluadores.map((ev) => {
                  const evaluado = evaluados.find(e => e.id === ev.evaluadoId);
                  return (
                    <tr key={ev.id}>
                      <td>{ev.nombre}</td>
                      <td>{ev.email}</td>
                      <td>{evaluado?.nombre || "—"}</td>
                      <td>{ev.cargo}</td>
                      <td>
                        <span className={`badge ${ev.estado === 'Completada' ? 'badge-success' : 'badge-warning'}`}>
                          {ev.estado}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleCopiarLinkEvaluacion(ev)}
                        >
                          Copiar enlace
                        </button>
                      </td>
                      <td>
                        <button
                          className="btn-danger"
                          type="button"
                          onClick={() => handleEliminarEvaluador(ev.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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

          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Puesto</th>
                <th>Área</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {evaluados.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    No hay personas registradas
                  </td>
                </tr>
              ) : (
                evaluados.map((e) => (
                  <tr key={e.id}>
                    <td>{e.nombre}</td>
                    <td>{e.puesto}</td>
                    <td>{e.area}</td>
                    <td>
                      <button
                        className="btn-danger"
                        type="button"
                        onClick={() => handleEliminarEvaluado(e.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

          <table className="table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Clave</th>
                <th>Título</th>
                <th>Aplica a</th>
                <th>Activa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {competencias.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    No hay competencias registradas
                  </td>
                </tr>
              ) : (
                competencias.map((c) => (
                  <tr key={c.id}>
                    <td>{c.orden}</td>
                    <td>{c.clave}</td>
                    <td>{c.titulo}</td>
                    <td>
                      {!c.aplicaA || c.aplicaA.length === 0
                        ? "Todos"
                        : c.aplicaA.join(", ")}
                    </td>
                    <td>{c.activa ? "Sí" : "No"}</td>
                    <td>
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
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

  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
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
            aplicaA: c.aplicaA || []
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

  function handleCambioRespuesta(clave: string, valor: number) {
    setRespuestas((prev) => ({ ...prev, [clave]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!evaluador || !evaluado) {
      alert("Error: no se pudo cargar la información.");
      return;
    }

    // Verificar que todas las competencias tengan respuesta
    const faltantes = competencias.filter((c) => respuestas[c.clave] == null);
    if (faltantes.length > 0) {
      alert("Por favor responde todas las preguntas.");
      return;
    }

    try {
      // Construir payload para PostgREST
      const payload = {
        evaluador_id: Number(evaluador.id),
        evaluado_id: Number(evaluado.id),
        cargo_evaluador: evaluador.cargo,
        respuestas: competencias.map((c) => ({
          competencia_id: Number(c.id),
          valor: respuestas[c.clave]  // ya validaste que todas tienen respuesta
        })),
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
            Responde cada afirmación usando la escala de 1 a 5 (1 = Nunca ,{`\n`} 2 = Rara vez ,{`\n`} 3 = Algunas veces ,{`\n`} 4 = Casi siempre ,{`\n`} 5 =
            Excelente).
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
                  <div className="pregunta-escalas">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n}>
                        <input
                          type="radio"
                          name={c.clave}
                          value={n}
                          checked={respuestas[c.clave] === n}
                          onChange={() => handleCambioRespuesta(c.clave, n)}
                        />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
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