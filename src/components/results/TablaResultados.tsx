// src/components/results/TablaResultados.tsx
import type { ResultadoEvaluado } from '../../types/resultados.types';
import { getScoreColor } from '../../utils/resultados/coloresYConstantes';

interface Props {
    resultados: ResultadoEvaluado[];
    evaluadoSeleccionado: number | null;
    onSelectEvaluado: (id: number | null) => void;
}

export default function TablaResultados({ 
    resultados, 
    evaluadoSeleccionado, 
    onSelectEvaluado 
}: Props) {
    return (
        <section className="panel">
            <h2>📋 Detalle por Evaluado</h2>
            <p className="sub">Haz clic en un evaluado para ver su análisis detallado</p>

            <table className="table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Nombre</th>
                        <th>Puesto</th>
                        <th>Promedio</th>
                        <th>Evals</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {resultados.map((r, index) => (
                        <tr
                            key={r.evaluado.id}
                            style={{
                                background: index === 0 ? '#fef3c7' : 'white',
                                cursor: 'pointer'
                            }}
                            onClick={() => onSelectEvaluado(
                                evaluadoSeleccionado === r.evaluado.id ? null : r.evaluado.id
                            )}
                        >
                            <td><strong>{index + 1}</strong></td>
                            <td>{r.evaluado.nombre}</td>
                            <td>{r.evaluado.puesto}</td>
                            <td>
                                <span style={{
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: getScoreColor(r.promedioGeneral)
                                }}>
                                    {r.promedioGeneral.toFixed(2)}
                                </span>
                            </td>
                            <td>{r.numEvaluaciones}</td>
                            <td>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectEvaluado(
                                            evaluadoSeleccionado === r.evaluado.id ? null : r.evaluado.id
                                        );
                                    }}
                                    style={{
                                        padding: '6px 12px',
                                        background: evaluadoSeleccionado === r.evaluado.id 
                                            ? '#ef4444' 
                                            : '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    {evaluadoSeleccionado === r.evaluado.id ? 'Cerrar' : 'Ver Detalle'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}