-- =====================================================
-- MIGRACIÓN: Soporte para múltiples evaluaciones
-- =====================================================

-- 1. Crear tabla de periodos/ciclos de evaluación
CREATE TABLE public.periodos_evaluacion (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    activo BOOLEAN DEFAULT false NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT unique_nombre_periodo UNIQUE (nombre),
    CONSTRAINT chk_fechas_validas CHECK (fecha_fin >= fecha_inicio)
);

COMMENT ON TABLE public.periodos_evaluacion IS 'Periodos o ciclos de evaluación (ej: Q1 2025, Evaluación Anual 2024)';
COMMENT ON COLUMN public.periodos_evaluacion.activo IS 'Solo puede haber un periodo activo a la vez';

-- Índice para búsquedas por estado activo
CREATE INDEX idx_periodos_activo ON public.periodos_evaluacion(activo) WHERE activo = true;

-- =====================================================
-- 2. Agregar columna periodo_id a las tablas existentes
-- =====================================================

-- Primero, crear un periodo "default" para datos existentes
INSERT INTO public.periodos_evaluacion (nombre, descripcion, fecha_inicio, fecha_fin, activo)
VALUES (
    'Evaluación Inicial',
    'Periodo creado automáticamente para migrar datos existentes',
    '2025-01-01',
    '2025-12-31',
    true
) RETURNING id;

-- Guardar el ID del periodo default (ajustar según el ID retornado)
DO $$
DECLARE
    default_periodo_id BIGINT;
BEGIN
    SELECT id INTO default_periodo_id 
    FROM periodos_evaluacion 
    WHERE nombre = 'Evaluación Inicial';

    -- Agregar columna periodo_id a evaluadores
    ALTER TABLE public.evaluadores 
    ADD COLUMN periodo_id BIGINT;

    -- Migrar datos existentes al periodo default
    UPDATE public.evaluadores 
    SET periodo_id = default_periodo_id 
    WHERE periodo_id IS NULL;

    -- Hacer la columna NOT NULL después de migrar
    ALTER TABLE public.evaluadores 
    ALTER COLUMN periodo_id SET NOT NULL;

    -- Agregar foreign key
    ALTER TABLE public.evaluadores
    ADD CONSTRAINT fk_evaluadores_periodo 
    FOREIGN KEY (periodo_id) REFERENCES public.periodos_evaluacion(id) ON DELETE RESTRICT;

    -- Agregar periodo_id a evaluaciones
    ALTER TABLE public.evaluaciones 
    ADD COLUMN periodo_id BIGINT;

    UPDATE public.evaluaciones 
    SET periodo_id = default_periodo_id 
    WHERE periodo_id IS NULL;

    ALTER TABLE public.evaluaciones 
    ALTER COLUMN periodo_id SET NOT NULL;

    ALTER TABLE public.evaluaciones
    ADD CONSTRAINT fk_evaluaciones_periodo 
    FOREIGN KEY (periodo_id) REFERENCES public.periodos_evaluacion(id) ON DELETE RESTRICT;

    -- Agregar periodo_id a competencias (para versionar competencias por periodo)
    ALTER TABLE public.competencias 
    ADD COLUMN periodo_id BIGINT;

    UPDATE public.competencias 
    SET periodo_id = default_periodo_id 
    WHERE periodo_id IS NULL;

    -- NO hacemos NOT NULL en competencias para permitir competencias globales
    -- pero agregamos FK
    ALTER TABLE public.competencias
    ADD CONSTRAINT fk_competencias_periodo 
    FOREIGN KEY (periodo_id) REFERENCES public.periodos_evaluacion(id) ON DELETE RESTRICT;
END $$;

-- =====================================================
-- 3. Crear índices para mejorar rendimiento
-- =====================================================

CREATE INDEX idx_evaluadores_periodo ON public.evaluadores(periodo_id);
CREATE INDEX idx_evaluaciones_periodo ON public.evaluaciones(periodo_id);
CREATE INDEX idx_competencias_periodo ON public.competencias(periodo_id);

-- =====================================================
-- 4. Función para validar un solo periodo activo
-- =====================================================

CREATE OR REPLACE FUNCTION public.validar_unico_periodo_activo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activo = true THEN
        -- Desactivar todos los demás periodos
        UPDATE public.periodos_evaluacion
        SET activo = false
        WHERE id != NEW.id AND activo = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unico_periodo_activo
    BEFORE INSERT OR UPDATE ON public.periodos_evaluacion
    FOR EACH ROW
    EXECUTE FUNCTION public.validar_unico_periodo_activo();

-- =====================================================
-- 5. Función para clonar competencias a nuevo periodo
-- =====================================================

CREATE OR REPLACE FUNCTION public.clonar_competencias_a_periodo(
    p_periodo_destino_id BIGINT,
    p_periodo_origen_id BIGINT DEFAULT NULL
)
RETURNS TABLE(competencias_clonadas INT) AS $$
DECLARE
    v_origen_id BIGINT;
    v_count INT := 0;
BEGIN
    -- Si no se especifica origen, usar el periodo activo anterior
    IF p_periodo_origen_id IS NULL THEN
        SELECT id INTO v_origen_id
        FROM periodos_evaluacion
        WHERE id != p_periodo_destino_id
        ORDER BY fecha_creacion DESC
        LIMIT 1;
    ELSE
        v_origen_id := p_periodo_origen_id;
    END IF;

    -- Clonar competencias
    INSERT INTO public.competencias (
        clave, titulo, descripcion, orden, activa, tipo, grupo,
        escala_min, escala_max, etiqueta_min, etiqueta_max, periodo_id
    )
    SELECT 
        clave, titulo, descripcion, orden, activa, tipo, grupo,
        escala_min, escala_max, etiqueta_min, etiqueta_max, p_periodo_destino_id
    FROM public.competencias
    WHERE periodo_id = v_origen_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Clonar relaciones de cargos
    INSERT INTO public.competencias_aplica_cargo (competencia_id, cargo)
    SELECT 
        nc.id, cac.cargo
    FROM public.competencias c
    JOIN public.competencias_aplica_cargo cac ON cac.competencia_id = c.id
    JOIN public.competencias nc ON nc.clave = c.clave AND nc.periodo_id = p_periodo_destino_id
    WHERE c.periodo_id = v_origen_id;

    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.clonar_competencias_a_periodo IS 
'Clona competencias y sus relaciones de cargos desde un periodo a otro';

-- =====================================================
-- 6. Vista para dashboard con periodo activo
-- =====================================================

CREATE OR REPLACE VIEW public.vista_dashboard_activo AS
SELECT 
    p.id AS periodo_id,
    p.nombre AS periodo_nombre,
    COUNT(DISTINCT ev.id) AS total_evaluadores,
    COUNT(DISTINCT ed.id) AS total_evaluados,
    COUNT(DISTINCT e.id) AS total_evaluaciones,
    COUNT(DISTINCT CASE WHEN ev.estado = 'Pendiente' THEN ev.id END) AS evaluadores_pendientes,
    COUNT(DISTINCT CASE WHEN ev.estado = 'Completada' THEN ev.id END) AS evaluadores_completados,
    COUNT(DISTINCT c.id) FILTER (WHERE c.activa = true) AS competencias_activas
FROM public.periodos_evaluacion p
LEFT JOIN public.evaluadores ev ON ev.periodo_id = p.id
LEFT JOIN public.evaluados ed ON ed.id = ev.evaluado_id
LEFT JOIN public.evaluaciones e ON e.periodo_id = p.id
LEFT JOIN public.competencias c ON c.periodo_id = p.id
WHERE p.activo = true
GROUP BY p.id, p.nombre;

-- =====================================================
-- 7. Restricción: No editar competencias si periodo tiene evaluaciones
-- =====================================================

CREATE OR REPLACE FUNCTION public.validar_edicion_competencia()
RETURNS TRIGGER AS $$
DECLARE
    v_tiene_evaluaciones BOOLEAN;
    v_periodo_activo BOOLEAN;
BEGIN
    -- Verificar si la competencia tiene evaluaciones completadas
    SELECT EXISTS(
        SELECT 1
        FROM public.respuestas r
        JOIN public.evaluaciones e ON e.id = r.evaluacion_id
        WHERE r.competencia_id = NEW.id
        AND e.periodo_id = NEW.periodo_id
    ) INTO v_tiene_evaluaciones;

    -- Verificar si el periodo está activo
    SELECT activo INTO v_periodo_activo
    FROM public.periodos_evaluacion
    WHERE id = NEW.periodo_id;

    -- Si tiene evaluaciones Y el periodo está activo, solo permitir cambiar 'activa'
    IF v_tiene_evaluaciones AND v_periodo_activo THEN
        IF OLD.clave IS DISTINCT FROM NEW.clave OR
           OLD.titulo IS DISTINCT FROM NEW.titulo OR
           OLD.descripcion IS DISTINCT FROM NEW.descripcion OR
           OLD.tipo IS DISTINCT FROM NEW.tipo THEN
            RAISE EXCEPTION 'No se puede editar una competencia con evaluaciones completadas en un periodo activo. Desactive el periodo primero.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_edicion_competencia
    BEFORE UPDATE ON public.competencias
    FOR EACH ROW
    EXECUTE FUNCTION public.validar_edicion_competencia();

-- =====================================================
-- 8. Grants para usuario evaluaciones_user
-- =====================================================

GRANT ALL ON public.periodos_evaluacion TO evaluaciones_user;
GRANT ALL ON SEQUENCE public.periodos_evaluacion_id_seq TO evaluaciones_user;

-- =====================================================
-- 9. Datos de ejemplo (opcional - comentado)
-- =====================================================

/*
-- Crear periodo Q1 2025
INSERT INTO public.periodos_evaluacion (nombre, descripcion, fecha_inicio, fecha_fin, activo)
VALUES (
    'Q1 2025',
    'Evaluación primer trimestre 2025',
    '2025-01-01',
    '2025-03-31',
    false
);

-- Clonar competencias al nuevo periodo
SELECT * FROM public.clonar_competencias_a_periodo(
    (SELECT id FROM periodos_evaluacion WHERE nombre = 'Q1 2025'),
    (SELECT id FROM periodos_evaluacion WHERE nombre = 'Evaluación Inicial')
);
*/

-- =====================================================
-- 10. Verificación de migración
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada exitosamente';
    RAISE NOTICE 'Total periodos: %', (SELECT COUNT(*) FROM periodos_evaluacion);
    RAISE NOTICE 'Periodo activo: %', (SELECT nombre FROM periodos_evaluacion WHERE activo = true);
    RAISE NOTICE 'Evaluadores migrados: %', (SELECT COUNT(*) FROM evaluadores WHERE periodo_id IS NOT NULL);
    RAISE NOTICE 'Evaluaciones migradas: %', (SELECT COUNT(*) FROM evaluaciones WHERE periodo_id IS NOT NULL);
END $$;