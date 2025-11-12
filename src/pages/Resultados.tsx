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
    apiFetchCompetenciasConCargos,
    apiFetchCiclos
} from '../services/api';
import type { EvaluadoDTO, RespuestaDTO, CicloEvaluacion } from '../types';
import { navigate } from '../App';
import { DataTable, type DataTableColumn } from '../components/common/DataTable';

interface ResultadoEvaluado {
    evaluado: EvaluadoDTO;
    numEvaluaciones: number;
    promedioGeneral: number;
    promediosPorCompetencia: Record<number, number>;
    promediosPorCargo: Record<string, number>;
    promediosPorDimension: Record<string, number>;
    promediosPorHabilidad: Record<string, number>;
    promediosPorGrupo: Record<string, number>;
    comentarios: string[];
    abiertasPorCompetencia: {
        competenciaId: number;
        titulo: string;
        textos: string[];
        pregunta: string;
    }[];
}

/*const COLORES_DIMENSIONES = {
    'Fiabilidad': '#ef4444',
    'Armonía': '#3b82f6', 
    'Interés': '#10b981'
};*/

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const MORE_COLORS = [
    '#4f46e5',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#6366f1', // Indigo 500
    '#f43f5e', // Rose 500
    '#a855f7', // Violet 500
    '#22c55e', // Emerald 500
    '#f97316'  // Orange 500
];
const GROUP_COLORS = [
    MORE_COLORS[0], // #4f46e5 (Grupo 1)
    MORE_COLORS[1], // #06b6d4 (Grupo 2)
    MORE_COLORS[2], // #10b981 (Grupo 3)
];



export default function Resultados() {
    const [resultados, setResultados] = useState<ResultadoEvaluado[]>([]);
    const [competencias, setCompetencias] = useState<any[]>([]);
    const [ciclos, setCiclos] = useState<CicloEvaluacion[]>([]);
    const [cicloSeleccionado, setCicloSeleccionado] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [evaluadoSeleccionado, setEvaluadoSeleccionado] = useState<number | null>(null);

    useEffect(() => {
        cargarCiclos();
    }, []);

    useEffect(() => {
        if (cicloSeleccionado) {
            cargarResultados();
        }
    }, [cicloSeleccionado]);

    const getColorForBar = (index: number) => {
        // La división entera (Math.floor) de index / 3 nos da el índice del grupo:
        // Índices 0, 1, 2 => 0
        // Índices 3, 4, 5 => 1
        // Índices 6, 7, 8 => 2
        const groupIndex = Math.floor(index / 3);

        // Usamos el operador módulo para asegurar que el índice del grupo 
        // siempre esté dentro del rango del arreglo GROUP_COLORS (0, 1, 2)
        return GROUP_COLORS[groupIndex % GROUP_COLORS.length];
    };

    async function cargarCiclos() {
        try {
            const ciclosRes = await apiFetchCiclos();
            const ciclosMapped = ciclosRes.map(c => ({
                id: String(c.id),
                nombre: c.nombre,
                descripcion: c.descripcion,
                fecha_inicio: c.fecha_inicio,
                fecha_fin: c.fecha_fin,
                estado: c.estado,
                fecha_creacion: c.fecha_creacion,
                fecha_actualizacion: c.fecha_actualizacion
            }));

            setCiclos(ciclosMapped);

            // Seleccionar ciclo activo o el primero disponible
            const cicloActivo = ciclosMapped.find(c => c.estado === 'activa');
            if (cicloActivo) {
                setCicloSeleccionado(cicloActivo.id);
            } else if (ciclosMapped.length > 0) {
                setCicloSeleccionado(ciclosMapped[0].id);
            }
        } catch (e: any) {
            console.error(e);
            setError('Error cargando ciclos: ' + e.message);
        }
    }

    async function cargarResultados() {
        try {
            setLoading(true);
            setError(null);

            const [evaluados, evaluaciones, comps] = await Promise.all([
                apiFetchEvaluados(),
                apiFetchEvaluaciones(Number(cicloSeleccionado)),
                apiFetchCompetenciasConCargos()
            ]);

            const todasLasRespuestas = await apiFetchRespuestasPorEvaluaciones(
                evaluaciones.map(e => e.id)
            );

            setCompetencias(comps);

            const resultadosProcesados: ResultadoEvaluado[] = [];

            for (const evaluado of evaluados) {
                const evals = evaluaciones.filter(e => e.evaluado_id === evaluado.id);

                if (evals.length === 0) continue;

                const evalIds = new Set(evals.map(e => e.id));
                const respuestasDeEvaluado: RespuestaDTO[] = todasLasRespuestas.filter(
                    r => evalIds.has(r.evaluacion_id)
                );

                // Respuestas abiertas
                const abiertasMap: Record<number, string[]> = {};
                const compById = new Map(comps.map((c: any) => [c.id, c]));

                for (const r of respuestasDeEvaluado) {
                    const comp = compById.get(r.competencia_id);
                    if (!comp || comp.tipo !== 'texto') continue;
                    if (!r.comentario || !r.comentario.trim()) continue;

                    if (!abiertasMap[comp.id]) abiertasMap[comp.id] = [];
                    abiertasMap[comp.id].push(r.comentario.trim());
                }

                const abiertasPorCompetencia = Object.entries(abiertasMap).map(
                    ([compId, textos]) => {
                        const comp = compById.get(Number(compId));
                        return {
                            competenciaId: Number(compId),
                            titulo: comp?.titulo || '',
                            textos,
                            pregunta: comp?.descripcion || '',
                        };
                    }
                );

                // Promedios por competencia (solo likert)
                const promediosPorCompetencia: Record<number, number> = {};
                comps.forEach(comp => {
                    if (comp.tipo === 'texto') return;

                    const respuestasComp = respuestasDeEvaluado.filter(r => r.competencia_id === comp.id);
                    if (respuestasComp.length > 0) {
                        const suma = respuestasComp.reduce((acc, r) => acc + r.valor, 0);
                        promediosPorCompetencia[comp.id] = suma / respuestasComp.length;
                    }
                });

                // Promedios por dimensión general (Fiabilidad, Armonía, Interés)
                const promediosPorDimension: Record<string, number> = {};
                const dimensiones = ['Fiabilidad', 'Armonía', 'Interés'];

                for (const dimension of dimensiones) {
                    const compsEnDimension = comps.filter(
                        c => c.dimension_general === dimension && c.tipo === 'likert'
                    );

                    if (compsEnDimension.length > 0) {
                        const promedios = compsEnDimension
                            .map(c => promediosPorCompetencia[c.id])
                            .filter(p => p !== undefined);

                        if (promedios.length > 0) {
                            promediosPorDimension[dimension] =
                                promedios.reduce((a, b) => a + b, 0) / promedios.length;
                        }
                    }
                }

                // Promedios por habilidad (clave única de competencia)
                const promediosPorHabilidad: Record<string, number> = {};
                const habilidadesAgrupadas = new Map<string, number[]>();

                comps.forEach(comp => {
                    if (comp.tipo === 'texto') return;
                    const promedio = promediosPorCompetencia[comp.id];
                    if (promedio !== undefined) {
                        if (!habilidadesAgrupadas.has(comp.titulo)) {
                            habilidadesAgrupadas.set(comp.titulo, []);
                        }
                        habilidadesAgrupadas.get(comp.titulo)!.push(promedio);
                    }
                });

                habilidadesAgrupadas.forEach((valores, titulo) => {
                    promediosPorHabilidad[titulo] = valores.reduce((a, b) => a + b, 0) / valores.length;
                });

                // Promedio general
                const valores = Object.values(promediosPorCompetencia);
                const promedioGeneral = valores.length > 0
                    ? valores.reduce((a, b) => a + b, 0) / valores.length
                    : 0;

                // Promedios por cargo
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

                //Promedios por Grupo

                const promediosPorGrupo: Record<string, number> = {};
                const GruposAgrupados = new Map<string, number[]>();

                comps.forEach(comp => {
                    if (comp.tipo === 'texto') return;
                    const promedio = promediosPorCompetencia[comp.id];
                    if (promedio !== undefined) {
                        if (!GruposAgrupados.has(comp.grupo ?? "")) {
                            GruposAgrupados.set(comp.grupo ?? "", []);
                        }
                        GruposAgrupados.get(comp.grupo ?? "")!.push(promedio);
                    }
                });

                GruposAgrupados.forEach((valores, grupo) => {
                    promediosPorGrupo[grupo] = valores.reduce((a, b) => a + b, 0) / valores.length;
                });

                // Comentarios
                const comentarios = evals
                    .map(e => e.comentarios)
                    .filter(c => c && c.trim().length > 0) as string[];

                resultadosProcesados.push({
                    evaluado,
                    numEvaluaciones: evals.length,
                    promedioGeneral,
                    promediosPorCompetencia,
                    promediosPorCargo,
                    promediosPorDimension,
                    promediosPorHabilidad,
                    comentarios,
                    abiertasPorCompetencia,
                    promediosPorGrupo
                });
            }

            resultadosProcesados.sort((a, b) => b.promedioGeneral - a.promedioGeneral);

            setResultados(resultadosProcesados);
        } catch (e: any) {
            console.error(e);
            setError(e?.message ?? 'Error cargando resultados');
        } finally {
            setLoading(false);
        }
    }

    const competenciasLikert = competencias.filter((c: any) => c.tipo !== 'texto');

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
        link.download = `resultados_evaluacion_${cicloSeleccionado}.csv`;
        link.click();
    }

    if (loading && !cicloSeleccionado) {
        return (
            <div className="root">
                <div className="app">
                    <div className="panel">
                        <p>Cargando ciclos...</p>
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

    if (!cicloSeleccionado) {
        return (
            <div className="root">
                <div className="app">
                    <div className="panel">
                        <h2>⚠️ No hay ciclos disponibles</h2>
                        <p>Crea un ciclo de evaluación primero.</p>
                        <button
                            onClick={() => navigate('/ciclos')}
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
                            Ir a Gestión de Ciclos
                        </button>
                    </div>
                </div>
            </div>
        );
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

    if (resultados.length === 0) {
        return (
            <div className="root">
                <div className="app">
                    <div className="panel">
                        <h2>📊 Sin Resultados</h2>
                        <p>No hay evaluaciones completadas para este ciclo todavía.</p>
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

    // Datos para radar de dimensión general (3 dimensiones)
    const dataRadarDimensionGeneral = resultadoDetalle
        ? Object.entries(resultadoDetalle.promediosPorDimension).map(([dimension, valor]) => ({
            dimension,
            valor: parseFloat(valor.toFixed(2))
        }))
        : [];

    // Datos para radar de habilidades (competencias individuales) - TOP 10
    const dataRadarHabilidades = resultadoDetalle
        ? Object.entries(resultadoDetalle.promediosPorHabilidad)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 13)
            .map(([habilidad, valor]) => ({
                habilidad: habilidad.substring(0, 20),
                valor: parseFloat(valor.toFixed(2))
            }))
        : [];

    // Datos para barras por cargo
    const dataCargos = resultadoDetalle
        ? Object.entries(resultadoDetalle.promediosPorCargo).map(([cargo, promedio]) => ({
            cargo,
            promedio: parseFloat(promedio.toFixed(2))
        }))
        : [];

    const dataGrupos = resultadoDetalle
        ? Object.entries(resultadoDetalle.promediosPorGrupo).map(([grupo, promedio]) => ({
            grupo,
            promedio: parseFloat(promedio.toFixed(2))
        }))
        : [];
    // Normaliza la dimensión para estilos/orden
    const norm = (s?: string) =>
        (s ?? "N/A").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Prepara filas
    const filasCompetencias = (competencias ?? [])
        .filter(c => c.tipo !== "texto")
        .map(c => ({
            id: c.id,
            dimension: c.dimension_general || "N/A",
            titulo: c.titulo,
            valor: (resultadoDetalle?.promediosPorCompetencia?.[c.id] ?? 0) as number,
        }));

    // Columnas
    const colsCompetencias: DataTableColumn<typeof filasCompetencias[number]>[] = [
        {
            header: "Dimensión",
            render: (row) => {
                const d = row.dimension;
                const bg =
                    d === "Fiabilidad" ? "#fee2e2" :
                        d === "Armonía" ? "#dbeafe" :
                            d === "Interés" ? "#d1fae5" : "#f3f4f6";
                const color =
                    d === "Fiabilidad" ? "#991b1b" :
                        d === "Armonía" ? "#1e40af" :
                            d === "Interés" ? "#065f46" : "#374151";
                return (
                    <span style={{
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: bg, color
                    }}>
                        {row.dimension}
                    </span>
                );
            },
            getSortValue: (row) => norm(row.dimension),
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
                const color =
                    v >= 4.5 ? "#10b981" :
                        v >= 3.5 ? "#4f46e5" :
                            v >= 2.5 ? "#f59e0b" : "#ef4444";
                return <strong style={{ color }}>{v.toFixed(2)}</strong>;
            },
            getSortValue: (row) => row.valor,
        },
        {
            header: "Valoración",
            render: (row) => {
                const v = row.valor;
                const label = v >= 4.5 ? "Excelente" : v >= 3.5 ? "Alto" : v >= 2.5 ? "Promedio" : "Bajo";
                const bg =
                    v >= 4.5 ? "#d1fae5" :
                        v >= 3.5 ? "#dbeafe" :
                            v >= 2.5 ? "#fef3c7" : "#fee2e2";
                const color =
                    v >= 4.5 ? "#065f46" :
                        v >= 3.5 ? "#1e40af" :
                            v >= 2.5 ? "#92400e" : "#991b1b";
                return (
                    <span style={{
                        padding: "4px 12px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: bg, color
                    }}>
                        {label}
                    </span>
                );
            },
            getSortValue: (row) => row.valor, // ordena por el score si quieres
        },
    ];



    return (
        <div className="root">
            <div className="app">
                <header className="header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h1>📊 Resultados Evaluación 360°</h1>
                            <p>Análisis completo de las evaluaciones realizadas</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <select
                                value={cicloSeleccionado}
                                onChange={(e) => setCicloSeleccionado(e.target.value)}
                                style={{
                                    padding: '10px 16px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}
                            >
                                {ciclos.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.nombre}
                                    </option>
                                ))}
                            </select>
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

                        {/* Gráficos lado a lado */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '18px', marginBottom: '20px' }}>
                            {/* Radar de DIMENSIÓN GENERAL (3 dimensiones) */}
                            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                                <h3 style={{ marginBottom: '16px', color: 'black' }}>Distribución por Dimensión General</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={dataRadarDimensionGeneral}>
                                        <PolarGrid stroke="#d1d5db" />
                                        <PolarAngleAxis
                                            dataKey="dimension"
                                            tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }}
                                        />
                                        <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#6b7280' }} />
                                        <Radar
                                            name="Puntaje"
                                            dataKey="valor"
                                            stroke="#4f46e5"
                                            fill="#4f46e5"
                                            fillOpacity={0.4}
                                            strokeWidth={2}
                                        />
                                        <Tooltip />
                                        <Legend />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Radar de HABILIDADES (Top 10 competencias) */}
                            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                                <h3 style={{ marginBottom: '16px', color: 'black' }}>Distribución por Habilidad</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={dataRadarHabilidades}>
                                        <PolarGrid stroke="#d1d5db" />
                                        <PolarAngleAxis
                                            dataKey="habilidad"
                                            tick={{ fill: '#374151', fontSize: 11 }}
                                        />
                                        <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#6b7280' }} />
                                        <Radar
                                            name="Puntaje"
                                            dataKey="valor"
                                            stroke="#10b981"
                                            fill="#10b981"
                                            fillOpacity={0.4}
                                            strokeWidth={2}
                                        />
                                        <Tooltip />
                                        <Legend />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>


                        </div>
                        {/* Barras por cargo */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '18px', marginBottom: '20px' }}>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                                <h3 style={{ marginBottom: '16px', color: 'black' }}>Promedio por Cargo</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={dataCargos}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="cargo" tick={{ fontSize: 18 }} />
                                        <YAxis domain={[0, 5]} />
                                        <Tooltip />
                                        <Bar dataKey="promedio" radius={[8, 8, 0, 0]}>
                                            {dataCargos.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                        </div>
                        <div>
                            <br>
                            </br>
                        </div>
                        {/* Barras por Grupo */}
                        <div style={{ background: 'white', padding: '20px', borderRadius: '14px' }}>
                            <h3 style={{ marginBottom: '16px', color: 'black' }}>Promedio por Grupo</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={dataGrupos}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="grupo" tick={{ fontSize: 12 }} />
                                    <YAxis domain={[0, 5]} />
                                    <Tooltip />
                                    <Bar dataKey="promedio" radius={[8, 8, 0, 0]}>
                                        {dataGrupos.map((_entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={getColorForBar(index)} // <-- Llama a la función
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <br>
                            </br>
                        </div>
                        {/* Tabla de competencias */}
                        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
                            <section style={{ background: "white", padding: 20, borderRadius: 14 }}>
                                <h3 style={{ marginBottom: 12, color: "black" }}>Resultados por competencia</h3>
                                <DataTable
                                    rows={filasCompetencias}
                                    columns={colsCompetencias}
                                    getSearchText={(r) => `${r.dimension} ${r.titulo}`}
                                    initialPageSize={5} // 5 por defecto
                                    searchable={false}
                                />
                            </section>
                        </div>

                        {/* Resumen por Dimensión General */}
                        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
                            <h3 style={{ marginBottom: '16px', color: 'black' }}>Resumen por Dimensión General</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                {Object.entries(resultadoDetalle.promediosPorDimension).map(([dimension, promedio]) => (
                                    <div key={dimension} style={{
                                        padding: '16px',
                                        borderRadius: '10px',
                                        border: '2px solid',
                                        borderColor: dimension === 'Fiabilidad' ? '#ef4444' :
                                            dimension === 'Armonía' ? '#3b82f6' :
                                                dimension === 'Interés' ? '#10b981' : '#d1d5db',
                                        background: dimension === 'Fiabilidad' ? '#fef2f2' :
                                            dimension === 'Armonía' ? '#eff6ff' :
                                                dimension === 'Interés' ? '#f0fdf4' : '#f9fafb'
                                    }}>
                                        <h4 style={{
                                            margin: '0 0 8px 0',
                                            color: dimension === 'Fiabilidad' ? '#991b1b' :
                                                dimension === 'Armonía' ? '#1e40af' :
                                                    dimension === 'Interés' ? '#065f46' : '#374151'
                                        }}>
                                            {dimension}
                                        </h4>
                                        <p style={{
                                            fontSize: '32px',
                                            fontWeight: '700',
                                            margin: 0,
                                            color: dimension === 'Fiabilidad' ? '#dc2626' :
                                                dimension === 'Armonía' ? '#2563eb' :
                                                    dimension === 'Interés' ? '#059669' : '#6b7280'
                                        }}>
                                            {promedio.toFixed(2)}
                                        </p>
                                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                                            de 5.0
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Comentarios */}
                        {(resultadoDetalle?.comentarios?.length ?? 0) > 0 && (
                            <div style={{ background: "white", padding: 20, borderRadius: 14 }}>
                                <h3 style={{ marginBottom: 16, color: "black" }}>💬 Comentarios de Evaluadores</h3>

                                {(() => {
                                    const filas = resultadoDetalle.comentarios.map((texto: string, i: number) => ({ i, texto }));
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
                                        <DataTable
                                            rows={filas}
                                            columns={cols}
                                            getSearchText={(r) => r.texto}
                                            initialPageSize={5}
                                            searchable={false}
                                        />
                                    );
                                })()}
                            </div>
                        )}


                        {/* Respuestas abiertas */}
                        {resultadoDetalle?.abiertasPorCompetencia?.length > 0 && (
                            <div style={{ background: "white", padding: 20, borderRadius: 14 }}>
                                <h3 style={{ marginBottom: 16, color: "black" }}>📝 Respuestas abiertas por competencia</h3>

                                {resultadoDetalle.abiertasPorCompetencia.map((item: any, qidx: number) => {
                                    // Filas: una por respuesta
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
                                            {/* Título = Pregunta */}
                                            <h4 style={{ margin: "0 0 12px 0", color: "#111827" }}>{item.pregunta}</h4>

                                            <DataTable
                                                rows={filas}
                                                columns={cols}
                                                getSearchText={(r) => r.respuesta}
                                                initialPageSize={5}   // 5 por defecto
                                                searchable={false}
                                            // pageSizeOptions={[5, 10, 25]} // descomenta si tu DataTable soporta cambiar tamaño
                                            />
                                        </section>
                                    );
                                })}
                            </div>
                        )}


                    </section>
                )}
            </div>
        </div>
    );
}