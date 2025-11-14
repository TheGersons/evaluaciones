// src/components/results/DetalleEvaluado/AnalisisPorCargo.tsx
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ResultadoEvaluado, ModoMetricas } from '../../../types/resultados.types';
import { PASTEL_COLORS } from '../../../utils/resultados/coloresYConstantes';
import { 
    transformToDimensionCargoData, 
    transformToGrupoCargoData 
} from '../../../utils/resultados/dataTransformers';
import { exportSectionAsPng, exportSectionAsPdf, sanitizeFileName } from '../../../utils/resultados/exportUtils';
import ModalGraficoPersonalizado from '../ModalGraficoPersonalizado';

interface Props {
    resultado: ResultadoEvaluado;
    escalaMaxLikert?: number;
}

export default function AnalisisPorCargo({ resultado, escalaMaxLikert }: Props) {
    const [modoMetricas, setModoMetricas] = useState<ModoMetricas>('promedio');
    const [graficosExpandido, setGraficosExpandido] = useState(false);
    const [openModalGraficoPersonalizado, setOpenModalGraficoPersonalizado] = useState(false);

    const cargosOrdenados = Object.keys(resultado.promediosPorCargo);
    const dimensionesGrafico = Object.keys(resultado.sumasPorDimensionYCargo);

    const dataDimCargo = transformToDimensionCargoData(
        resultado,
        cargosOrdenados,
        dimensionesGrafico,
        modoMetricas
    );

    const nombreArchivo = sanitizeFileName(resultado.evaluado.nombre);

    return (
        <>
            <section className="panel">
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                        gap: 8,
                        flexWrap: 'wrap',
                    }}
                >
                    <h2>📈 Análisis por cargo</h2>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setGraficosExpandido((v) => !v)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: '1px solid #d1d5db',
                                background: graficosExpandido ? '#e5e7eb' : '#6366f1',
                                color: graficosExpandido ? '#111827' : '#ffffff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {graficosExpandido ? 'Ocultar gráficos' : 'Expandir gráficos'}
                        </button>

                        {graficosExpandido && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setModoMetricas((m) => (m === 'promedio' ? 'suma' : 'promedio'))}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 6,
                                    }}
                                >
                                    {modoMetricas === 'promedio' ? 'Ver sumas' : 'Ver promedios'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpenModalGraficoPersonalizado(true)}
                                    style={{
                                        padding: "6px 12px",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        background: "#10b981",
                                        color: "white",
                                        border: "none",
                                        borderRadius: 6,
                                    }}
                                >
                                    Gráfico personalizado
                                </button>
                                <button
                                    type="button"
                                    onClick={() => exportSectionAsPng('charts-container', `analisis_por_cargo_${nombreArchivo}.png`)}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 6,
                                    }}
                                >
                                    Exportar PNG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => exportSectionAsPdf('charts-container', `analisis_por_cargo_${nombreArchivo}.pdf`)}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 6,
                                    }}
                                >
                                    Exportar PDF
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {graficosExpandido && (
                    <div id="charts-container">
                        {/* Gráfico: Dimensiones vs Cargos */}
                        {dimensionesGrafico.length > 0 && cargosOrdenados.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ marginBottom: 8 }}>Puntuación por dimensión y cargo</h3>
                                <div style={{ width: '100%', height: 320 }}>
                                    <ResponsiveContainer>
                                        <BarChart
                                            data={dataDimCargo}
                                            margin={{ top: 16, right: 24, left: 0, bottom: 40 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="cargo"
                                                angle={-20}
                                                textAnchor="end"
                                                interval={0}
                                                height={60}
                                            />
                                            <YAxis
                                                domain={
                                                    modoMetricas === 'promedio' && escalaMaxLikert
                                                        ? [0, escalaMaxLikert]
                                                        : [0, 'auto']
                                                }
                                            />
                                            <Tooltip />
                                            <Legend />
                                            {dimensionesGrafico.map((dim, idx) => (
                                                <Bar
                                                    key={dim}
                                                    dataKey={dim}
                                                    fill={PASTEL_COLORS[idx % PASTEL_COLORS.length]}
                                                />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Un gráfico por dimensión con sus grupos */}
                        {Object.entries(resultado.sumasPorGrupoYCargo).map(([dimension, gruposPorCargo]) => {
                            const { data: dataGrupo, grupos } = transformToGrupoCargoData(
                                dimension,
                                gruposPorCargo,
                                resultado.countsPorGrupoYCargo,
                                cargosOrdenados,
                                modoMetricas
                            );

                            if (grupos.length === 0) return null;

                            return (
                                <div key={dimension} style={{ marginBottom: 24 }}>
                                    <h3 style={{ marginBottom: 8 }}>
                                        {dimension} — detalle por grupos
                                    </h3>
                                    <div style={{ width: '100%', height: 320 }}>
                                        <ResponsiveContainer>
                                            <BarChart
                                                data={dataGrupo}
                                                margin={{ top: 16, right: 24, left: 0, bottom: 40 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="cargo"
                                                    angle={-20}
                                                    textAnchor="end"
                                                    interval={0}
                                                    height={60}
                                                />
                                                <YAxis
                                                    domain={
                                                        modoMetricas === 'promedio' && escalaMaxLikert
                                                            ? [0, escalaMaxLikert]
                                                            : [0, 'auto']
                                                    }
                                                />
                                                <Tooltip />
                                                <Legend />
                                                {grupos.map((grupo, idx) => (
                                                    <Bar
                                                        key={grupo}
                                                        dataKey={grupo}
                                                        fill={PASTEL_COLORS[idx % PASTEL_COLORS.length]}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <ModalGraficoPersonalizado
                open={openModalGraficoPersonalizado}
                onClose={() => setOpenModalGraficoPersonalizado(false)}
                escalaMax={escalaMaxLikert}
                gruposDisponibles={Object.keys(resultado.promediosPorGrupo)}
                promediosPorGrupo={resultado.promediosPorGrupo}
            />
        </>
    );
}