// src/components/results/ModalGraficoPersonalizado.tsx
import { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
    ResponsiveContainer,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from "recharts";

const PASTEL_COLORS = [
    "#ef4444", // rojo
    "#3b82f6", // azul
    "#10b981", // verde
    "#f59e0b", // ámbar
    "#8b5cf6", // morado
    "#06b6d4", // turquesa
    "#ec4899", // rosa
    "#f97316", // naranja
];

interface PerfilGrupos {
    id: number;
    nombre: string;
    grupos: string[];
}

interface Props {
    open: boolean;
    onClose: () => void;
    escalaMax?: number;
    gruposDisponibles: string[];
    promediosPorGrupo: Record<string, number>;
}

export default function ModalGraficoPersonalizado({
    open,
    onClose,
    escalaMax,
    gruposDisponibles,
    promediosPorGrupo,
}: Props) {
    const [perfiles, setPerfiles] = useState<PerfilGrupos[]>([]);
    const [nombrePerfil, setNombrePerfil] = useState("");
    const [tituloGrafico, setTituloGrafico] = useState("");
    const [seleccionGrupos, setSeleccionGrupos] = useState<string[]>([]);
    const [mostrarGrafico, setMostrarGrafico] = useState(false);

    const gruposOrdenados = useMemo(
        () =>
            [...gruposDisponibles]
                .filter((g) => g && g.trim() !== "")
                .sort((a, b) => a.localeCompare(b)),
        [gruposDisponibles]
    );

    // Se puede generar gráfico si hay al menos 1 agrupación
    const puedeGenerarGrafico = perfiles.length > 0;

    // Datos del gráfico: cada perfil es un punto (promedio de sus grupos)
    const dataGrafico = useMemo(() => {
        if (!mostrarGrafico || perfiles.length === 0) return [];

        return perfiles.map((p) => {
            const valores = p.grupos
                .map((g) => promediosPorGrupo[g])
                .filter((v) => typeof v === "number" && !Number.isNaN(v));

            const promedio =
                valores.length > 0
                    ? valores.reduce((a, b) => a + b, 0) / valores.length
                    : 0;

            return {
                nombre: p.nombre,
                valor: Number(promedio.toFixed(2)),
                grupos: p.grupos.join(", "),
            };
        });
    }, [perfiles, mostrarGrafico, promediosPorGrupo]);

    const esRadar = dataGrafico.length >= 3;

    if (!open) return null;

    function toggleGrupoSeleccionado(grupo: string) {
        setSeleccionGrupos((prev) =>
            prev.includes(grupo)
                ? prev.filter((g) => g !== grupo)
                : [...prev, grupo]
        );
    }

    function handleCrearPerfil() {
        const nombre = nombrePerfil.trim();
        if (!nombre) {
            alert("Debes asignar un nombre a la agrupación.");
            return;
        }
        if (seleccionGrupos.length === 0) {
            alert("Selecciona al menos un grupo.");
            return;
        }

        if (
            perfiles.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
        ) {
            alert("Ya existe una agrupación con ese nombre.");
            return;
        }

        const nuevo: PerfilGrupos = {
            id: Date.now(),
            nombre,
            grupos: [...seleccionGrupos],
        };

        setNombrePerfil("");

        setPerfiles((prev) => [...prev, nuevo]);
        // limpiar selección de grupos para una nueva agrupación limpia
        setSeleccionGrupos([]);
        // si quieres, puedes limpiar también el nombre de la agrupación:
        // setNombrePerfil("");
        setMostrarGrafico(false);
    }

    function handleGenerarGrafico() {
        if (!puedeGenerarGrafico) return;
        setMostrarGrafico(true);
    }

    async function handleExportCustomPng() {
        const el = document.getElementById("custom-chart-container");
        if (!el) return;

        const canvas = await html2canvas(el, {
            backgroundColor: "#ffffff",
            scale: 2,
            x: 0,
            y: 0,
        });

        const margin = 30;
        const newCanvas = document.createElement("canvas");
        newCanvas.width = canvas.width + margin * 2;
        newCanvas.height = canvas.height + margin * 2;
        const ctx = newCanvas.getContext("2d");

        if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
            ctx.drawImage(canvas, margin, margin);
        }

        const dataUrl = newCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "grafico-personalizado.png";
        link.click();
    }

    async function handleExportCustomPdf() {
        const el = document.getElementById("custom-chart-container");
        if (!el) return;

        const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF("l", "mm", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const margin = 10;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;

        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;
        const ratio = imgHeightPx / imgWidthPx;

        let renderW = maxW;
        let renderH = renderW * ratio;

        if (renderH > maxH) {
            renderH = maxH;
            renderW = renderH / ratio;
        }

        const x = (pageWidth - renderW) / 2;
        const y = (pageHeight - renderH) / 2;

        pdf.addImage(imgData, "PNG", x, y, renderW, renderH, undefined, "FAST");
        pdf.save("grafico-personalizado.pdf");
    }

    function handleCerrar() {
        onClose();
    }

    function handleClearView(){
        setTituloGrafico("");
        setMostrarGrafico(false);
        setNombrePerfil("");

        setPerfiles([]);
        // limpiar selección de grupos para una nueva agrupación limpia
        setSeleccionGrupos([]);
        // si quieres, puedes limpiar también el nombre de la agrupación:
        // setNombrePerfil("");
        setMostrarGrafico(false);

    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(17,24,39,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3000,
                overflowY: "auto", 
            }}
            onClick={handleCerrar}
        >
            <div
                style={{
                    background: "white",
                    width: "min(1120px, 95vw)",
                    maxHeight: "90vh",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    overflowY: "auto",  
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <div>
                        <h3 style={{ margin: 0 }}>Gráfico personalizado por grupos</h3>
                        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                            Define agrupaciones de grupos y genera un gráfico tipo radar
                            (mínimo 3 agrupaciones) o de barras (1 o 2 agrupaciones). El
                            cálculo es por promedio.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleCerrar}
                        style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: "#ef4444",
                            color: "white",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Cerrar
                    </button>
                </div>

                {/* Contenido principal */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.8fr)",
                        gap: 16,
                        alignItems: "stretch",

                        overflowY: "auto",
                        scrollbarWidth: "thin",
                        scrollbarColor: "#cbd5e1 transparent",
                    }}
                >
                    {/* Columna izquierda: definición de agrupaciones */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            borderRight: "1px solid #e5e7eb",
                            paddingRight: 12,
                        }}
                    >
                        <div
                            style={{
                                padding: 12,
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: "#f9fafb",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            <h4 style={{ margin: 0, fontSize: 14 }}>Nueva agrupación</h4>

                            <label style={{ fontSize: 13, color: "#374151" }}>
                                Título del gráfico
                                <input
                                    type="text"
                                    value={tituloGrafico}
                                    onChange={(e) => setTituloGrafico(e.target.value)}
                                    style={{
                                        width: "90%",
                                        marginTop: 4,
                                        padding: "6px 8px",
                                        borderRadius: 8,
                                        border: "1px solid #d1d5db",
                                        fontSize: 13,
                                    }}
                                    placeholder="Ej: Radar de competencias clave"
                                />
                            </label>

                            <label style={{ fontSize: 13, color: "#374151" }}>
                                Nombre de la agrupación
                                <input
                                    type="text"
                                    value={nombrePerfil}
                                    onChange={(e) => setNombrePerfil(e.target.value)}
                                    style={{
                                        width: "90%",
                                        marginTop: 4,
                                        padding: "6px 8px",
                                        borderRadius: 8,
                                        border: "1px solid #d1d5db",
                                        fontSize: 13,
                                    }}
                                    placeholder="Ej: Dominio personal, Perfil comercial..."
                                />
                            </label>

                            <div style={{ fontSize: 13, color: "#374151" }}>
                                Grupos disponibles
                                <div
                                    style={{
                                        marginTop: 4,
                                        maxHeight: 200,
                                        overflowY: "auto",
                                        padding: 6,
                                        borderRadius: 8,
                                        border: "1px solid #e5e7eb",
                                        background: "#ffffff",
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 6,
                                    }}
                                >
                                    {gruposOrdenados.length === 0 && (
                                        <span style={{ fontSize: 12, color: "#9ca3af" }}>
                                            No hay grupos disponibles.
                                        </span>
                                    )}
                                    {gruposOrdenados.map((g) => {
                                        const selected = seleccionGrupos.includes(g);
                                        return (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => toggleGrupoSeleccionado(g)}
                                                style={{
                                                    padding: "4px 8px",
                                                    borderRadius: 999,
                                                    border: "1px solid #d1d5db",
                                                    fontSize: 12,
                                                    cursor: "pointer",
                                                    background: selected ? "#4f46e5" : "white",
                                                    color: selected ? "white" : "#374151",
                                                }}
                                            >
                                                {g}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCrearPerfil}
                                style={{
                                    marginTop: 6,
                                    alignSelf: "flex-start",
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: "#10b981",
                                    color: "white",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Guardar agrupación
                            </button>
                        </div>

                        {/* Lista de agrupaciones guardadas */}
                        <div
                            style={{
                                padding: 12,
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: "#f9fafb",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            <h4 style={{ margin: 0, fontSize: 14 }}>Agrupaciones guardadas</h4>
                            {perfiles.length === 0 ? (
                                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                                    Aún no hay agrupaciones. Crea al menos una para habilitar el
                                    gráfico.
                                </p>
                            ) : (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        maxHeight: 180,
                                        overflowY: "auto",
                                    }}
                                >
                                    {perfiles.map((p) => (
                                        <div
                                            key={p.id}
                                            style={{
                                                padding: "6px 8px",
                                                borderRadius: 8,
                                                border: "1px solid #e5e7eb",
                                                background: "#ffffff",
                                                fontSize: 13,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        color: "#6b7280",
                                                    }}
                                                >
                                                    {p.grupos.length} grupo
                                                    {p.grupos.length !== 1 ? "s" : ""}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    marginTop: 2,
                                                    fontSize: 11,
                                                    color: "#6b7280",
                                                }}
                                            >
                                                {p.grupos.join(", ")}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={!puedeGenerarGrafico}
                                onClick={handleGenerarGrafico}
                                style={{
                                    marginTop: 4,
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: puedeGenerarGrafico ? "#4f46e5" : "#9ca3af",
                                    color: "white",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: puedeGenerarGrafico ? "pointer" : "not-allowed",
                                }}
                            >
                                Generar gráfico
                            </button>

                            <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
                                Reglas: mínimo 3 agrupaciones para gráfico tipo radar. Con 1 o 2
                                agrupaciones se mostrará un gráfico de barras.
                            </p>
                        </div>
                    </div>

                    {/* Columna derecha: vista previa del gráfico */}
                    <div
                        style={{
                            padding: 12,
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            background: "#f9fafb",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        <h4 style={{ margin: 0, fontSize: 14 }}>Vista previa</h4>

                        {!mostrarGrafico ? (
                            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                                Crea una o más agrupaciones y pulsa{" "}
                                <strong>Generar gráfico</strong>.
                            </p>
                        ) : dataGrafico.length === 0 ? (
                            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                                No hay datos para las agrupaciones definidas.
                            </p>
                        ) : (
                            <>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
                                        Agrupaciones:{" "}
                                        <strong>{perfiles.length}</strong> – valores en promedio.
                                    </p>

                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            type="button"
                                            onClick={handleClearView}
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: 6,
                                                border: "none",
                                                //verde
                                                background: "#10b981",
                                                color: "white",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Limpiar vista
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleExportCustomPng}
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: 6,
                                                border: "none",
                                                background: "#3b82f6",
                                                color: "white",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Exportar PNG
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleExportCustomPdf}
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: 6,
                                                border: "none",
                                                background: "#ef4444",
                                                color: "white",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Exportar PDF
                                        </button>
                                    </div>
                                </div>

                                <div
                                    id="custom-chart-container"
                                    style={{ width: "100%", height: 340 }}
                                >
                                    {esRadar ? (
                                        <ResponsiveContainer>
                                            <RadarChart data={dataGrafico}>
                                                <PolarGrid />
                                                <PolarAngleAxis dataKey="nombre" />
                                                <PolarRadiusAxis
                                                    angle={30}
                                                    domain={
                                                        escalaMax && escalaMax > 0
                                                            ? [0, escalaMax]
                                                            : [0, "auto"]
                                                    }
                                                />
                                                <Tooltip />
                                                <Legend />
                                                <Radar
                                                    name={tituloGrafico || "Gráfico personalizado"}
                                                    dataKey="valor"
                                                    stroke="#4f46e5"
                                                    fill="#6366f1"
                                                    fillOpacity={0.5}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <ResponsiveContainer>
                                            <BarChart
                                                data={dataGrafico}
                                                margin={{ top: 16, right: 24, left: 0, bottom: 40 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="nombre"
                                                    angle={-20}
                                                    textAnchor="end"
                                                    interval={0}
                                                    height={60}
                                                />
                                                <YAxis
                                                    domain={
                                                        escalaMax && escalaMax > 0
                                                            ? [0, escalaMax]
                                                            : [0, "auto"]
                                                    }
                                                />
                                                <Tooltip />
                                                <Legend />
                                                <Bar
                                                    dataKey="valor"
                                                    name={tituloGrafico || "Gráfico personalizado"}
                                                    fill={PASTEL_COLORS[1]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
