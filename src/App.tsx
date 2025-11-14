// src/App.tsx
import React, { useEffect, useState } from "react";
import "./App.css";

const BASE_PATH = import.meta.env.BASE_URL || "/";
const SESSION_KEY = "eval360_admin_session";
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutos
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "1234";

export function navigate(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  window.location.href = `${BASE_PATH}${clean}`;
}

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
// APP PRINCIPAL - ENRUTAMIENTO
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

  // Ruta pública: Formulario de evaluación
  if (path.startsWith("/evaluar")) {
    return <EvaluarPage />;
  }

  // Rutas protegidas con AdminGate
  return (
    <AdminGate>
      <ProtectedRoutes path={path} />
    </AdminGate>
  );
}

// =====================================================
// COMPONENTE PARA RUTAS PROTEGIDAS
// =====================================================

function ProtectedRoutes({ path }: { path: string }) {
  // Resultados
  if (path.startsWith("/resultados")) {
    return <ResultadosPage />;
  }

  // Dashboard con nombre de evaluación
  if (path.match(/^\/[^/]+$/) && path !== "/") {
    return <DashboardPage />;
  }

  // Gestión de Ciclos (ruta raíz)
  return <GestionCiclosPage />;
}

export default App;

// =====================================================
// ADMIN GATE - PROTECCIÓN CON PIN
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
                width: "87%",
                padding: "9px 10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                marginBottom: "8px",
                animation: error ? "shake 0.3s" : "none"
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
// PÁGINAS (Lazy Loading)
// =====================================================

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const GestionCiclos = React.lazy(() => import("./pages/GestionCiclos"));
const Resultados = React.lazy(() => import("./pages/Resultados"));

export function getCicloRutaFromNombre(nombre: string): string {
  return nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="root">
          <div className="app">
            <div className="panel">
              <p>Cargando dashboard...</p>
            </div>
          </div>
        </div>
      }
    >
      <Dashboard />
    </React.Suspense>
  );
}

function GestionCiclosPage() {
  return (
    <React.Suspense
      fallback={
        <div className="root">
          <div className="app">
            <div className="panel">
              <p>Cargando gestión de evaluaciones...</p>
            </div>
          </div>
        </div>
      }
    >
      <GestionCiclos />
    </React.Suspense>
  );
}

function ResultadosPage() {
  return (
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
  );
}

// =====================================================
// PÁGINA DE EVALUACIÓN (PÚBLICA)
// =====================================================

function EvaluarPage() {
  const [evaluador, setEvaluador] = useState<any>(null);
  const [evaluado, setEvaluado] = useState<any>(null);
  const [competencias, setCompetencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [respuestasLikert, setRespuestasLikert] = useState<Record<string, number>>({});
  const [respuestasTexto, setRespuestasTexto] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState("");
  const [enviado, setEnviado] = useState(false);

  const search = new URLSearchParams(window.location.search);
  const evaluadorId = search.get("evaluadorId") || "";

  useEffect(() => {
    cargarFormulario();
  }, []);

  async function cargarFormulario() {
    try {
      setLoading(true);
      setError(null);

      if (!evaluadorId) {
        setError("Falta el parámetro evaluadorId en la URL.");
        setLoading(false);
        return;
      }

      const {
        apiGetEvaluador,
        apiFetchEvaluados,
        apiFetchCompetenciasConCargos
      } = await import("./services/api");

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
      const compsFiltradas = listaCompetencias.filter((c: any) => {
        if (!c.activa) return false;
        if (!c.aplicaA || c.aplicaA.length === 0) return true;
        return c.aplicaA.includes(cargo);
      });

      setEvaluador({
        id: String(ev.id),
        nombre: ev.nombre,
        email: ev.email,
        cargo: ev.cargo,
        evaluadoId: String(ev.evaluado_id),
        cicloId: String(ev.ciclo_id),
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
        compsFiltradas.map((c: any) => ({
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
      const { apiCrearEvaluacionCompleta, apiUpdateEvaluadorEstado } = await import("./services/api");

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
            (1 = Nunca, 2 = Rara vez, 3 = Algunas veces, 4 = Casi siempre, 5 = Excelente).
            Las preguntas abiertas deben responderse en el cuadro de texto.
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