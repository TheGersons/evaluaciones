// src/App.tsx
import { useEffect, useState } from "react";
import "./App.css";

import type {
  Evaluado,
  Evaluador,
  Competencia,
  DashboardStats
} from "./types";
import {
  fetchEvaluados,
  createEvaluado,
  deleteEvaluado,
  fetchCompetencias,
  createCompetencia,
  toggleCompetenciaActiva,
  fetchDashboardStats,
  fetchEvaluadores,
  createEvaluador,
  deleteEvaluador,
  createEvaluacion,
  getEvaluador,
  updateEvaluadorEstado
} from "./services/firestore";

// =====================================================
// Utilidad: decidir qué vista mostrar según la URL
// =====================================================
function App() {
  const path = window.location.pathname;
  if (path.startsWith("/evaluar")) {
    return <EvaluarPage />;
  }
  return <Dashboard />;
}

export default App;

// =====================================================
// DASHBOARD (admin)
// =====================================================

function Dashboard() {
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


  async function cargarTodo() {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, evaluadosRes, evaluadoresRes, competenciasRes] =
        await Promise.all([
          fetchDashboardStats(),
          fetchEvaluados(),
          fetchEvaluadores(),
          fetchCompetencias()
        ]);

      setStats(statsRes);
      setEvaluados(evaluadosRes);
      setEvaluadores(evaluadoresRes);
      setCompetencias(competenciasRes);
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
  // Handlers Evaluados
  // ==========================

  async function handleAgregarEvaluado(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoEvaluado.nombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    try {
      await createEvaluado({
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
      await deleteEvaluado(id);
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error eliminando evaluado");
    }
  }

  // ==========================
  // Handlers Evaluadores
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
      await createEvaluador({
        nombre: nuevoEvaluador.nombre.trim(),
        email: nuevoEvaluador.email.trim(),
        cargo: nuevoEvaluador.cargo,
        evaluadoId: nuevoEvaluador.evaluadoId
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
      await deleteEvaluador(id);
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error eliminando evaluador");
    }
  }

  function handleCopiarLinkEvaluacion(evaluador: Evaluador) {
    const base = window.location.origin;
    const url = `${base}/evaluar?evaluadorId=${encodeURIComponent(evaluador.id)}`;

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
  // Handlers Competencias
  // ==========================

  async function handleAgregarCompetencia(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaCompetencia.clave.trim() || !nuevaCompetencia.titulo.trim()) {
      alert("La clave y el título son obligatorios");
      return;
    }

    try {
      await createCompetencia({
        clave: nuevaCompetencia.clave.trim(),
        titulo: nuevaCompetencia.titulo.trim(),
        descripcion: nuevaCompetencia.descripcion.trim(),
        aplicaA: nuevaCompetencia.aplicaA
      });
      setNuevaCompetencia({ clave: "", titulo: "", descripcion: "", aplicaA: [] });
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error agregando competencia");
    }
  }

  async function handleToggleActiva(c: Competencia) {
    try {
      await toggleCompetenciaActiva(c.id, !c.activa);
      await cargarTodo();
    } catch (e: any) {
      console.error(e);
      alert("Error actualizando competencia");
    }
  }

  // ==========================
  // Render Dashboard
  // ==========================

  return (
    <div className="root">
      <div className="app">
        <header className="header">
          <h1>🎯 Evaluación 360° - Dashboard</h1>
          <p>Administra el personal a evaluar, los evaluadores y las preguntas.</p>
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
              <option value="">Cargo respecto al evaluado</option>
              <option>Jefe inmediato</option>
              <option>Compañero</option>
              <option>Sub-alterno</option>
              <option>Cliente</option>
              <option>Partner</option>
            </select>
            <button type="submit">➕ Agregar evaluador</button>
          </form>

          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th>Enlace</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {evaluadores.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    No hay evaluadores registrados
                  </td>
                </tr>
              ) : (
                evaluadores.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.nombre}</td>
                    <td>{ev.email}</td>
                    <td>{ev.cargo}</td>
                    <td>{ev.estado}</td>
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
                ))
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
            Más adelante podrás limitar por cargo; por ahora se aplican a todos.
          </p>

          <form className="form-row" onSubmit={handleAgregarCompetencia}>
            <input
              type="text"
              placeholder="Clave interna (ej: comunicacion_tecnica)"
              value={nuevaCompetencia.clave}
              onChange={(e) =>
                setNuevaCompetencia({ ...nuevaCompetencia, clave: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Título visible (ej: Comunicación técnica)"
              value={nuevaCompetencia.titulo}
              onChange={(e) =>
                setNuevaCompetencia({ ...nuevaCompetencia, titulo: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Descripción"
              value={nuevaCompetencia.descripcion}
              onChange={(e) =>
                setNuevaCompetencia({
                  ...nuevaCompetencia,
                  descripcion: e.target.value
                })
              }
            />
            <select
              multiple
              className="select-cargo"
              value={nuevaCompetencia.aplicaA || []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(
                  (opt) => opt.value
                );
                setNuevaCompetencia({ ...nuevaCompetencia, aplicaA: selected });
              }}
            >
              <option value="Jefe inmediato">Jefe inmediato</option>
              <option value="Compañero">Compañero</option>
              <option value="Sub-alterno">Sub-alterno</option>
              <option value="Cliente">Cliente</option>
              <option value="Partner">Partner</option>
            </select>

            <button type="submit">➕ Agregar pregunta</button>
          </form>

          <table className="table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Clave</th>
                <th>Título</th>
                <th>Aplica</th>
                <th>Activa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {competencias.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    No hay competencias registradas
                  </td>
                </tr>
              ) : (
                competencias.map((c) => (
                  <tr key={c.id}>
                    <td>{c.orden}</td>
                    <td>{c.clave}</td>
                    <td>{c.titulo}</td>
                    <td>{(c.aplicaA || []).join(", ")}</td>
                    <td>{c.activa ? "Sí" : "No"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleActiva(c)}
                      >
                        {c.activa ? "Desactivar" : "Activar"}
                      </button>
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
  const [evaluados, setEvaluados] = useState<Evaluado[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [evaluadoSeleccionado, setEvaluadoSeleccionado] = useState<string>("");
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

        const [ev, listaEvaluados, listaCompetencias] = await Promise.all([
          getEvaluador(evaluadorId),
          fetchEvaluados(),
          fetchCompetencias()
        ]);

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


        // Filtramos competencias por cargo y activas
        const cargo = ev.cargo;
        const compsFiltradas = listaCompetencias.filter((c) => {
          if (!c.activa) return false;
          if (!c.aplicaA || c.aplicaA.length === 0) return true;
          return c.aplicaA.includes(cargo as any);
        });

        setEvaluador(ev);
        setEvaluados(listaEvaluados);
        setCompetencias(compsFiltradas);
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
    if (!evaluador || !evaluadoSeleccionado) {
      alert("Selecciona a la persona que estás evaluando.");
      return;
    }

    // Verificar que todas las competencias tengan respuesta
    const faltantes = competencias.filter((c) => respuestas[c.clave] == null);
    if (faltantes.length > 0) {
      alert("Por favor responde todas las preguntas.");
      return;
    }

    try {
      await createEvaluacion({
        evaluadorId: evaluador.id,
        evaluadoId: evaluadoSeleccionado,
        cargoEvaluador: evaluador.cargo,
        respuestas,
        comentarios: comentarios.trim()
      });

      await updateEvaluadorEstado(evaluador.id, "Completada");
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
              Tu evaluación para la persona seleccionada ha sido registrada
              correctamente.
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
          <p className="sub">
            Selecciona a la persona sobre la cual estás realizando esta
            evaluación.
          </p>

          <select
            className="select-evaluado"
            value={evaluadoSeleccionado}
            onChange={(e) => setEvaluadoSeleccionado(e.target.value)}
          >
            <option value="">Selecciona a la persona</option>
            {evaluados.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nombre} — {ev.puesto} ({ev.area})
              </option>
            ))}
          </select>
        </section>

        <section className="panel">
          <h2>📋 Preguntas</h2>
          <p className="sub">
            Responde cada afirmación usando la escala de 1 a 5 (1 = Muy bajo, 5 =
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
