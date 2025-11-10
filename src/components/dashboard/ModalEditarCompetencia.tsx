// src/components/dashboard/ModalEditarCompetencia.tsx
import { useState, /*useEffect*/ } from 'react';
import type { Competencia } from '../../types';
import { CARGOS } from '../../types';

interface ModalEditarCompetenciaProps {
  competencia: Competencia;
  onClose: () => void;
  onSave: (id: string, data: {
    clave: string;
    titulo: string;
    descripcion: string;
    aplicaA: string[];
  }) => Promise<void>;
  tieneEvaluaciones?: boolean;
}

export function ModalEditarCompetencia({
  competencia,
  onClose,
  onSave,
  tieneEvaluaciones = false
}: ModalEditarCompetenciaProps) {
  const [clave, setClave] = useState(competencia.clave);
  const [titulo, setTitulo] = useState(competencia.titulo);
  const [descripcion, setDescripcion] = useState(competencia.descripcion);
  const [aplicaA, setAplicaA] = useState<string[]>(competencia.aplicaA || []);
  const [openCargos, setOpenCargos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCargo(cargo: string) {
    setAplicaA(prev => {
      if (prev.includes(cargo)) {
        return prev.filter(c => c !== cargo);
      } else {
        return [...prev, cargo];
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!clave.trim() || !titulo.trim()) {
      setError('La clave y el título son obligatorios');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await onSave(competencia.id, {
        clave: clave.trim(),
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        aplicaA
      });
      
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al guardar la competencia');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, color: "#111827" }}>✏️ Editar Competencia</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#6b7280"
            }}
          >
            ×
          </button>
        </div>

        {tieneEvaluaciones && (
          <div style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px"
          }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#92400e" }}>
              ⚠️ <strong>Advertencia:</strong> Esta competencia tiene evaluaciones asociadas. 
              Los cambios pueden afectar la consistencia de los datos.
            </p>
          </div>
        )}

        {error && (
          <div style={{
            background: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px"
          }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#991b1b" }}>
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#374151" }}>
              Clave interna *
            </label>
            <input
              type="text"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Ej: Comunicacion_pregunta1"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: "#ffffff",
                color: "#111827"
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#374151" }}>
              Título *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Comunicación / Responsabilidad"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: "#ffffff",
                color: "#111827"
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#374151" }}>
              Descripción (Pregunta)
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Escribe aquí la pregunta a realizar..."
              rows={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: "#ffffff",
                color: "#111827",
                resize: "vertical"
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#374151" }}>
              Aplica a cargos
            </label>
            <div className="multi-select">
              <div
                className="multi-select-trigger"
                onClick={() => setOpenCargos(!openCargos)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ color: "#374151" }}>
                  {aplicaA.length === 0
                    ? "Aplica a: todos los cargos"
                    : `Aplica a: ${aplicaA.join(", ")}`}
                </span>
                <span className="multi-select-arrow">▾</span>
              </div>

              {openCargos && (
                <div className="multi-select-dropdown" style={{
                  marginTop: "4px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  background: "#ffffff",
                  padding: "8px",
                  maxHeight: "200px",
                  overflowY: "auto"
                }}>
                  {CARGOS.map((cargo) => (
                    <label key={cargo} className="multi-select-option" style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 8px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      marginBottom: "4px"
                    }}>
                      <input
                        type="checkbox"
                        checked={aplicaA.includes(cargo)}
                        onChange={() => toggleCargo(cargo)}
                        style={{ marginRight: "8px" }}
                      />
                      <span style={{ color: "#374151" }}>{cargo}</span>
                    </label>
                  ))}

                  <button
                    type="button"
                    className="multi-select-clear"
                    onClick={() => setAplicaA([])}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      marginTop: "8px",
                      background: "#f3f4f6",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: "#374151"
                    }}
                  >
                    Aplicar a todos los cargos
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                fontWeight: "600",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: saving ? "#9ca3af" : "#4f46e5",
                color: "white",
                fontWeight: "600",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              {saving ? "Guardando..." : "💾 Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}