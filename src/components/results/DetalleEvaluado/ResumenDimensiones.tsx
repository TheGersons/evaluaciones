// src/components/results/DetalleEvaluado/ResumenDimensiones.tsx
import type { ResultadoEvaluado } from '../../../types/resultados.types';
import { getDimensionColor } from '../../../utils/resultados/coloresYConstantes';

interface Props {
    resultado: ResultadoEvaluado;
}

export default function ResumenDimensiones({ resultado }: Props) {
    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '16px', color: 'black' }}>Resumen por Dimensión General</h3>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '16px' 
            }}>
                {Object.entries(resultado.promediosPorDimension).map(([dimension, promedio]) => {
                    const colors = getDimensionColor(dimension);
                    
                    return (
                        <div 
                            key={dimension} 
                            style={{
                                padding: '16px',
                                borderRadius: '10px',
                                border: '2px solid',
                                borderColor: colors.border,
                                background: colors.bg
                            }}
                        >
                            <h4 style={{
                                margin: '0 0 8px 0',
                                color: colors.text
                            }}>
                                {dimension}
                            </h4>
                            <p style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                margin: 0,
                                color: colors.value
                            }}>
                                {promedio.toFixed(2)}
                            </p>
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                                de 5.0
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}