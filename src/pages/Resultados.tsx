// src/pages/Resultados.tsx
import { useEffect, useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Cell
} from 'recharts';
import {
    apiFetchEvaluados,
    apiFetchEvaluaciones,
    apiFetchRespuestasPorEvaluaciones,
    apiFetchCompetenciasConCargos
} from '../services/api';
import { navigate } from '../App';
import type { EvaluadoDTO, RespuestaDTO } from '../types';

interface ResultadoEvaluado {
    evaluado: EvaluadoDTO;
    numEvaluaciones: number;
    promedioGeneral: number;
    promediosPorCompetencia: Record<number, number>;
    promediosPorCargo: Record<string, number>;
    comentarios: string[];
    abiertasPorCompetencia: {
        competenciaId: number;
        titulo: string;
        textos: string[];
        pregunta: string;
    }[];
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function Resultados() {
    const [resultados, setResultados] = useState<ResultadoEvaluado[]>([]);
    const [competencias, setCompetencias] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [evaluadoSeleccionado, setEvaluadoSeleccionado] = useState<number | null>(null);

    useEffect(() => {
        cargarResultados();
    }, []);

    async function cargarResultados() {
        try {
            setLoading(true);
            setError(null);

            const [evaluados, evaluaciones, comps] = await Promise.all([
                apiFetchEvaluados(),
                apiFetchEvaluaciones(),
                apiFetchCompetenciasConCargos()
            ]);
            const todasLasRespuestas = await apiFetchRespuestasPorEvaluaciones(
                evaluaciones.map(e => e.id)
            );

            setCompetencias(comps);

            // Procesar resultados por evaluado
            const resultadosProcesados: ResultadoEvaluado[] = [];

            for (const evaluado of evaluados) {
                const evals = evaluaciones.filter(e => e.evaluado_id === evaluado.id);

                if (evals.length === 0) continue;

                // Obtener todas las respuestas
                const evalIds = new Set(evals.map(e => e.id));
                const respuestasDeEvaluado: RespuestaDTO[] = todasLasRespuestas.filter(
                    r => evalIds.has(r.evaluacion_id)
                );


                // Respuestas abiertas agrupadas por competencia
                const abiertasMap: Record<number, string[]> = {};
                const compById = new Map(comps.map((c: any) => [c.id, c]));

                for (const r of respuestasDeEvaluado) {
                    const comp = compById.get(r.competencia_id);
                    if (!comp || comp.tipo !== "texto") continue;
                    if (!r.comentario || !r.comentario.trim()) continue;

                    if (!abiertasMap[comp.id]) abiertasMap[comp.id] = [];
                    abiertasMap[comp.id].push(r.comentario.trim());
                }

                const abiertasPorCompetencia = Object.entries(abiertasMap).map(
                    ([compId, textos]) => {
                        const comp = compById.get(Number(compId));
                        return {
                            competenciaId: Number(compId),
                            titulo: comp?.titulo || "",
                            textos,
                            pregunta: comp?.descripcion || "",
                        };
                    }
                );


                // Calcular promedios por competencia
                // Calcular promedios por competencia (solo tipo likert)
                const promediosPorCompetencia: Record<number, number> = {};
                comps.forEach(comp => {
                    if (comp.tipo === "texto") return; // no promediamos abiertas

                    const respuestasComp = respuestasDeEvaluado.filter(r => r.competencia_id === comp.id);
                    if (respuestasComp.length > 0) {
                        const suma = respuestasComp.reduce((acc, r) => acc + r.valor, 0);
                        promediosPorCompetencia[comp.id] = suma / respuestasComp.length;
                    }
                });


                // Calcular promedio general
                const valores = Object.values(promediosPorCompetencia);
                const promedioGeneral = valores.length > 0
                    ? valores.reduce((a, b) => a + b, 0) / valores.length
                    : 0;

                // Calcular promedios por cargo
                const promediosPorCargo: Record<string, number> = {};
                const cargosUnicos = [...new Set(evals.map(e => e.cargo_evaluador))];

                for (const cargo of cargosUnicos) {
                    const evalsDelCargo = evals.filter(e => e.cargo_evaluador === cargo);
                    const respuestasDelCargo = respuestasDeEvaluado.filter(r =>
                        evalsDelCargo.some(ev => ev.id === r.evaluacion_id)
                    );

                    if (respuestasDelCargo.length > 0) {
                        const suma = respuestasDelCargo.reduce((acc, r) => acc + r.valor, 0);
                        promediosPorCargo[cargo] = suma / respuestasDelCargo.length;
                    }
                }

                // Recopilar comentarios
                const comentarios = evals
                    .map(e => e.comentarios)
                    .filter(c => c && c.trim().length > 0) as string[];

                resultadosProcesados.push({
                    evaluado,
                    numEvaluaciones: evals.length,
                    promedioGeneral,
                    promediosPorCompetencia,
                    promediosPorCargo,
                    comentarios,
                    abiertasPorCompetencia,

                });

            }

            // Ordenar por promedio general descendente
            resultadosProcesados.sort((a, b) => b.promedioGeneral - a.promedioGeneral);

            setResultados(resultadosProcesados);
        } catch (e: any) {
            console.error(e);
            setError(e?.message ?? 'Error cargando resultados');
        } finally {
            setLoading(false);
        }
    }

    const competenciasLikert = competencias.filter((c: any) => c.tipo !== "texto");

    function exportarExcel() {
        let csv = 'Ranking,Nombre,Puesto,Promedio General,Num Evaluaciones,';
        csv += competenciasLikert.map(c => c.titulo).join(',') + '\n';



        resultados.forEach((r, index) => {
            csv += `${index + 1},${r.evaluado.nombre},${r.evaluado.puesto},`;
            csv += `${r.promedioGeneral.toFixed(2)},${r.numEvaluaciones},`;
            csv += competenciasLikert
                .map(c => (r.promediosPorCompetencia[c.id] || 0).toFixed(2))
                .join(',');

            csv += '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'resultados_evaluacion_360.csv';
        link.click();
    }

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

    if (resultados.length === 0) {
        return (
            <div className="root">
                <div className="app">
                    <div className="panel">
                        <h2>📊 Sin Resultados</h2>
                        <p>No hay evaluaciones completadas todavía.</p>
                        <button
                            onClick={() => navigate('/')}
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

    const resultadoDetalle = evaluadoSeleccionado
        ? resultados.find(r => r.evaluado.id === evaluadoSeleccionado)
        : null;

    // Datos para gráfico de ranking
    const dataRanking = resultados.map(r => ({
        nombre: r.evaluado.nombre.split(' ')[0],
        promedio: parseFloat(r.promedioGeneral.toFixed(2))
    }));

    // Datos para radar del seleccionado
    const dataRadar = resultadoDetalle
        ? competencias.map(comp => ({
            competencia: comp.titulo.substring(0, 20),
            valor: parseFloat((resultadoDetalle.promediosPorCompetencia[comp.id] || 0).toFixed(2))
        }))
        : [];

    // Datos para barras por cargo
    const dataCargos = resultadoDetalle
        ? Object.entries(resultadoDetalle.promediosPorCargo).map(([cargo, promedio]) => ({
            cargo,
            promedio: parseFloat(promedio.toFixed(2))
        }))
        : [];

    return (
        <div className="root">
            <div className="app">
                <header className="header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h1>📊 Resultados Evaluación 360°</h1>
                            <p>Análisis completo de las evaluaciones realizadas</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={exportarExcel}
                                style={{
                                    padding: '10px 20px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                📥 Exportar Excel
                            </button>
                            <button
                                onClick={() => navigate('/')}
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
                <section className="grid">
                    <div className="card">
                        <h3>Total Evaluados</h3>
                        <p className="big-number">{resultados.length}</p>
                    </div>
                    <div className="card">
                        <h3>Promedio General</h3>
                        <p className="big-number">
                            {(resultados.reduce((acc, r) => acc + r.promedioGeneral, 0) / resultados.length).toFixed(2)}
                        </p>
                    </div>
                    <div className="card">
                        <h3>Total Evaluaciones</h3>
                        <p className="big-number">
                            {resultados.reduce((acc, r) => acc + r.numEvaluaciones, 0)}
                        </p>
                    </div>
                </section>

                {/* Líder destacado */}
                {resultados.length > 0 && (
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
                                <h2 style={{ margin: '0 0 8px 0', color: '#78350f' }}>Líder Identificado</h2>
                                <p style={{ fontSize: '28px', fontWeight: '700', color: '#92400e', margin: '0 0 8px 0' }}>
                                    {resultados[0].evaluado.nombre}
                                </p>
                                <p style={{ color: '#78350f', margin: 0 }}>
                                    <strong>Promedio:</strong> {resultados[0].promedioGeneral.toFixed(2)}/5.0 |
                                    <strong> Puesto:</strong> {resultados[0].evaluado.puesto} |
                                    <strong> Evaluaciones:</strong> {resultados[0].numEvaluaciones}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gráfico de ranking */}
                <section className="panel">
                    <h2>📈 Ranking General</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dataRanking}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="nombre" />
                            <YAxis domain={[0, 5]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="promedio" radius={[8, 8, 0, 0]}>
                                {dataRanking.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </section>

                {/* Tabla de resultados */}
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
                                    onClick={() => setEvaluadoSeleccionado(
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
                                            color: r.promedioGeneral >= 4.5 ? '#10b981' :
                                                r.promedioGeneral >= 3.5 ? '#4f46e5' :
                                                    r.promedioGeneral >= 2.5 ? '#f59e0b' : '#ef4444'
                                        }}>
                                            {r.promedioGeneral.toFixed(2)}
                                        </span>
                                    </td>
                                    <td>{r.numEvaluaciones}</td>
                                    <td>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEvaluadoSeleccionado(
                                                    evaluadoSeleccionado === r.evaluado.id ? null : r.evaluado.id
                                                );
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                background: evaluadoSeleccionado === r.evaluado.id ? '#ef4444' : '#4f46e5',
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

                {/* Detalle expandido */}
                {resultadoDetalle && (
                    <section className="panel" style={{ background: '#f9fafb' }}>
                        <h2>🔍 Análisis Detallado: {resultadoDetalle.evaluado.nombre}</h2>

                        <div className="grid" style={{ marginBottom: '20px' }}>
                            <div className="card">
                                <h3>Promedio General</h3>
                                <p className="big-number">{resultadoDetalle.promedioGeneral.toFixed(2)}</p>
                            </div>
                            <div className="card">
                                <h3>Evaluaciones Recibidas</h3>
                                <p className="big-number">{resultadoDetalle.numEvaluaciones}</p>
                            </div>
                            <div className="card">
                                <h3>Comentarios</h3>
                                <p className="big-number">{resultadoDetalle.comentarios.length}</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '18px', marginBottom: '20px' }}>
                            {/* Radar de competencias */}
                            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                                <h3 style={{ marginBottom: '16px' }}>Competencias</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={dataRadar}>
                                        <PolarGrid />
                                        <PolarAngleAxis dataKey="competencia" />
                                        <PolarRadiusAxis domain={[0, 5]} />
                                        <Radar name="Puntaje" dataKey="valor" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.6} />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Barras por cargo */}
                            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                                <h3 style={{ marginBottom: '16px' }}>Promedio por Cargo</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={dataCargos}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="cargo" />
                                        <YAxis domain={[0, 5]} />
                                        <Tooltip />
                                        <Bar dataKey="promedio" fill="#10b981" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Tabla de competencias */}
                        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
                            <h3 style={{ marginBottom: '16px', color: 'black' }}>Detalle por Competencia</h3>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Competencia</th>
                                        <th>Puntaje</th>
                                        <th>Valoración</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {competencias.map(comp => {
                                        const valor = resultadoDetalle.promediosPorCompetencia[comp.id] || 0;
                                        return (
                                            <tr key={comp.id}>
                                                <td>{comp.titulo}</td>
                                                <td>
                                                    <strong style={{
                                                        color: valor >= 4.5 ? '#10b981' :
                                                            valor >= 3.5 ? '#4f46e5' :
                                                                valor >= 2.5 ? '#f59e0b' : '#ef4444'
                                                    }}>
                                                        {valor.toFixed(2)}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        background: valor >= 4.5 ? '#d1fae5' :
                                                            valor >= 3.5 ? '#dbeafe' :
                                                                valor >= 2.5 ? '#fef3c7' : '#fee2e2',
                                                        color: valor >= 4.5 ? '#065f46' :
                                                            valor >= 3.5 ? '#1e40af' :
                                                                valor >= 2.5 ? '#92400e' : '#991b1b'
                                                    }}>
                                                        {valor >= 4.5 ? 'Excelente' :
                                                            valor >= 3.5 ? 'Alto' :
                                                                valor >= 2.5 ? 'Promedio' : 'Bajo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Comentarios */}
                        {resultadoDetalle.comentarios.length > 0 && (
                            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                                <h3 style={{ marginBottom: '16px', color: 'black' }}>💬 Comentarios de Evaluadores</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {resultadoDetalle.comentarios.map((comentario, index) => (
                                        <div key={index} style={{
                                            background: '#f3f4f6',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            borderLeft: '3px solid #4f46e5'
                                        }}>
                                            <p style={{ margin: 0, color: '#374151' }}>{comentario}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {resultadoDetalle.abiertasPorCompetencia &&
                            resultadoDetalle.abiertasPorCompetencia.length > 0 && (
                                <div style={{ background: 'white', padding: '20px', borderRadius: '14px', marginTop: '20px' }}>
                                    <h3 style={{ marginBottom: '16px', color: 'black' }}>📝 Respuestas abiertas por competencia</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {resultadoDetalle.abiertasPorCompetencia.map((item) => (
                                            <div key={item.competenciaId} style={{
                                                borderRadius: '10px',
                                                border: '1px solid #e5e7eb',
                                                padding: '12px 16px',
                                                background: '#f9fafb'
                                            }}>
                                                <h4 style={{ margin: '0 0 8px 0', color: '#111827' }}>{item.pregunta}</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {item.textos.map((txt, idx) => (
                                                        <div key={idx} style={{
                                                            background: '#f3f4f6',
                                                            padding: '8px 10px',
                                                            borderRadius: '8px'
                                                        }}>
                                                            <p style={{ margin: 0, color: '#374151' }}>{txt}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                    </section>
                )}
            </div>
        </div>
    );
}