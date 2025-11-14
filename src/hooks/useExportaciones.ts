// src/hooks/useExportaciones.ts
import { useCallback } from 'react';
import { exportarExcel as exportarExcelUtil } from '../utils/resultados/exportUtils';
import type { ResultadoEvaluado } from '../types/resultados.types';

/**
 * Hook para gestionar las exportaciones de datos
 */
export function useExportaciones(
    resultados: ResultadoEvaluado[],
    competencias: any[],
    nombreCiclo: string
) {
    /**
     * Exporta los resultados como archivo CSV/Excel
     */
    const exportarExcel = useCallback(() => {
        const competenciasLikert = competencias.filter((c: any) => c.tipo !== 'texto');
        exportarExcelUtil(resultados, competenciasLikert, nombreCiclo);
    }, [resultados, competencias, nombreCiclo]);

    return {
        exportarExcel
    };
}