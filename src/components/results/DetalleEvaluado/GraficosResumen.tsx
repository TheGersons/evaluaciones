// src/components/results/DetalleEvaluado/GraficosResumen.tsx
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ResultadoEvaluado } from '../../../types/resultados.types';
import { transformToRadarDimensionData, transformToRadarGruposData } from '../../../utils/resultados/dataTransformers';

interface Props {
    resultado: ResultadoEvaluado;
}

export default function GraficosResumen({ resultado }: Props) {
    const dataRadarDimensionGeneral = transformToRadarDimensionData(resultado);
    const dataGrupos = transformToRadarGruposData(resultado);

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: '18px', 
            marginBottom: '20px' 
        }}>
            {/* Radar de DIMENSIÓN GENERAL */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                <h3 style={{ marginBottom: '16px', color: 'black' }}>
                    Distribución por Dimensión General
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={dataRadarDimensionGeneral}>
                        <PolarGrid stroke="#d1d5db" />
                        <PolarAngleAxis
                            dataKey="dimension"
                            tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }}
                            tickFormatter={(value, index) => {
                                const dataPoint = dataRadarDimensionGeneral[index];
                                const valorRedondeado = dataPoint.valor.toFixed(2);
                                return `${value} (${valorRedondeado})`;
                            }}
                        />
                        <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#6b7280' }} />
                        <Radar
                            name="Puntaje"
                            dataKey="valor"
                            stroke="#4f46e5"
                            fill="#4f46e5"
                            fillOpacity={0.4}
                            strokeWidth={2}
                        />
                        <Tooltip />
                        <Legend />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Radar de HABILIDADES */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                <h3 style={{ marginBottom: '16px', color: 'black' }}>
                    Distribución por Habilidad
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={dataGrupos}>
                        <PolarGrid stroke="#d1d5db" />
                        <PolarAngleAxis
                            dataKey="grupo"
                            tick={{ fill: '#374151', fontSize: 11 }}
                            tickFormatter={(value, index) => {
                                const dataPoint = dataGrupos[index];
                                const valorRedondeado = dataPoint.promedio.toFixed(2);
                                return `${value} (${valorRedondeado})`;
                            }}
                        />
                        <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#6b7280' }} />
                        <Radar
                            name="Puntaje"
                            dataKey="promedio"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.4}
                            strokeWidth={2}
                        />
                        <Tooltip />
                        <Legend />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}