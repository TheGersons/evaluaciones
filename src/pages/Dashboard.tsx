// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { DataTable } from '../components/common/DataTable';
import { DashboardStatsCards } from '../components/dashboard/DashboardStats';
import { FormEvaluado } from '../components/dashboard/FormEvaluados'
import { FormEvaluador } from '../components/dashboard/FormEvaluadores';
import { FormCompetencia } from '../components/dashboard/FormCompetencia';
import type {
  Evaluado,
  Evaluador,
  Competencia,
  DashboardStats,
  NuevoEvaluado,
  BulkEvaluadorInput
} from '../types';
import {
  apiSetAplicaCargos,
  apiToggleCompetenciaActiva,
  apiFetchEvaluados,
  apiCreateEvaluado,
  apiDeleteEvaluado,
  apiFetchEvaluadores,
  apiCreateEvaluador,
  apiDeleteEvaluador,
  apiFetchDashboardStats,
  apiImportEvaluadoresBatch,
  apiUpdateCompetencia,
  apiFetchCompetenciasConCargosPorCiclo
} from '../services/api';
import { navigate } from '../App';
import ModalEditarCompetencia from '../components/dashboard/ModalEditarCompetencia';

export default function Dashboard() {
  // Estado global
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [evaluados, setEvaluados] = useState<Evaluado[]>([]);
  const [evaluadores, setEvaluadores] = useState<Evaluador[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado UI
  const [mostrarModalLink, setMostrarModalLink] = useState(false);
  const [linkCopiar, setLinkCopiar] = useState('');
  const [competenciaEditando, setCompetenciaEditando] = useState<Competencia | null>(null);

  // Ciclo activo (desde localStorage, respaldado por URL)
  const cicloActivoId = localStorage.getItem('ciclo_activo_id') || '1';
  
  // Obtener nombre del ciclo para mostrar en header
  const [/*nombreCiclo*/, setNombreCiclo] = useState<string>('');

    // Calcular valores derivados
  const evaluadoresPendientes = evaluadores.filter(e => e.estado !== 'Completada').length;
  const competenciasActivas = competencias.filter(c => c.activa).length;

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError(null);

      const [evaluadosRes, evaluadoresRes, competenciasRes, statsRes] = await Promise.all([
        apiFetchEvaluados(),
        apiFetchEvaluadores(Number(cicloActivoId)),
        apiFetchCompetenciasConCargosPorCiclo(Number(cicloActivoId)),
        apiFetchDashboardStats()
      ]);

      // Obtener nombre del ciclo
      const { apiGetCiclo } = await import('../services/api');
      const ciclo = await apiGetCiclo(Number(cicloActivoId));
      if (ciclo) {
        setNombreCiclo(ciclo.nombre);
      }

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
          cicloId: String(e.ciclo_id),
          fechaRegistro: e.fecha_registro,
          estado: e.estado
        }))
      );

      setCompetencias(
        competenciasRes.map((c) => ({
          id: String(c.id),
          clave: c.clave,
          titulo: c.titulo,
          descripcion: c.descripcion || '',
          orden: c.orden,
          activa: c.activa,
          aplicaA: c.aplicaA || [],
          tipo: c.tipo || 'likert',
          dimensionGeneral: c.dimension_general,
          grupo : c.grupo
        }))
      );

      setStats(statsRes);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }

  // ===========================================
  // Handlers Evaluados
  // ===========================================

  async function handleAgregarEvaluado(data: NuevoEvaluado) {
    await apiCreateEvaluado(data);
    await cargarTodo();
  }

  async function handleEliminarEvaluado(id: string) {
    if (!confirm('¿Eliminar esta persona a evaluar?')) return;
    await apiDeleteEvaluado(Number(id));
    await cargarTodo();
  }

  // ===========================================
  // Handlers Evaluadores
  // ===========================================

  async function handleAgregarEvaluador(data: {
    nombre: string;
    email: string;
    cargo: string;
    evaluadoId: string;
    cicloId: number;
  }) {
    await apiCreateEvaluador({
      nombre: data.nombre,
      email: data.email,
      cargo: data.cargo,
      evaluado_id: Number(data.evaluadoId),
      ciclo_id: data.cicloId
    });
    await cargarTodo();
  }

  async function handleEliminarEvaluador(id: string) {
    if (!confirm('¿Eliminar este evaluador?')) return;
    await apiDeleteEvaluador(Number(id));
    await cargarTodo();
  }

  async function handleImportarEvaluadores(items: BulkEvaluadorInput[]) {
    await apiImportEvaluadoresBatch(items);
    await cargarTodo();
  }

  async function handleEnviarCorreosMasivo() {
    const pendientes = evaluadores.filter(e => e.estado === 'Pendiente');

    if (pendientes.length === 0) {
      alert('No hay evaluadores pendientes para enviar correos');
      return;
    }

    if (!confirm(`¿Enviar ${pendientes.length} correos de evaluación?`)) return;

    try {
      setLoading(true);

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
      alert('Error enviando correos: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopiarLinkEvaluacion(evaluador: Evaluador) {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}evaluar?evaluadorId=${evaluador.id}`;
    setLinkCopiar(url);
    setMostrarModalLink(true);
  }

  // ===========================================
  // Handlers Competencias
  // ===========================================

  async function handleAgregarCompetencia(data: {
  clave: string;
  titulo: string;
  descripcion: string;
  aplicaA: string[];
  tipo: string;
  dimensionGeneral?: string;
}) {
  const { apiCreateCompetenciaEnCiclo } = await import('../services/api');
  
  await apiCreateCompetenciaEnCiclo(
    Number(cicloActivoId),
    {
      clave: data.clave,
      titulo: data.titulo,
      descripcion: data.descripcion,
      orden: competencias.length,
      tipo: data.tipo,
      dimension_general: data.dimensionGeneral
    },
    data.aplicaA
  );

  await cargarTodo();
}

  async function handleEditarCompetencia(
    id: string,
    data: { clave: string; titulo: string; descripcion: string; aplicaA: string[], dimension: string, grupo: string }
  ) {
    await apiUpdateCompetencia(Number(id), {
      clave: data.clave,
      titulo: data.titulo,
      descripcion: data.descripcion,
      dimension_general: data.dimension,
      grupo: data.grupo
    });

    await apiSetAplicaCargos(Number(id), data.aplicaA);
    await cargarTodo();
  }

  async function handleToggleActiva(c: Competencia) {
    await apiToggleCompetenciaActiva(Number(c.id), !c.activa);
    await cargarTodo();
  }

  async function handleEliminarCompetencia(id: string) {
    if (!confirm('¿Eliminar esta competencia? Esta acción no se puede deshacer.')) return;
    await apiToggleCompetenciaActiva(Number(id), false);
    alert('Competencia desactivada');
    await cargarTodo();
  }

  // ===========================================
  // Render
  // ===========================================

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
              <p>Administra el personal a evaluar, los evaluadores y las preguntas.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
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
                🔄 Gestionar Evaluaciones
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

        {/* Stats */}
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
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              📧 {loading ? 'Enviando...' : `Enviar ${evaluadores.filter(e => e.estado === 'Pendiente').length} correos pendientes`}
            </button>
          </div>

          <FormEvaluador
            evaluados={evaluados}
            cicloId={cicloActivoId}
            onSubmit={handleAgregarEvaluador}
            onImportBatch={handleImportarEvaluadores}
          />

          <DataTable
            rows={evaluadores}
            columns={[
              {
                header: 'Nombre',
                render: (ev) => ev.nombre,
                getSortValue: (ev) => ev.nombre.toLowerCase()
              },
              {
                header: 'Correo',
                render: (ev) => ev.email,
                getSortValue: (ev) => ev.email.toLowerCase()
              },
              {
                header: 'Evalúa a',
                render: (ev) => {
                  const evaluado = evaluados.find(e => e.id === ev.evaluadoId);
                  return evaluado?.nombre || '—';
                },
                getSortValue: (ev) => {
                  const evaluado = evaluados.find(e => e.id === ev.evaluadoId);
                  return (evaluado?.nombre || '').toLowerCase();
                }
              },
              {
                header: 'Cargo',
                render: (ev) => ev.cargo,
                getSortValue: (ev) => ev.cargo.toLowerCase()
              },
              {
                header: 'Estado',
                render: (ev) => (
                  <span className={`badge ${ev.estado === 'Completada' ? 'badge-success' : 'badge-warning'}`}>
                    {ev.estado}
                  </span>
                ),
                getSortValue: (ev) => ev.estado.toLowerCase()
              },
              {
                header: 'Enlace',
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
                header: 'Acciones',
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
              return `${ev.nombre} ${ev.email} ${ev.cargo} ${evaluado?.nombre || ''}`;
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

          <FormEvaluado onSubmit={handleAgregarEvaluado} />

          <DataTable
            rows={evaluados}
            columns={[
              {
                header: 'Nombre',
                render: (e) => e.nombre,
                getSortValue: (e) => e.nombre.toLowerCase()
              },
              {
                header: 'Puesto',
                render: (e) => e.puesto,
                getSortValue: (e) => e.puesto.toLowerCase()
              },
              {
                header: 'Área',
                render: (e) => e.area,
                getSortValue: (e) => e.area.toLowerCase()
              },
              {
                header: 'Acciones',
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

          <FormCompetencia
            onSubmit={handleAgregarCompetencia}
            totalCompetencias={competencias.length}
          />

          <DataTable
            rows={competencias}
            columns={[
              {
                header: 'Orden',
                render: (c) => c.orden,
                getSortValue: (c) => c.orden
              },
              {
                header: 'Clave',
                render: (c) => c.clave,
                getSortValue: (c) => c.clave.toLowerCase()
              },
              {
                header: 'Título',
                render: (c) => c.titulo,
                getSortValue: (c) => c.titulo.toLowerCase()
              },
              {
                header: 'Aplica a',
                render: (c) =>
                  !c.aplicaA || c.aplicaA.length === 0
                    ? 'Todos'
                    : c.aplicaA.join(', '),
                getSortValue: (c) =>
                  (!c.aplicaA || c.aplicaA.length === 0
                    ? 'Todos'
                    : c.aplicaA.join(', ')).toLowerCase()
              },
              {
                header: 'Activa',
                render: (c) => (c.activa ? 'Sí' : 'No'),
                getSortValue: (c) => (c.activa ? 1 : 0)
              },
              {
                header : 'Dimension',
                render : (c) => (c.dimensionGeneral),
                getSortValue : (c) => c.dimensionGeneral?.toLowerCase() ?? ""
              },
              {
                header : 'Grupo Dimension',
                render : (c) => (c.grupo),
                getSortValue : (c) => c.grupo?.toLowerCase() ?? ""
              },
              {
                header: 'Acciones',
                render: (c) => (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setCompetenciaEditando(c)}
                      style={{
                        padding: '6px 12px',
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActiva(c)}
                    >
                      {c.activa ? 'Desactivar' : 'Activar'}
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
              `${c.clave} ${c.titulo} ${c.descripcion || ''} ${(c.aplicaA || []).join(' ')}`
            }
            initialPageSize={10}
            searchable={false}
          />
        </section>

        {/* Modal: Copiar link */}
        {mostrarModalLink && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setMostrarModalLink(false)}
          >
            <div
              style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                width: '90%',
                maxWidth: '480px',
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: '12px', color: '#111827' }}>Enlace de evaluación</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  readOnly
                  value={linkCopiar}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: '#ffffff',
                    color: '#111827'
                  }}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(linkCopiar);
                      alert('Enlace copiado al portapapeles');
                    } catch {
                      alert('Copia no soportada, seleccione el texto y cópielo manualmente.');
                    }
                  }}
                  style={{
                    background: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
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
                  padding: '6px 12px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Modal: Editar competencia */}
        {competenciaEditando && (
          <ModalEditarCompetencia
            competencia={competenciaEditando}
            onClose={() => setCompetenciaEditando(null)}
            onSave={handleEditarCompetencia}
          />
        )}
      </div>
    </div>
  );
}