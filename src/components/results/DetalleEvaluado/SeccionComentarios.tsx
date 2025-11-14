// src/components/results/DetalleEvaluado/SeccionComentarios.tsx
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import type { ResultadoEvaluado } from '../../../types/resultados.types';

interface Props {
    resultado: ResultadoEvaluado;
}

export default function SeccionComentarios({ resultado }: Props) {
    if ((resultado?.comentarios?.length ?? 0) === 0) {
        return null;
    }

    const filas = resultado.comentarios.map((texto: string, i: number) => ({ i, texto }));
    
    const cols: DataTableColumn<typeof filas[number]>[] = [
        {
            header: "Comentario",
            render: (row) => (
                <div style={{
                    background: "#f3f4f6",
                    padding: "12px 16px",
                    borderRadius: 8,
                    borderLeft: "3px solid #4f46e5"
                }}>
                    <p style={{ margin: 0, color: "#374151" }}>{row.texto}</p>
                </div>
            ),
            getSortValue: (row) => row.texto?.toLowerCase?.() ?? "",
        },
    ];

    return (
        <div style={{ background: "white", padding: 20, borderRadius: 14 }}>
            <h3 style={{ marginBottom: 16, color: "black" }}>💬 Comentarios de Evaluadores</h3>
            <DataTable
                rows={filas}
                columns={cols}
                getSearchText={(r) => r.texto}
                initialPageSize={5}
                searchable={false}
            />
        </div>
    );
}