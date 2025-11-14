// src/components/dashboard/ModalEditarCompetencia.tsx
import { useMemo, useState } from "react";
import type { Competencia } from "../../types";
import { CARGOS } from "../../types";

interface ModalEditarCompetenciaProps {
  competencia: Competencia;
  dimGrupos: Record<string, string[]>;
  onClose: () => void;
  onSave: (id: string, data: {
    clave: string;
    titulo: string;
    descripcion: string;
    aplicaA: string[];
    dimension: string;
    grupo: string;
  }) => Promise<void>;
  tieneEvaluaciones?: boolean;
}

export default function ModalEditarCompetencia({
  competencia,
  dimGrupos,
  onClose,
  onSave,
  tieneEvaluaciones = false,
}: ModalEditarCompetenciaProps) {
  // estado inicial: usamos tal cual lo que viene de BD
  const [datos, setDatos] = useState({
    clave: competencia.clave,
    titulo: competencia.titulo,
    descripcion: competencia.descripcion,
    aplicaA: competencia.aplicaA || [],
    dimension: competencia.dimensionGeneral || "",
    grupo: competencia.grupo || "",
  });
  const [saving, setSaving] = useState(false);
  const [openCargos, setOpenCargos] = useState(false);

  // dimensiones disponibles (keys del map)
  const dimensiones = useMemo(
    () => Object.keys(dimGrupos ?? {}).sort(),
    [dimGrupos]
  );

  // grupos de la dimensión seleccionada
  const gruposParaSelect = useMemo(
    () =>
      datos.dimension
        ? [...(dimGrupos[datos.dimension] ?? [])].sort()
        : [],
    [datos.dimension, dimGrupos]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(competencia.id, {
        clave: datos.clave.trim(),
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        aplicaA: datos.aplicaA,
        dimension: datos.dimension,
        grupo: datos.grupo,
      });
      onClose();
    } catch (error) {
      console.error("Error al guardar la competencia:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleCargo = (cargo: string) => {
    setDatos((prev) => {
      const seleccionados = prev.aplicaA || [];
      if (seleccionados.includes(cargo)) {
        return {
          ...prev,
          aplicaA: seleccionados.filter((c) => c !== cargo),
        };
      } else {
        return {
          ...prev,
          aplicaA: [...seleccionados, cargo],
        };
      }
    });
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setDatos((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDimensionChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const nuevaDimension = e.target.value;
    const gruposDeDim = dimGrupos[nuevaDimension] ?? [];

    setDatos((prev) => ({
      ...prev,
      dimension: nuevaDimension,
      grupo: gruposDeDim.includes(prev.grupo) ? prev.grupo : "",
    }));
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "12px",
          maxWidth: "450px",
          width: "100%",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
          maxHeight: "80vh",
          overflowY: "auto",
          fontFamily: "Inter, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "60%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "5px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#1f2937",
            }}
          >
            Editar Competencia
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSave}>
          {/* Clave interna */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              Clave interna *
            </label>
            <input
              type="text"
              name="clave"
              value={datos.clave}
              onChange={handleChange}
              placeholder="Ej: Comunicacion_pregunta1"
              required
              disabled={saving || tieneEvaluaciones}
              style={{
                width: "90%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: tieneEvaluaciones ? "#f3f4f6" : "#ffffff",
                color: "#111827",
                cursor: tieneEvaluaciones ? "not-allowed" : "text",
              }}
            />
            {tieneEvaluaciones && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#ef4444",
                  marginTop: "4px",
                }}
              >
                La clave no puede modificarse si ya tiene evaluaciones
                asociadas.
              </p>
            )}
          </div>

          {/* Título */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              Título *
            </label>
            <input
              type="text"
              name="titulo"
              value={datos.titulo}
              onChange={handleChange}
              placeholder="Ej: Comunicación / Responsabilidad"
              required
              disabled={saving}
              style={{
                width: "90%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: "#ffffff",
                color: "#111827",
              }}
            />
          </div>

          {/* Dimensión General (ahora dinámica desde BD) */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              Dimensión General *
            </label>
            <select
              name="dimension"
              value={datos.dimension}
              onChange={handleDimensionChange}
              disabled={saving}
              required
              style={{
                width: "96%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: "#ffffff",
                color: "#111827",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <option value="">Selecciona una dimensión</option>
              {dimensiones.map((dim) => (
                <option key={dim} value={dim}>
                  {dim}
                </option>
              ))}
            </select>
          </div>

          {/* Grupo dependiente de dimensión */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              Grupo *
            </label>
            <select
              name="grupo"
              value={datos.grupo}
              onChange={handleChange}
              disabled={saving || !datos.dimension}
              required
              style={{
                width: "96%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: !datos.dimension ? "#f3f4f6" : "#ffffff",
                color: "#111827",
                cursor:
                  saving || !datos.dimension ? "not-allowed" : "pointer",
              }}
            >
              <option value="">Selecciona un grupo</option>
              {gruposParaSelect.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {!datos.dimension && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#ef4444",
                  marginTop: "4px",
                }}
              >
                Selecciona una dimensión válida para ver los grupos.
              </p>
            )}
          </div>

          {/* Descripción / pregunta */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              Descripción (Pregunta)
            </label>
            <textarea
              name="descripcion"
              value={datos.descripcion}
              onChange={handleChange}
              placeholder="Escribe aquí la pregunta a realizar."
              rows={3}
              disabled={saving}
              style={{
                width: "90%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: "#ffffff",
                color: "#111827",
                resize: "vertical",
              }}
            />
          </div>

          {/* Aplica a cargos (multi-select) */}
          <div style={{ marginBottom: "20px", position: "relative" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              Aplica a cargos
            </label>
            <div className="multi-select">
              <div
                className="multi-select-trigger"
                onClick={() => !saving && setOpenCargos((o) => !o)}
                style={{
                  width: "90%",  
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: saving ? "#f3f4f6" : "#ffffff",
                  cursor: saving ? "not-allowed" : "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <span style={{ color: "#374151" }}>
                  {datos.aplicaA.length === 0
                    ? "Aplica a: todos los cargos"
                    : `Aplica a: ${datos.aplicaA.join(", ")}`}
                </span>
                <span className="multi-select-arrow">▾</span>
              </div>

              {openCargos && !saving && (
                <div
                  className="multi-select-dropdown"
                  style={{
                    marginTop: "4px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    background: "#ffffff",
                    padding: "8px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    position: "absolute",
                    width: "93%",
                    zIndex: 10,
                  }}
                >
                  {CARGOS.map((cargo) => (
                    <label
                      key={cargo}
                      className="multi-select-option"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "6px 8px",
                        cursor: "pointer",
                        borderRadius: "4px",
                        marginBottom: "4px",
                        userSelect: "none",
                        backgroundColor: datos.aplicaA.includes(cargo)
                          ? "#f3f4f6"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={datos.aplicaA.includes(cargo)}
                        onChange={() => toggleCargo(cargo)}
                        style={{ marginRight: "8px" }}
                      />
                      <span style={{ color: "#374151" }}>{cargo}</span>
                    </label>
                  ))}

                  <button
                    type="button"
                    className="multi-select-clear"
                    onClick={() =>
                      setDatos((prev) => ({ ...prev, aplicaA: [] }))
                    }
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      marginTop: "8px",
                      background: "#e5e7eb",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: "#4b5563",
                    }}
                  >
                    Aplicar a todos los cargos
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              paddingTop: "20px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
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
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "14px",
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
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "14px",
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
