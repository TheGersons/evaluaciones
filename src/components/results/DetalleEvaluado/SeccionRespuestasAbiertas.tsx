// src/components/results/DetalleEvaluado/SeccionRespuestasAbiertas.tsx
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import type { ResultadoEvaluado } from '../../../types/resultados.types';

interface Props {
    resultado: ResultadoEvaluado;
}

export default function SeccionRespuestasAbiertas({ resultado }: Props) {
    if (!resultado?.abiertasPorCompetencia?.length) {
        return null;
    }

    return (
        <div style={{ background: "white", padding: 20, borderRadius: 14 }}>
            <h3 style={{ marginBottom: 16, color: "black" }}>📝 Respuestas abiertas por competencia</h3>

            {resultado.abiertasPorCompetencia.map((item: any, qidx: number) => {
                const filas = (item.textos ?? []).map((txt: string, idx: number) => ({
                    id: `${item.competenciaId ?? qidx}-${idx}`,
                    respuesta: txt,
                }));

                const cols: DataTableColumn<typeof filas[number]>[] = [
                    {
                        header: "Respuesta",
                        render: (row) => (
                            <div style={{
                                background: "#ffffff",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb"
                            }}>
                                <p style={{ margin: 0, color: "#374151" }}>{row.respuesta}</p>
                            </div>
                        ),
                        getSortValue: (row) => row.respuesta?.toLowerCase?.() ?? "",
                    },
                ];

                return (
                    <section key={item.competenciaId ?? qidx} style={{ marginBottom: 20 }}>
                        <h4 style={{ margin: "0 0 12px 0", color: "#111827" }}>{item.pregunta}</h4>
                        <DataTable
                            rows={filas}
                            columns={cols}
                            getSearchText={(r) => r.respuesta}
                            initialPageSize={5}
                            searchable={false}
                        />
                    </section>
                );
            })}
        </div>
    );
}