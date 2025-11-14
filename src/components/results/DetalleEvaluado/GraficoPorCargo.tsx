// src/components/results/DetalleEvaluado/GraficoPorCargo.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ResultadoEvaluado } from '../../../types/resultados.types';
import { COLORS } from '../../../utils/resultados/coloresYConstantes';
import { transformToCargosData } from '../../../utils/resultados/dataTransformers';

interface Props {
    resultado: ResultadoEvaluado;
}

export default function GraficoPorCargo({ resultado }: Props) {
    const dataCargos = transformToCargosData(resultado);

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: '18px', 
            marginBottom: '20px' 
        }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                <h3 style={{ marginBottom: '16px', color: 'black' }}>Promedio por Cargo</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dataCargos}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="cargo"
                            tick={{ fontSize: 18 }}
                            tickFormatter={(value, index) => {
                                const dataPoint = dataCargos[index];
                                const valorRedondeado = dataPoint.promedio.toFixed(2);
                                return `${value} (${valorRedondeado})`;
                            }}
                        />
                        <YAxis domain={[0, 5]} />
                        <Tooltip />
                        <Bar dataKey="promedio" radius={[8, 8, 0, 0]}>
                            {dataCargos.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}