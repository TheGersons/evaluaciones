// src/components/results/DetalleEvaluado/TablaCompetencias.tsx
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import type { ResultadoEvaluado } from '../../../types/resultados.types';
import { 
    getScoreColor, 
    getScoreLabel, 
    getScoreBadgeColors,
    getDimensionBadgeColors 
} from '../../../utils/resultados/coloresYConstantes';
import { transformToCompetenciasTableRows, normalizeText } from '../../../utils/resultados/dataTransformers';

interface Props {
    resultado: ResultadoEvaluado;
    competencias: any[];
}

export default function TablaCompetencias({ resultado, competencias }: Props) {
    const filasCompetencias = transformToCompetenciasTableRows(
        competencias,
        resultado.promediosPorCompetencia
    );

    const colsCompetencias: DataTableColumn<typeof filasCompetencias[number]>[] = [
        {
            header: "Dimensión",
            render: (row) => {
                const { bg, color } = getDimensionBadgeColors(row.dimension);
                return (
                    <span style={{
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: bg,
                        color
                    }}>
                        {row.dimension}
                    </span>
                );
            },
            getSortValue: (row) => normalizeText(row.dimension),
        },
        {
            header: "Competencia",
            render: (row) => row.titulo,
            getSortValue: (row) => row.titulo?.toLowerCase?.() ?? "",
        },
        {
            header: "Puntaje",
            render: (row) => {
                const v = row.valor;
                const color = getScoreColor(v);
                return <strong style={{ color }}>{v.toFixed(2)}</strong>;
            },
            getSortValue: (row) => row.valor,
        },
        {
            header: "Valoración",
            render: (row) => {
                const v = row.valor;
                const label = getScoreLabel(v);
                const { bg, color } = getScoreBadgeColors(v);
                return (
                    <span style={{
                        padding: "4px 12px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: bg,
                        color
                    }}>
                        {label}
                    </span>
                );
            },
            getSortValue: (row) => row.valor,
        },
    ];

    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
            <section style={{ background: "white", padding: 20, borderRadius: 14 }}>
                <h3 style={{ marginBottom: 12, color: "black" }}>Resultados por competencia</h3>
                <DataTable
                    rows={filasCompetencias}
                    columns={colsCompetencias}
                    getSearchText={(r) => `${r.dimension} ${r.titulo}`}
                    initialPageSize={5}
                    searchable={false}
                />
            </section>
        </div>
    );
}