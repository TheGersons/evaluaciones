import type { ResultadoEvaluado } from '../../types/resultados.types';

interface Props {
    lider: ResultadoEvaluado;
}

export default function LiderDestacado({ lider }: Props) {
    return (
        <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
            border: '3px solid #f59e0b',
            borderRadius: '14px',
            padding: '24px',
            marginBottom: '18px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '48px' }}>🏆</span>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', color: '#78350f' }}>
                        Líder Identificado
                    </h2>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#92400e', margin: '0 0 8px 0' }}>
                        {lider.evaluado.nombre}
                    </p>
                    <p style={{ color: '#78350f', margin: 0 }}>
                        <strong>Promedio:</strong> {lider.promedioGeneral.toFixed(2)}/5.0 |
                        <strong> Puesto:</strong> {lider.evaluado.puesto} |
                        <strong> Evaluaciones:</strong> {lider.numEvaluaciones}
                    </p>
                </div>
            </div>
        </div>
    );
}