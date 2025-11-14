// src/components/results/DetalleEvaluado/index.tsx
import type { ResultadoEvaluado } from '../../../types/resultados.types';
import { exportSectionAsPng, exportSectionAsPdf } from '../../../utils/resultados/exportUtils';
import ResumenCards from './ResumenCards';
import GraficosResumen from './GraficosResumen';
import GraficoPorCargo from './GraficoPorCargo';
import AnalisisPorCargo from './AnalisisPorCargo';
import TablaCompetencias from './TablaCompetencias';
import ResumenDimensiones from './ResumenDimensiones';
import SeccionComentarios from './SeccionComentarios';
import SeccionRespuestasAbiertas from './SeccionRespuestasAbiertas';

interface Props {
    resultado: ResultadoEvaluado;
    competencias: any[];
    escalaMaxLikert?: number;
}

export default function DetalleEvaluado({ resultado, competencias, escalaMaxLikert }: Props) {
    return (
        <section className="panel" style={{ background: '#f9fafb' }}>
            {/* Header con botones de exportación */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                }}
            >
                <h2>🔍 Análisis Detallado: {resultado.evaluado.nombre}</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => exportSectionAsPng('resumen-charts-container', 'resumen-graficos.png')}
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
                        onClick={() => exportSectionAsPdf('resumen-charts-container', 'resumen-graficos.pdf')}
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

            {/* Contenedor de resumen para exportar */}
            <div id="resumen-charts-container">
                {/* Cards de resumen */}
                <ResumenCards resultado={resultado} />

                {/* Gráficos de radar (Dimensión y Habilidades) */}
                <GraficosResumen resultado={resultado} />

                {/* Gráfico por cargo */}
                <GraficoPorCargo resultado={resultado} />
            </div>

            {/* Análisis por cargo (expandible) */}
            <AnalisisPorCargo resultado={resultado} escalaMaxLikert={escalaMaxLikert} />

            {/* Tabla de competencias */}
            <TablaCompetencias resultado={resultado} competencias={competencias} />

            {/* Resumen por dimensiones */}
            <ResumenDimensiones resultado={resultado} />

            {/* Comentarios */}
            <SeccionComentarios resultado={resultado} />

            {/* Respuestas abiertas */}
            <SeccionRespuestasAbiertas resultado={resultado} />
        </section>
    );
}