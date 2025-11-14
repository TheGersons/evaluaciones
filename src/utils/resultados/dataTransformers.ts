
// ===========================================
// 4. utils/resultados/dataTransformers.ts
// ===========================================

import type { ResultadoEvaluado, ModoMetricas, CargoData, RadarDimensionData, RadarGrupoData, RankingData } from '../../types/resultados.types';




export function transformToGrupoCargData(
    dimension: string,
    gruposPorCargo: Record<string, Record<string, number>>,
    countsPorGrupoYCargo: Record<string, Record<string, Record<string, number>>>,
    cargosOrdenados: string[],
    modoMetricas: ModoMetricas
) {
    const grupos = Object.keys(gruposPorCargo);
    
    return cargosOrdenados.map(cargo => {
        const row: any = { cargo };

        for (const grupo of grupos) {
            const suma = gruposPorCargo[grupo]?.[cargo] ?? 0;
            const count = countsPorGrupoYCargo?.[dimension]?.[grupo]?.[cargo] ?? 0;

            const valor = modoMetricas === 'suma' ? suma : count > 0 ? suma / count : 0;
            row[grupo] = Number(valor.toFixed(2));
        }

        return row;
    });
}


export function transformToRankingData(resultados: ResultadoEvaluado[]): RankingData[] {
    return resultados.map(r => ({
        nombre: r.evaluado.nombre.split(' ')[0], // Solo primer nombre
        promedio: parseFloat(r.promedioGeneral.toFixed(2))
    }));
}

/**
 * Transforma datos para el radar de dimensiones generales
 */
export function transformToRadarDimensionData(resultado: ResultadoEvaluado): RadarDimensionData[] {
    return Object.entries(resultado.promediosPorDimension).map(([dimension, valor]) => ({
        dimension,
        valor: parseFloat(valor.toFixed(2))
    }));
}

/**
 * Transforma datos para el radar de grupos/habilidades
 */
export function transformToRadarGruposData(resultado: ResultadoEvaluado): RadarGrupoData[] {
    return Object.entries(resultado.promediosPorGrupo).map(([grupo, promedio]) => ({
        grupo,
        promedio: parseFloat(promedio.toFixed(2))
    }));
}

/**
 * Transforma datos para el gráfico de barras por cargo
 */
export function transformToCargosData(resultado: ResultadoEvaluado): CargoData[] {
    return Object.entries(resultado.promediosPorCargo).map(([cargo, promedio]) => ({
        cargo,
        promedio: parseFloat(promedio.toFixed(2))
    }));
}

/**
 * Transforma datos para gráfico de Dimensiones vs Cargos
 */
export function transformToDimensionCargoData(
    resultado: ResultadoEvaluado,
    cargosOrdenados: string[],
    dimensiones: string[],
    modoMetricas: ModoMetricas
): any[] {
    return cargosOrdenados.map(cargo => {
        const row: any = { cargo };

        for (const dim of dimensiones) {
            const suma = resultado.sumasPorDimensionYCargo[dim]?.[cargo] ?? 0;
            const count = resultado.countsPorDimensionYCargo[dim]?.[cargo] ?? 0;

            const valor = modoMetricas === 'suma' 
                ? suma 
                : count > 0 ? suma / count : 0;
            
            row[dim] = Number(valor.toFixed(2));
        }

        return row;
    });
}

/**
 * Transforma datos para gráfico de Grupos dentro de una Dimensión por Cargo
 */
export function transformToGrupoCargoData(
    dimension: string,
    gruposPorCargo: Record<string, Record<string, number>>,
    countsPorGrupoYCargo: Record<string, Record<string, Record<string, number>>>,
    cargosOrdenados: string[],
    modoMetricas: ModoMetricas
): { data: any[], grupos: string[] } {
    const grupos = Object.keys(gruposPorCargo);
    
    const data = cargosOrdenados.map(cargo => {
        const row: any = { cargo };

        for (const grupo of grupos) {
            const suma = gruposPorCargo[grupo]?.[cargo] ?? 0;
            const count = countsPorGrupoYCargo?.[dimension]?.[grupo]?.[cargo] ?? 0;

            const valor = modoMetricas === 'suma' 
                ? suma 
                : count > 0 ? suma / count : 0;
            
            row[grupo] = Number(valor.toFixed(2));
        }

        return row;
    });

    return { data, grupos };
}

/**
 * Prepara filas para la tabla de competencias
 */
export function transformToCompetenciasTableRows(
    competencias: any[],
    promediosPorCompetencia: Record<number, number>
) {
    return competencias
        .filter(c => c.tipo !== "texto")
        .map(c => ({
            id: c.id,
            dimension: c.dimension_general || "N/A",
            titulo: c.titulo,
            valor: (promediosPorCompetencia?.[c.id] ?? 0) as number,
        }));
}

/**
 * Normaliza texto para comparación (sin acentos, lowercase)
 */
export function normalizeText(text?: string): string {
    return (text ?? "N/A")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}