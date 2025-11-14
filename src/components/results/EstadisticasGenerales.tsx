import type { ResultadoEvaluado } from '../../types/resultados.types';

interface Props {
    resultados: ResultadoEvaluado[];
}

export default function EstadisticasGenerales({ resultados }: Props) {
    const promedioGeneral = resultados.length > 0
        ? (resultados.reduce((acc, r) => acc + r.promedioGeneral, 0) / resultados.length).toFixed(2)
        : '0.00';

    const totalEvaluaciones = resultados.reduce((acc, r) => acc + r.numEvaluaciones, 0);

    return (
        <section className="grid">
            <div className="card">
                <h3>Total Evaluados</h3>
                <p className="big-number">{resultados.length}</p>
            </div>
            <div className="card">
                <h3>Promedio General</h3>
                <p className="big-number">{promedioGeneral}</p>
            </div>
            <div className="card">
                <h3>Total Evaluaciones</h3>
                <p className="big-number">{totalEvaluaciones}</p>
            </div>
        </section>
    );
}