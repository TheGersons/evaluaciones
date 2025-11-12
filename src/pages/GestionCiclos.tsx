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
    const nombreRuta = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    navigate(`/${nombreRuta}`);
  }

  if (loading) {
    return (
      <div className="root">
        <div className="app">
          <div className="panel">
            <p style={{ color: '#374151' }}>Cargando ciclos...</p>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ 
                fontSize: '32px', 
                fontWeight: '700', 
                margin: '0 0 8px 0',
                color: '#111827',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                🔄 Gestión de Evaluaciones
              </h1>
              <p style={{ 
                margin: 0, 
                fontSize: '16px', 
                color: '#6b7280',
                fontWeight: '400'
              }}>
                Crea y administra múltiples ciclos de evaluación 360°
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setMostrarFormulario(!mostrarFormulario)}
                style={{
                  padding: '12px 24px',
                  background: mostrarFormulario ? '#ef4444' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                {mostrarFormulario ? '✖ Cancelar' : '➕ Nueva Evaluación'}
              </button>
            </div>
          </div>
        </header>

        {/* Formulario de nuevo ciclo - MEJORADO */}
        {mostrarFormulario && (
          <section className="panel" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)'
          }}>
            <h2 style={{ 
              color: 'white', 
              fontSize: '24px', 
              fontWeight: '600',
              marginBottom: '20px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              📝 Crear Nueva Evaluación
            </h2>
            
            <form onSubmit={handleCrearCiclo}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '20px',
                marginBottom: '20px'
              }}>
                {/* Campo Nombre */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: 'white',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Evaluación Q1 2025"
                    value={nuevoCiclo.nombre}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, nombre: e.target.value })}
                    required
                    style={{ 
                      width: '90%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.95)',
                      color: '#111827',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'white';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Campo Fecha Inicio */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: 'white',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    value={nuevoCiclo.fecha_inicio}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, fecha_inicio: e.target.value })}
                    required
                    style={{ 
                      width: '90%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.95)',
                      color: '#111827',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'white';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Campo Fecha Fin */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: 'white',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Fecha Fin (opcional)
                  </label>
                  <input
                    type="date"
                    value={nuevoCiclo.fecha_fin || ''}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, fecha_fin: e.target.value || undefined })}
                    style={{ 
                      width: '90%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.95)',
                      color: '#111827',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'white';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Campo Estado Inicial */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: 'white',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Estado Inicial
                  </label>
                  <select
                    value={nuevoCiclo.estado}
                    onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, estado: e.target.value as any })}
                    style={{ 
                      width: '90%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.95)',
                      color: '#111827',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'white';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <option value="borrador">📝 Borrador</option>
                    <option value="activa">✅ Activa</option>
                    <option value="pausada">⏸️ Pausada</option>
                  </select>
                </div>
              </div>

              {/* Campo Descripción */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: 'white',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  Descripción (opcional)
                </label>
                <textarea
                  placeholder="Describe el propósito de esta evaluación..."
                  value={nuevoCiclo.descripcion}
                  onChange={(e) => setNuevoCiclo({ ...nuevoCiclo, descripcion: e.target.value })}
                  rows={3}
                  style={{ 
                    width: '90%',
                    padding: '12px 16px',
                    fontSize: '15px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.95)',
                    color: '#111827',
                    fontWeight: '400',
                    resize: 'vertical',
                    transition: 'all 0.2s ease',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    lineHeight: '1.6'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'white';
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Botón Submit */}
              <button 
                type="submit" 
                style={{ 
                  padding: '14px 32px',
                  background: 'white',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
              >
                ✅ Crear Evaluación
              </button>
            </form>
          </section>
        )}

        {/* Tarjetas de resumen */}
        <section className="grid">
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none'
          }}>
            <h3 style={{ color: 'white', fontSize: '14px', fontWeight: '600', opacity: 0.9 }}>Total Evaluaciones</h3>
            <p className="big-number" style={{ color: 'white' }}>{ciclos.length}</p>
          </div>
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none'
          }}>
            <h3 style={{ color: 'white', fontSize: '14px', fontWeight: '600', opacity: 0.9 }}>Activas</h3>
            <p className="big-number" style={{ color: 'white' }}>{ciclos.filter(c => c.estado === 'activa').length}</p>
          </div>
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
            color: 'white',
            border: 'none'
          }}>
            <h3 style={{ color: 'white', fontSize: '14px', fontWeight: '600', opacity: 0.9 }}>Finalizadas</h3>
            <p className="big-number" style={{ color: 'white' }}>{ciclos.filter(c => c.estado === 'finalizada').length}</p>
          </div>
        </section>

        {/* Tabla de ciclos */}
        <section className="panel">
          <h2 style={{ 
            color: '#111827',
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            📋 Evaluaciones Disponibles
          </h2>
          <p className="sub" style={{ color: '#6b7280', marginBottom: '20px' }}>
            Haz clic en "Abrir" para trabajar con una evaluación específica
          </p>

          <DataTable
            rows={ciclos}
            columns={[
              {
                header: 'Nombre',
                render: (c) => (
                  <div>
                    <strong style={{ color: '#111827', fontSize: '15px' }}>{c.nombre}</strong>
                    {c.descripcion && (
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', fontWeight: '400' }}>
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
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: `${colores[c.estado]}20`,
                      color: colores[c.estado],
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
                  <div style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                    <div>📅 {new Date(c.fecha_inicio).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    {c.fecha_fin && (
                      <div style={{ color: '#6b7280' }}>🏁 {new Date(c.fecha_fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    )}
                  </div>
                )
              },
              {
                header: 'Estadísticas',
                render: (c) => {
                  const stat = stats.find(s => s.ciclo_id === Number(c.id));
                  if (!stat) return <span style={{ color: '#9ca3af' }}>—</span>;
                  return (
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                      <div>👥 {stat.total_evaluadores} evaluadores</div>
                      <div style={{ color: '#10b981' }}>✅ {stat.total_evaluaciones} completadas</div>
                    </div>
                  );
                }
              },
              {
                header: 'Acciones',
                render: (c) => (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleSeleccionarCiclo(c.id, c.nombre)}
                      style={{
                        padding: '8px 16px',
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#4338ca';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#4f46e5';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      📂 Abrir
                    </button>
                    
                    {c.estado !== 'finalizada' && (
                      <select
                        value={c.estado}
                        onChange={(e) => handleCambiarEstado(c.id, e.target.value)}
                        style={{
                          padding: '8px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          background: 'white',
                          color: '#374151',
                          transition: 'all 0.2s ease',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#4f46e5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                      >
                        <option value="borrador">📝 Borrador</option>
                        <option value="activa">✅ Activa</option>
                        <option value="pausada">⏸️ Pausada</option>
                        <option value="finalizada">🏁 Finalizada</option>
                      </select>
                    )}

                    <button
                      onClick={() => handleClonarCiclo(c.id)}
                      style={{
                        padding: '8px 12px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      title="Clonar evaluación"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#059669';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#10b981';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      📋
                    </button>

                    <button
                      onClick={() => handleEliminarCiclo(c.id)}
                      style={{
                        padding: '8px 12px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#dc2626';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ef4444';
                        e.currentTarget.style.transform = 'scale(1)';
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