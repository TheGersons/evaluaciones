// src/pages/Resultados/index.tsx
import { getCicloRutaFromNombre, navigate } from '../../App';
import { useResultados } from '../../hooks/useResultados';
import { useExportaciones } from '../../hooks/useExportaciones';
import EstadisticasGenerales from '../../components/results/EstadisticasGenerales';
import LiderDestacado from '../../components/results/LiderDestacado';
import DetalleEvaluado from '../../components/results/DetalleEvaluado';
import GraficoRanking from '../../components/results/GraficoRanking';
import TablaResultados from '../../components/results/TablaResultados';

/**
 * Página principal de Resultados de Evaluación 360°
 * Muestra estadísticas, ranking y análisis detallado de evaluados
 */
export default function Resultados() {
    const {
        resultados,
        competencias,
        nombreCiclo,
        loading,
        error,
        evaluadoSeleccionado,
        setEvaluadoSeleccionado,
        resultadoDetalle,
        escalaMaxLikert
    } = useResultados();

    const { exportarExcel } = useExportaciones(resultados, competencias, nombreCiclo);

    // Estado de carga
    if (loading) {
        return (
            <div className="root">
                <div className="app">
                    <div className="panel">
                        <p>Cargando resultados...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Estado de error
    if (error) {
        return (
            <div className="root">
                <div className="app">
                    <div className="panel error">
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Sin resultados
    if (resultados.length === 0) {
        return (
            <div className="root">
                <div className="app">
                    <div className="panel">
                        <h2>📊 Sin resultados</h2>
                        <p>No hay evaluaciones completadas para este ciclo todavía.</p>
                        <button
                            onClick={() => navigate(`/${getCicloRutaFromNombre(nombreCiclo)}`)}
                            style={{
                                marginTop: '16px',
                                padding: '10px 20px',
                                background: '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Volver al Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Vista principal con resultados
    return (
        <div className="root">
            <div className="app">
                {/* Header */}
                <header className="header">
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div>
                            <h1>📊 Resultados Evaluación 360°</h1>
                            <p>Análisis completo de las evaluaciones: <strong>{nombreCiclo}</strong></p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                                onClick={exportarExcel}
                                style={{
                                    padding: '10px 20px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                📥 Exportar Excel
                            </button>
                            <button
                                onClick={() => navigate(`/${getCicloRutaFromNombre(nombreCiclo)}`)}
                                style={{
                                    padding: '10px 20px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                ← Dashboard
                            </button>
                        </div>
                    </div>
                </header>

                {/* Estadísticas generales */}
                <EstadisticasGenerales resultados={resultados} />

                {/* Líder destacado */}
                {resultados.length > 0 && (
                    <LiderDestacado lider={resultados[0]} />
                )}

                {/* Gráfico de ranking */}
                <GraficoRanking resultados={resultados} />

                {/* Tabla de resultados */}
                <TablaResultados
                    resultados={resultados}
                    evaluadoSeleccionado={evaluadoSeleccionado}
                    onSelectEvaluado={setEvaluadoSeleccionado}
                />

                {/* Detalle del evaluado seleccionado */}
                {resultadoDetalle && (
                    <DetalleEvaluado
                        resultado={resultadoDetalle}
                        competencias={competencias}
                        escalaMaxLikert={escalaMaxLikert}
                    />
                )}
            </div>
        </div>
    );
}