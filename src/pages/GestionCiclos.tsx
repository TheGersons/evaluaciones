// src/pages/GestionCiclos.tsx
import { useState, useEffect } from 'react';
import { DataTable } from '../components/common/DataTable';
import type { CicloEvaluacion, NuevoCiclo, CicloStats } from '../types';
import { ESTADOS_CICLO } from '../types';
import {
  apiFetchCiclos,
  apiCreateCiclo,
  apiUpdateCiclo,
  apiDeleteCiclo,
  apiClonarCiclo,
  apiFetchStatsPorCiclo
} from '../services/api';
import { navigate } from '../App';

export default function GestionCiclos() {
  const [ciclos, setCiclos] = useState<CicloEvaluacion[]>([]);
  const [stats, setStats] = useState<CicloStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  //const [cicloSeleccionado, setCicloSeleccionado] = useState<string | null>(null);

  const [nuevoCiclo, setNuevoCiclo] = useState<NuevoCiclo>({
    nombre: '',
    descripcion: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    estado: 'borrador'
  });

  useEffect(() => {
    cargarCiclos();
  }, []);

  async function cargarCiclos() {
    try {
      setLoading(true);
      setError(null);

      const [ciclosRes, statsRes] = await Promise.all([
        apiFetchCiclos(),
        apiFetchStatsPorCiclo()
      ]);

      setCiclos(
        ciclosRes.map(c => ({
          id: String(c.id),
          nombre: c.nombre,
          descripcion: c.descripcion,
          fecha_inicio: c.fecha_inicio,
          fecha_fin: c.fecha_fin,
          estado: c.estado,
          fecha_creacion: c.fecha_creacion,
          fecha_actualizacion: c.fecha_actualizacion
        }))
      );

      setStats(statsRes);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Error cargando ciclos');
    } finally {
      setLoading(false);
    }
  }

  async function handleCrearCiclo(e: React.FormEvent) {
    e.preventDefault();

    if (!nuevoCiclo.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    try {
      await apiCreateCiclo({
        nombre: nuevoCiclo.nombre.trim(),
        descripcion: nuevoCiclo.descripcion?.trim(),
        fecha_inicio: nuevoCiclo.fecha_inicio,
        fecha_fin: nuevoCiclo.fecha_fin,
        estado: nuevoCiclo.estado
      });

      setNuevoCiclo({
        nombre: '',
        descripcion: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        estado: 'borrador'
      });
      setMostrarFormulario(false);
      await cargarCiclos();
    } catch (e: any) {
      console.error(e);
      alert('Error creando ciclo: ' + e.message);
    }
  }

  async function handleCambiarEstado(id: string, nuevoEstado: string) {
    try {
      await apiUpdateCiclo(Number(id), { estado: nuevoEstado as any });
      await cargarCiclos();
    } catch (e: any) {
      console.error(e);
      alert('Error cambiando estado: ' + e.message);
    }
  }

  async function handleClonarCiclo(id: string) {
    const ciclo = ciclos.find(c => c.id === id);
    if (!ciclo) return;

    const nuevoNombre = prompt('Nombre del nuevo ciclo:', `${ciclo.nombre} (Copia)`);
    if (!nuevoNombre) return;

    try {
      await apiClonarCiclo(Number(id), nuevoNombre.trim());
      alert('✅ Ciclo clonado exitosamente');
      await cargarCiclos();
    } catch (e: any) {
      console.error(e);
      alert('Error clonando ciclo: ' + e.message);
    }
  }

  async function handleEliminarCiclo(id: string) {
    const ciclo = ciclos.find(c => c.id === id);
    if (!ciclo) return;

    const stat = stats.find(s => s.ciclo_id === Number(id));
    if (stat && stat.total_evaluaciones > 0) {
      alert('No se puede eliminar un ciclo con evaluaciones completadas. Cambia el estado a "finalizada" en su lugar.');
      return;
    }

    if (!confirm(`¿Eliminar el ciclo "${ciclo.nombre}"?`)) return;

    try {
      await apiDeleteCiclo(Number(id));
      await cargarCiclos();
    } catch (e: any) {
      console.error(e);
      alert('Error eliminando ciclo: ' + e.message);
    }
  }

  function handleSeleccionarCiclo(id: string, nombre: string) {
    localStorage.setItem('ciclo_activo_id', id);
    // Usar el nombre como ruta, reemplazando espacios por guiones
    const nombreRuta = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    navigate(`/${nombreRuta}`);
  }

  if (loading) {
    return (
      <div className="root">
        <div className="app">
          <div className="panel">
            <p>Cargando ciclos...</p>
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
              <h1>🔄 Gestión de Evaluaciones</h1>
              <p>Crea y administra múltiples ciclos de evaluación 360°</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setMostrarFormulario(!mostrarFormulario)}
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
                {mostrarFormulario ? '✖ Cancelar' : '➕ Nueva Evaluación'}
              </button>
            </div>
          </div>
        </header>

        {/* Formulario de nuevo ciclo */}
        {mostrarFormulario && (
          <section className="panel" style={{ background: '#f9fafb' }}>
            <h2>📝 Crear Nueva Evaluación</h2>
            <form className="form-row" onSubmit={handleCrearCiclo} style={{ flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Evaluación Q1 2025"
                    value={nuevoCiclo.nombre}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, nombre: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    value={nuevoCiclo.fecha_inicio}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, fecha_inicio: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                    Fecha Fin (opcional)
                  </label>
                  <input
                    type="date"
                    value={nuevoCiclo.fecha_fin || ''}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, fecha_fin: e.target.value || undefined })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                    Estado Inicial
                  </label>
                  <select
                    value={nuevoCiclo.estado}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, estado: e.target.value as any })}
                    style={{ width: '100%' }}
                  >
                    <option value="borrador">Borrador</option>
                    <option value="activa">Activa</option>
                    <option value="pausada">Pausada</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                  Descripción (opcional)
                </label>
                <textarea
                  placeholder="Describe el propósito de esta evaluación..."
                  value={nuevoCiclo.descripcion}
                  onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, descripcion: e.target.value })}
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>

              <button type="submit" style={{ alignSelf: 'flex-start' }}>
                ✅ Crear Evaluación
              </button>
            </form>
          </section>
        )}

        {/* Tarjetas de resumen */}
        <section className="grid">
          <div className="card">
            <h3>Total Evaluaciones</h3>
            <p className="big-number">{ciclos.length}</p>
          </div>
          <div className="card">
            <h3>Activas</h3>
            <p className="big-number">{ciclos.filter(c => c.estado === 'activa').length}</p>
          </div>
          <div className="card">
            <h3>Finalizadas</h3>
            <p className="big-number">{ciclos.filter(c => c.estado === 'finalizada').length}</p>
          </div>
        </section>

        {/* Tabla de ciclos */}
        <section className="panel">
          <h2>📋 Evaluaciones Disponibles</h2>
          <p className="sub">Haz clic en "Abrir" para trabajar con una evaluación específica</p>

          <DataTable
            rows={ciclos}
            columns={[
              {
                header: 'Nombre',
                render: (c) => (
                  <div>
                    <strong>{c.nombre}</strong>
                    {c.descripcion && (
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {c.descripcion}
                      </div>
                    )}
                  </div>
                ),
                getSortValue: (c) => c.nombre.toLowerCase()
              },
              {
                header: 'Estado',
                render: (c) => {
                  const colores = {
                    activa: '#10b981',
                    pausada: '#f59e0b',
                    finalizada: '#6b7280',
                    borrador: '#6366f1'
                  };
                  return (
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: `${colores[c.estado]}20`,
                      color: colores[c.estado]
                    }}>
                      {ESTADOS_CICLO[c.estado]}
                    </span>
                  );
                },
                getSortValue: (c) => c.estado
              },
              {
                header: 'Fechas',
                render: (c) => (
                  <div style={{ fontSize: '13px' }}>
                    <div>Inicio: {new Date(c.fecha_inicio).toLocaleDateString()}</div>
                    {c.fecha_fin && (
                      <div>Fin: {new Date(c.fecha_fin).toLocaleDateString()}</div>
                    )}
                  </div>
                )
              },
              {
                header: 'Estadísticas',
                render: (c) => {
                  const stat = stats.find(s => s.ciclo_id === Number(c.id));
                  if (!stat) return '—';
                  return (
                    <div style={{ fontSize: '12px' }}>
                      <div>👥 {stat.total_evaluadores} evaluadores</div>
                      <div>✅ {stat.total_evaluaciones} completadas</div>
                    </div>
                  );
                }
              },
              {
                header: 'Acciones',
                render: (c) => (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleSeleccionarCiclo(c.id, c.nombre)}
                      style={{
                        padding: '6px 12px',
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      📂 Abrir
                    </button>
                    
                    {c.estado !== 'finalizada' && (
                      <select
                        value={c.estado}
                        onChange={(e) => handleCambiarEstado(c.id, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      >
                        <option value="borrador">Borrador</option>
                        <option value="activa">Activa</option>
                        <option value="pausada">Pausada</option>
                        <option value="finalizada">Finalizada</option>
                      </select>
                    )}

                    <button
                      onClick={() => handleClonarCiclo(c.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                      title="Clonar evaluación"
                    >
                      📋
                    </button>

                    <button
                      onClick={() => handleEliminarCiclo(c.id)}
                      className="btn-danger"
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                )
              }
            ]}
            searchPlaceholder="Buscar evaluaciones..."
            getSearchText={(c) => `${c.nombre} ${c.descripcion || ''} ${c.estado}`}
            initialPageSize={10}
          />
        </section>
      </div>
    </div>
  );
}