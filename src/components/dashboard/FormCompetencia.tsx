// src/components/dashboard/FormCompetencia.tsx
import { useMemo, useState } from 'react';
import type { NuevaCompetencia } from '../../types';
import { CARGOS } from '../../types';

interface FormCompetenciaProps {
  onSubmit: (data: NuevaCompetencia) => Promise<void>;
  totalCompetencias: number;
  dimGrupos: Record<string, string[]>;
  onOpenGestionDG: () => void;
}

export function FormCompetencia({
  onSubmit,
  dimGrupos,
  onOpenGestionDG
}: FormCompetenciaProps) {

  const [datos, setDatos] = useState<NuevaCompetencia>({
    clave: '',
    titulo: '',
    descripcion: '',
    aplicaA: [],
    tipo: 'likert',
    dimensionGeneral: '',
    grupo: ''
  });

  const [openCargos, setOpenCargos] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dimensiones = useMemo(() => Object.keys(dimGrupos ?? {}).sort(), [dimGrupos]);

  const gruposParaSelect = useMemo(
    () => (datos.dimensionGeneral ? [...(dimGrupos[datos.dimensionGeneral] ?? [])].sort() : []),
    [datos.dimensionGeneral, dimGrupos]
  );

  function toggleCargoAplica(cargo: string) {
    setDatos((prev) => {
      const seleccionados = prev.aplicaA || [];
      if (seleccionados.includes(cargo)) {
        return { ...prev, aplicaA: seleccionados.filter((c) => c !== cargo) };
      } else {
        return { ...prev, aplicaA: [...seleccionados, cargo] };
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!datos.clave.trim() || !datos.titulo.trim()) {
      alert('La clave y el título son obligatorios');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        clave: datos.clave.trim(),
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        aplicaA: datos.aplicaA,
        tipo: datos.tipo,
        dimensionGeneral: datos.dimensionGeneral || "",
        grupo: datos.grupo || ""
      });

      setDatos({
        clave: '',
        titulo: '',
        descripcion: '',
        aplicaA: [],
        tipo: 'likert',
        dimensionGeneral: '',
        grupo: ''
      });
      setOpenCargos(false);
    } catch (e: any) {
      console.error(e);
      alert('Error agregando competencia: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ 
      background: '#f9fafb', 
      padding: '20px', 
      borderRadius: '12px', 
      marginBottom: '20px',
      border: '1px solid #e5e7eb'
    }}>
      {/* Header con botón de gestión */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <h3 style={{ margin: 0, color: '#111827', fontSize: '16px', fontWeight: '600' }}>
          ➕ Agregar Nueva Competencia
        </h3>
        <button
          type="button"
          onClick={onOpenGestionDG}
          disabled={submitting}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #6366f1',
            background: 'white',
            color: '#6366f1',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '13px',
            transition: 'all 0.2s',
            opacity: submitting ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!submitting) {
              e.currentTarget.style.background = '#6366f1';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = '#6366f1';
          }}
        >
          ⚙️ Editar Dimensiones y Grupos
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Grid de campos principales */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '13px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Clave interna *
            </label>
            <input
              type="text"
              placeholder="ej: Comunicacion_pregunta1"
              value={datos.clave}
              onChange={(e) => setDatos({ ...datos, clave: e.target.value })}
              disabled={submitting}
              style={{ 
                width: '90%',
                height: '30px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '13px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Título *
            </label>
            <input
              type="text"
              placeholder="ej: Comunicación / Responsabilidad"
              value={datos.titulo}
              onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
              disabled={submitting}
              style={{ 
                width: '90%',
                height: '30px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '13px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Tipo de pregunta
            </label>
            <select
              value={datos.tipo}
              onChange={(e) => setDatos({ ...datos, tipo: e.target.value })}
              disabled={submitting}
              style={{ 
                width: '90%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="likert">Escala 1 a 5</option>
              <option value="texto">Pregunta abierta</option>
            </select>
          </div>
        </div>
        {/* Pregunta/Descripción - campo más ancho */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '6px', 
            fontSize: '13px', 
            fontWeight: '600',
            color: '#374151'
          }}>
            Pregunta a realizar *
          </label>
          <input
            type="text"
            placeholder="Escribe aquí la pregunta completa..."
            value={datos.descripcion}
            onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
            disabled={submitting}
            style={{ 
              width: '90%',
              height: '40px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Grid de Dimensión y Grupo */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '13px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Dimensión general
            </label>
            <select
              value={datos.dimensionGeneral}
              onChange={(e) => setDatos({
                ...datos,
                dimensionGeneral: e.target.value,
                grupo: ''
              })}
              disabled={submitting}
              style={{ 
                width: '100%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="">— Selecciona una dimensión —</option>
              {dimensiones.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '13px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Grupo
            </label>
            <select
              value={datos.grupo}
              onChange={(e) => setDatos({ ...datos, grupo: e.target.value })}
              disabled={submitting || !datos.dimensionGeneral || gruposParaSelect.length === 0}
              style={{ 
                width: '100%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                background: 'white',
                opacity: (!datos.dimensionGeneral || gruposParaSelect.length === 0) ? 0.6 : 1
              }}
            >
              <option value="">— Selecciona un grupo —</option>
              {gruposParaSelect.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Multiselect de Cargos */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '6px', 
            fontSize: '13px', 
            fontWeight: '600',
            color: '#374151'
          }}>
            Aplica a cargos
          </label>
          <div className="multi-select">
            <div
              className="multi-select-trigger"
              onClick={() => !submitting && setOpenCargos((o) => !o)}
              style={{ 
                cursor: submitting ? 'not-allowed' : 'pointer', 
                opacity: submitting ? 0.6 : 1,
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: 'white',
                fontSize: '14px'
              }}
            >
              <span style={{ color: datos.aplicaA.length === 0 ? '#9ca3af' : '#111827' }}>
                {datos.aplicaA.length === 0
                  ? 'Todos los cargos'
                  : datos.aplicaA.join(', ')}
              </span>
              <span className="multi-select-arrow">▾</span>
            </div>

            {openCargos && !submitting && (
              <div className="multi-select-dropdown">
                {CARGOS.map((cargo) => (
                  <label key={cargo} className="multi-select-option">
                    <input
                      type="checkbox"
                      checked={datos.aplicaA.includes(cargo)}
                      onChange={() => toggleCargoAplica(cargo)}
                    />
                    <span>{cargo}</span>
                  </label>
                ))}

                <button
                  type="button"
                  className="multi-select-clear"
                  onClick={() => setDatos((prev) => ({ ...prev, aplicaA: [] }))}
                >
                  Aplicar a todos los cargos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Botón de submit - más pequeño */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="submit" 
            disabled={submitting}
            style={{
              padding: '10px 24px',
              height: '40px',
              borderRadius: '8px',
              border: 'none',
              background: submitting ? '#9ca3af' : '#4f46e5',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = '#4338ca';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = '#4f46e5';
              }
            }}
          >
            {submitting ? '⏳ Agregando...' : '➕ Agregar Pregunta'}
          </button>
        </div>
      </form>
    </div>
  );
}