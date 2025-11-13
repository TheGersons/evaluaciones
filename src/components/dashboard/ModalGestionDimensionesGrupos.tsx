import { useMemo, useState } from "react";
import type { DimRegistro, GrupoRegistro } from "../../types";


export type DimGrupos = Record<string, string[]>;

type Props = {
  open: boolean;
  value: DimGrupos;

  dimensiones: DimRegistro[];
  grupos: GrupoRegistro[];

  onClose: () => void;

  onCreateDimension: (nombre: string) => Promise<void>;
  onRenameDimension: (id: number, nombre: string) => Promise<void>;
  onDeleteDimension: (id: number) => Promise<void>;

  onCreateGrupo: (dimensionId: number, nombre: string) => Promise<void>;
  onRenameGrupo: (id: number, nombre: string) => Promise<void>;
  onDeleteGrupo: (id: number) => Promise<void>;
};



export default function ModalGestionDimensionesGrupos({
  open,
  value,
  dimensiones,
  grupos,
  onClose,
  onCreateDimension,
  onRenameDimension,
  onDeleteDimension,
  onCreateGrupo,
  onRenameGrupo,
  onDeleteGrupo,
}: Props) {

  const [tab, setTab] = useState<"dimensiones" | "grupos">("dimensiones");
  const [dimensionSeleccionada, setDimensionSeleccionada] = useState<string>("");

  // nombres de dimensión (para mostrar), basados en value
  const dimensionNombres = useMemo(
    () => Object.keys(value).sort(),
    [value]
  );

  // grupos solo por nombre para la dimensión seleccionada:
  const gruposDeDimension = useMemo(
    () => (dimensionSeleccionada ? [...(value[dimensionSeleccionada] ?? [])].sort() : []),
    [dimensionSeleccionada, value]
  );


  if (!open) return null;

  async function agregarDimension(nombre: string) {
    const n = nombre.trim();
    if (!n) return;
    if (value[n]) {
      alert("Ya existe una dimensión con ese nombre");
      return;
    }

    await onCreateDimension(n);
    // No tocamos onChange aquí: cargarTodo en Dashboard actualiza value desde BD
  }


  async function renombrarDimension(actual: string, nuevo: string) {
    const n = nuevo.trim();
    if (!n || actual === n) return;
    if (value[n]) {
      alert("Ya existe otra dimensión con ese nombre");
      return;
    }

    const dim = dimensiones.find(d => d.nombre === actual);
    if (!dim) {
      alert("No se encontró la dimensión en BD");
      return;
    }

    await onRenameDimension(dim.id, n);
    // Dashboard recarga dimGrupos; opcionalmente puedes limpiar selección:
    if (dimensionSeleccionada === actual) setDimensionSeleccionada(n);
  }


  async function eliminarDimension(nombre: string) {
    if (!confirm(`Eliminar dimensión "${nombre}" y todos sus grupos`)) return;

    const dim = dimensiones.find(d => d.nombre === nombre);
    if (!dim) {
      alert("No se encontró la dimensión en BD");
      return;
    }

    await onDeleteDimension(dim.id);

    if (dimensionSeleccionada === nombre) setDimensionSeleccionada("");
  }

  async function agregarGrupo(dimensionNombre: string, nombre: string) {
    const n = nombre.trim();
    if (!n) return;

    const lista = new Set(value[dimensionNombre] ?? []);
    if (lista.has(n)) {
      alert("Ese grupo ya existe en la dimensión");
      return;
    }

    const dim = dimensiones.find(d => d.nombre === dimensionNombre);
    if (!dim) {
      alert("No se encontró la dimensión en BD");
      return;
    }

    await onCreateGrupo(dim.id, n);
  }


  async function renombrarGrupo(dimensionNombre: string, actual: string, nuevo: string) {
    const n = nuevo.trim();
    if (!n || actual === n) return;

    const dim = dimensiones.find(d => d.nombre === dimensionNombre);
    if (!dim) {
      alert("No se encontró la dimensión en BD");
      return;
    }

    const grupo = grupos.find(g => g.dimension_id === dim.id && g.nombre === actual);
    if (!grupo) {
      alert("No se encontró el grupo en BD");
      return;
    }

    await onRenameGrupo(grupo.id, n);
  }

  async function eliminarGrupo(dimensionNombre: string, nombre: string) {
    if (!confirm(`Eliminar grupo "${nombre}" de la dimensión "${dimensionNombre}"`)) return;

    const dim = dimensiones.find(d => d.nombre === dimensionNombre);
    if (!dim) {
      alert("No se encontró la dimensión en BD");
      return;
    }

    const grupo = grupos.find(g => g.dimension_id === dim.id && g.nombre === nombre);
    if (!grupo) {
      alert("No se encontró el grupo en BD");
      return;
    }

    await onDeleteGrupo(grupo.id);
  }


  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", width: "min(920px, 92vw)", borderRadius: 12, padding: 16 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Editar dimensiones y grupos</h3>
          <button onClick={onClose} style={{ border: "none", background: "#ef4444", color: "white", borderRadius: 8, padding: "6px 10px" }}>
            Cerrar
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 12 }}>
          <button
            onClick={() => setTab("dimensiones")}
            style={{
              padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb",
              background: tab === "dimensiones" ? "hsl(245, 58%, 51%, 1.00)" : "white", fontWeight: 600,
              color: tab === "dimensiones" ? "white" : "#374151"
            }}
          >
            Dimensiones
          </button>
          <button
            onClick={() => setTab("grupos")}
            style={{
              padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb",
              background: tab === "grupos" ? "hsl(245, 58%, 51%, 1.00)" : "white", fontWeight: 600,
              color: tab === "grupos" ? "white" : "#374151"
            }}
          >
            Grupos
          </button>
        </div>

        {/* TAB DIMENSIONES */}
        {tab === "dimensiones" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="nueva-dimension" placeholder="Nueva dimensión" style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <button
                onClick={() => {
                  const el = document.getElementById("nueva-dimension") as HTMLInputElement | null;
                  if (!el) return;
                  agregarDimension(el.value);
                  el.value = "";
                }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#10b981", color: "white" }}
              >
                Agregar
              </button>
            </div>

            <table className="table">
              <thead>
                <tr><th>Dimensión</th><th style={{ width: 220 }}>Acciones</th></tr>
              </thead>
              <tbody>
                {dimensionNombres.length === 0 ? (
                  <tr><td colSpan={2} style={{ textAlign: "center" }}>Sin dimensiones</td></tr>
                ) : dimensionNombres.map(d => (
                  <tr key={d}>
                    <td>{d}</td>
                    ...

                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            const nuevo = prompt("Nuevo nombre para la dimensión:", d);
                            if (nuevo !== null) renombrarDimension(d, nuevo);
                          }}
                        >Renombrar</button>
                        <button className="btn-danger" onClick={() => eliminarDimension(d)}>Eliminar</button>
                        <button onClick={() => { setTab("grupos"); setDimensionSeleccionada(d); }}>
                          Ver grupos
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB GRUPOS */}
        {tab === "grupos" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: "#374151" }}>
              <span>Dimensión:</span>
              <select
                value={dimensionSeleccionada}
                onChange={e => setDimensionSeleccionada(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", color: "#374151" }}
              >
                <option value="">-- Selecciona --</option>
                {dimensionNombres.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input id="nuevo-grupo" placeholder="Nuevo grupo" disabled={!dimensionSeleccionada}
                style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <button
                disabled={!dimensionSeleccionada}
                onClick={() => {
                  const el = document.getElementById("nuevo-grupo") as HTMLInputElement | null;
                  if (!el || !dimensionSeleccionada) return;
                  agregarGrupo(dimensionSeleccionada, el.value);
                  el.value = "";
                }}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: "none",
                  background: dimensionSeleccionada ? "#10b981" : "#9ca3af", color: "white"
                }}
              >
                Agregar
              </button>
            </div>

            <table className="table">
              <thead>
                <tr><th>Grupo</th><th style={{ width: 220 }}>Acciones</th></tr>
              </thead>
              <tbody>
                {!dimensionSeleccionada ? (
                  <tr><td colSpan={2} style={{ textAlign: "center" }}>Selecciona una dimensión</td></tr>
                ) : gruposDeDimension.length === 0 ? (
                  <tr><td colSpan={2} style={{ textAlign: "center" }}>Sin grupos</td></tr>
                ) : gruposDeDimension.map(g => (
                  <tr key={g}>
                    <td>{g}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            const nuevo = prompt("Nuevo nombre para el grupo:", g);
                            if (nuevo !== null) renombrarGrupo(dimensionSeleccionada, g, nuevo);
                          }}
                        >Renombrar</button>
                        <button className="btn-danger" onClick={() => eliminarGrupo(dimensionSeleccionada, g)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
