// src/components/results/DetalleEvaluado/ResumenCards.tsx
import type { ResultadoEvaluado } from '../../../types/resultados.types';

interface Props {
    resultado: ResultadoEvaluado;
}

export default function ResumenCards({ resultado }: Props) {
    return (
        <div className="grid" style={{ marginBottom: '20px' }}>
            <div className="card">
                <h3>Promedio General</h3>
                <p className="big-number">{resultado.promedioGeneral.toFixed(2)}</p>
            </div>
            <div className="card">
                <h3>Evaluaciones Recibidas</h3>
                <p className="big-number">{resultado.numEvaluaciones}</p>
            </div>
            <div className="card">
                <h3>Comentarios</h3>
                <p className="big-number">{resultado.comentarios.length}</p>
            </div>
        </div>
    );
}