// src/hooks/useResultados.ts
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    apiFetchEvaluados,
    apiFetchEvaluaciones,
    apiFetchRespuestasPorEvaluaciones,
    apiGetCiclo
} from '../services/api';
import { apiFetchCompetenciasConCargosPorCiclo } from '../services/api';
import { procesarResultadosEvaluacion } from '../utils/resultados/procesarResultados';
import type { ResultadoEvaluado } from '../types/resultados.types';

/**
 * Hook principal para gestionar la carga y estado de los resultados de evaluación
 */
export function useResultados() {
    const [resultados, setResultados] = useState<ResultadoEvaluado[]>([]);
    const [competencias, setCompetencias] = useState<any[]>([]);
    const [nombreCiclo, setNombreCiclo] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [evaluadoSeleccionado, setEvaluadoSeleccionado] = useState<number | null>(null);

    const cicloActivoId = localStorage.getItem('ciclo_activo_id') || '1';

    /**
     * Calcula la escala máxima de las competencias Likert
     */
    const escalaMaxLikert = useMemo(() => {
        if (!competencias || competencias.length === 0) return undefined;

        const likert = competencias.filter((c: any) => c.tipo === 'likert');
        if (likert.length === 0) return undefined;

        const max = Math.max(...likert.map((c: any) => (c.escala_max ?? 0)));
        return Number.isFinite(max) && max > 0 ? max : undefined;
    }, [competencias]);

    /**
     * Obtiene el resultado detallado del evaluado seleccionado
     */
    const resultadoDetalle = useMemo(() => {
        if (!evaluadoSeleccionado) return null;
        return resultados.find(r => r.evaluado.id === evaluadoSeleccionado) || null;
    }, [evaluadoSeleccionado, resultados]);

    /**
     * Obtiene las competencias solo de tipo Likert (no texto)
     */
    const competenciasLikert = useMemo(() => {
        return competencias.filter((c: any) => c.tipo !== 'texto');
    }, [competencias]);

    /**
     * Carga todos los datos necesarios y procesa los resultados
     */
    const cargarResultados = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Obtener información del ciclo
            const ciclo = await apiGetCiclo(Number(cicloActivoId));
            if (ciclo) {
                setNombreCiclo(ciclo.nombre);
            }

            // Cargar datos en paralelo para optimizar
            const [evaluados, evaluaciones, comps] = await Promise.all([
                apiFetchEvaluados(),
                apiFetchEvaluaciones(Number(cicloActivoId)),
                apiFetchCompetenciasConCargosPorCiclo(Number(cicloActivoId))
            ]);

            // Cargar todas las respuestas
            const todasLasRespuestas = await apiFetchRespuestasPorEvaluaciones(
                evaluaciones.map(e => e.id)
            );

            setCompetencias(comps);

            // Procesar resultados usando la función utilitaria
            const resultadosProcesados = await procesarResultadosEvaluacion(
                evaluados,
                evaluaciones,
                comps,
                todasLasRespuestas
            );

            setResultados(resultadosProcesados);
        } catch (e: any) {
            console.error('Error cargando resultados:', e);
            setError(e?.message ?? 'Error cargando resultados');
        } finally {
            setLoading(false);
        }
    }, [cicloActivoId]);

    // Cargar resultados al montar el componente
    useEffect(() => {
        cargarResultados();
    }, [cargarResultados]);

    return {
        // Datos
        resultados,
        competencias,
        competenciasLikert,
        nombreCiclo,
        cicloActivoId,
        
        // Estados
        loading,
        error,
        
        // Selección de evaluado
        evaluadoSeleccionado,
        setEvaluadoSeleccionado,
        resultadoDetalle,
        
        // Configuración
        escalaMaxLikert,
        
        // Acciones
        recargar: cargarResultados
    };
}