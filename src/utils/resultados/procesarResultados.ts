// src/utils/resultados/procesarResultados.ts
import type { EvaluadoDTO, RespuestaDTO } from '../../types';
import type { ResultadoEvaluado } from '../../types/resultados.types';

/**
 * Procesa los datos brutos de evaluaciones y genera resultados estructurados
 */
export async function procesarResultadosEvaluacion(
    evaluados: EvaluadoDTO[],
    evaluaciones: any[],
    competencias: any[],
    todasLasRespuestas: RespuestaDTO[]
): Promise<ResultadoEvaluado[]> {
    const resultadosProcesados: ResultadoEvaluado[] = [];

    // Crear mapas para acceso rápido
    const compById = new Map(competencias.map((c: any) => [c.id, c]));
    const evalById = new Map(evaluaciones.map(e => [e.id, e]));

    for (const evaluado of evaluados) {
        // Filtrar evaluaciones de este evaluado
        const evals = evaluaciones.filter(e => e.evaluado_id === evaluado.id);
        if (evals.length === 0) continue;

        const evalIds = new Set(evals.map(e => e.id));
        const respuestasDeEvaluado: RespuestaDTO[] = todasLasRespuestas.filter(
            r => evalIds.has(r.evaluacion_id)
        );

        // 1. PROCESAR RESPUESTAS ABIERTAS
        const abiertasMap: Record<number, string[]> = {};
        
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

        // 2. PROMEDIOS POR COMPETENCIA (solo Likert)
        const promediosPorCompetencia: Record<number, number> = {};
        
        competencias.forEach(comp => {
            if (comp.tipo === 'texto') return;

            const respuestasComp = respuestasDeEvaluado.filter(
                r => r.competencia_id === comp.id
            );
            
            if (respuestasComp.length > 0) {
                const suma = respuestasComp.reduce((acc, r) => acc + r.valor, 0);
                promediosPorCompetencia[comp.id] = suma / respuestasComp.length;
            }
        });

        // 3. INICIALIZAR MAPAS DE SUMAS Y CONTEOS
        const sumPorCargo: Record<string, number> = {};
        const countPorCargo: Record<string, number> = {};
        const sumasPorDimensionYCargo: Record<string, Record<string, number>> = {};
        const countsPorDimensionYCargo: Record<string, Record<string, number>> = {};
        const sumasPorGrupoYCargo: Record<string, Record<string, Record<string, number>>> = {};
        const countsPorGrupoYCargo: Record<string, Record<string, Record<string, number>>> = {};

        // 4. PROCESAR CADA RESPUESTA
        for (const r of respuestasDeEvaluado) {
            const comp = compById.get(r.competencia_id);
            if (!comp || comp.tipo === 'texto') continue;

            const evaluacion = evalById.get(r.evaluacion_id);
            const cargoBase = evaluacion?.cargo_evaluador || 'Sin cargo';
            const cargo = cargoBase.trim() || 'Sin cargo';

            const dimensionBase = comp.dimension_general || 'Sin dimensión';
            const dimension = dimensionBase.trim() || 'Sin dimensión';

            const grupoBase = comp.grupo || 'Sin grupo';
            const grupo = grupoBase.trim() || 'Sin grupo';

            // Sumas y conteos por cargo
            if (!sumPorCargo[cargo]) {
                sumPorCargo[cargo] = 0;
                countPorCargo[cargo] = 0;
            }
            sumPorCargo[cargo] += r.valor;
            countPorCargo[cargo] += 1;

            // Sumas y conteos por dimensión y cargo
            if (!sumasPorDimensionYCargo[dimension]) {
                sumasPorDimensionYCargo[dimension] = {};
                countsPorDimensionYCargo[dimension] = {};
            }
            if (!sumasPorDimensionYCargo[dimension][cargo]) {
                sumasPorDimensionYCargo[dimension][cargo] = 0;
                countsPorDimensionYCargo[dimension][cargo] = 0;
            }
            sumasPorDimensionYCargo[dimension][cargo] += r.valor;
            countsPorDimensionYCargo[dimension][cargo] += 1;

            // Sumas y conteos por grupo y cargo dentro de cada dimensión
            if (!sumasPorGrupoYCargo[dimension]) {
                sumasPorGrupoYCargo[dimension] = {};
                countsPorGrupoYCargo[dimension] = {};
            }
            if (!sumasPorGrupoYCargo[dimension][grupo]) {
                sumasPorGrupoYCargo[dimension][grupo] = {};
                countsPorGrupoYCargo[dimension][grupo] = {};
            }
            if (!sumasPorGrupoYCargo[dimension][grupo][cargo]) {
                sumasPorGrupoYCargo[dimension][grupo][cargo] = 0;
                countsPorGrupoYCargo[dimension][grupo][cargo] = 0;
            }
            sumasPorGrupoYCargo[dimension][grupo][cargo] += r.valor;
            countsPorGrupoYCargo[dimension][grupo][cargo] += 1;
        }

        // 5. CALCULAR PROMEDIOS POR DIMENSIÓN
        const promediosPorDimension: Record<string, number> = {};
        const dimensionesSet = new Set<string>();
        
        competencias.forEach(comp => {
            if (comp.tipo === 'likert' && comp.dimension_general) {
                dimensionesSet.add(comp.dimension_general);
            }
        });

        dimensionesSet.forEach(dimension => {
            const compsEnDimension = competencias.filter(
                (c: any) => c.dimension_general === dimension && c.tipo === 'likert'
            );

            if (compsEnDimension.length === 0) return;

            const promedios = compsEnDimension
                .map((c: any) => promediosPorCompetencia[c.id])
                .filter((p: number | undefined): p is number => p !== undefined);

            if (promedios.length > 0) {
                promediosPorDimension[dimension] =
                    promedios.reduce((a: number, b: number) => a + b, 0) / promedios.length;
            }
        });

        // 6. CALCULAR PROMEDIOS POR HABILIDAD
        const promediosPorHabilidad: Record<string, number> = {};
        const habilidadesAgrupadas = new Map<string, number[]>();

        competencias.forEach(comp => {
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
            promediosPorHabilidad[titulo] = 
                valores.reduce((a, b) => a + b, 0) / valores.length;
        });

        // 7. CALCULAR PROMEDIO GENERAL
        const valores = Object.values(promediosPorCompetencia);
        const promedioGeneral = valores.length > 0
            ? valores.reduce((a, b) => a + b, 0) / valores.length
            : 0;

        // 8. CALCULAR PROMEDIOS POR CARGO
        const promediosPorCargo: Record<string, number> = {};
        Object.keys(sumPorCargo).forEach(cargo => {
            const total = sumPorCargo[cargo];
            const count = countPorCargo[cargo] || 1;
            promediosPorCargo[cargo] = total / count;
        });

        // 9. CALCULAR PROMEDIOS POR GRUPO
        const promediosPorGrupo: Record<string, number> = {};
        const gruposAgrupados = new Map<string, number[]>();

        competencias.forEach(comp => {
            if (comp.tipo === 'texto') return;
            const promedio = promediosPorCompetencia[comp.id];
            if (promedio !== undefined) {
                const nombreGrupo = comp.grupo ?? "";
                if (!gruposAgrupados.has(nombreGrupo)) {
                    gruposAgrupados.set(nombreGrupo, []);
                }
                gruposAgrupados.get(nombreGrupo)!.push(promedio);
            }
        });

        gruposAgrupados.forEach((valoresGrupo, grupo) => {
            promediosPorGrupo[grupo] = 
                valoresGrupo.reduce((a, b) => a + b, 0) / valoresGrupo.length;
        });

        // 10. EXTRAER COMENTARIOS
        const comentarios = evals
            .map(e => e.comentarios)
            .filter(c => c && c.trim().length > 0) as string[];

        // 11. CREAR RESULTADO
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
            promediosPorGrupo,
            sumasPorDimensionYCargo,
            sumasPorGrupoYCargo,
            countsPorDimensionYCargo,
            countsPorGrupoYCargo
        });
    }

    // 12. ORDENAR POR PROMEDIO GENERAL (descendente)
    resultadosProcesados.sort((a, b) => b.promedioGeneral - a.promedioGeneral);

    return resultadosProcesados;
}