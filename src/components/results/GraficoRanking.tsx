// src/components/results/GraficoRanking.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { ResultadoEvaluado } from '../../types/resultados.types';
import { COLORS } from '../../utils/resultados/coloresYConstantes';
import { transformToRankingData } from '../../utils/resultados/dataTransformers';
import { exportSectionAsPng, exportSectionAsPdf } from '../../utils/resultados/exportUtils';

interface Props {
    resultados: ResultadoEvaluado[];
}

export default function GraficoRanking({ resultados }: Props) {
    const dataRanking = transformToRankingData(resultados);

    return (
        <section className="panel">
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                }}
            >
                <h2 style={{ margin: 0 }}>🏅 Ranking general</h2>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => exportSectionAsPng('ranking-container', 'ranking-general.png')}
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
                        onClick={() => exportSectionAsPdf('ranking-container', 'ranking-general.pdf')}
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
                </div>
            </div>

            <div id="ranking-container">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dataRanking}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nombre" />
                        <YAxis domain={[0, 5]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="promedio" radius={[8, 8, 0, 0]}>
                            {dataRanking.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}