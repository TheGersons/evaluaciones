--
-- PostgreSQL database dump
--

\restrict qme3FQuVXlnzuQavUGA7R9U1IoTCMTqLOJUJEqFDpcBvCqKCQWJCLyQwzhlpzgw

-- Dumped from database version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 18.0

-- Started on 2025-11-24 17:18:36

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 3582 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 239 (class 1255 OID 24807)
-- Name: actualizar_fecha_modificacion(); Type: FUNCTION; Schema: public; Owner: evaluaciones_user
--

CREATE FUNCTION public.actualizar_fecha_modificacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.fecha_actualizacion = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_fecha_modificacion() OWNER TO evaluaciones_user;

--
-- TOC entry 238 (class 1255 OID 24806)
-- Name: agregar_competencias_a_ciclo(bigint, bigint[]); Type: FUNCTION; Schema: public; Owner: evaluaciones_user
--

CREATE FUNCTION public.agregar_competencias_a_ciclo(p_ciclo_id bigint, p_competencia_ids bigint[]) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count INT := 0;
    comp_id BIGINT;
BEGIN
    FOREACH comp_id IN ARRAY p_competencia_ids
    LOOP
        INSERT INTO public.ciclos_competencias (ciclo_id, competencia_id, activa)
        VALUES (p_ciclo_id, comp_id, true)
        ON CONFLICT (ciclo_id, competencia_id) DO NOTHING;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;


ALTER FUNCTION public.agregar_competencias_a_ciclo(p_ciclo_id bigint, p_competencia_ids bigint[]) OWNER TO evaluaciones_user;

--
-- TOC entry 237 (class 1255 OID 24805)
-- Name: clonar_ciclo(bigint, text, text, boolean); Type: FUNCTION; Schema: public; Owner: evaluaciones_user
--

CREATE FUNCTION public.clonar_ciclo(p_ciclo_origen_id bigint, p_nuevo_nombre text, p_descripcion text DEFAULT NULL::text, p_clonar_evaluadores boolean DEFAULT false) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_nuevo_ciclo_id BIGINT;
BEGIN
    -- Crear nuevo ciclo
    INSERT INTO public.ciclos_evaluacion (nombre, descripcion, fecha_inicio, estado)
    VALUES (
        p_nuevo_nombre,
        COALESCE(p_descripcion, 'Clonado desde: ' || (SELECT nombre FROM ciclos_evaluacion WHERE id = p_ciclo_origen_id)),
        CURRENT_DATE,
        'borrador'
    )
    RETURNING id INTO v_nuevo_ciclo_id;

    -- Clonar relación con competencias
    INSERT INTO public.ciclos_competencias (ciclo_id, competencia_id, activa)
    SELECT v_nuevo_ciclo_id, competencia_id, activa
    FROM public.ciclos_competencias
    WHERE ciclo_id = p_ciclo_origen_id;

    -- Opcionalmente clonar evaluadores (sin evaluaciones)
    IF p_clonar_evaluadores THEN
        INSERT INTO public.evaluadores (nombre, email, cargo, evaluado_id, ciclo_id, estado)
        SELECT nombre, email, cargo, evaluado_id, v_nuevo_ciclo_id, 'Pendiente'
        FROM public.evaluadores
        WHERE ciclo_id = p_ciclo_origen_id;
    END IF;

    RETURN v_nuevo_ciclo_id;
END;
$$;


ALTER FUNCTION public.clonar_ciclo(p_ciclo_origen_id bigint, p_nuevo_nombre text, p_descripcion text, p_clonar_evaluadores boolean) OWNER TO evaluaciones_user;

--
-- TOC entry 3584 (class 0 OID 0)
-- Dependencies: 237
-- Name: FUNCTION clonar_ciclo(p_ciclo_origen_id bigint, p_nuevo_nombre text, p_descripcion text, p_clonar_evaluadores boolean); Type: COMMENT; Schema: public; Owner: evaluaciones_user
--

COMMENT ON FUNCTION public.clonar_ciclo(p_ciclo_origen_id bigint, p_nuevo_nombre text, p_descripcion text, p_clonar_evaluadores boolean) IS 'Clona un ciclo completo con sus competencias. Opcionalmente clona evaluadores (sin sus evaluaciones).';


--
-- TOC entry 241 (class 1255 OID 24881)
-- Name: fn_ciclos_competencias_validar_dim_grupo(); Type: FUNCTION; Schema: public; Owner: evaluaciones_user
--

CREATE FUNCTION public.fn_ciclos_competencias_validar_dim_grupo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_comp public.competencias;
  v_dim  public.dimensions;
  v_grp  public.groups;
BEGIN
  -- 1) Obtener la competencia
  SELECT *
  INTO v_comp
  FROM public.competencias
  WHERE id = NEW.competencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competencia % no existe', NEW.competencia_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 2) Validar / resolver DIMENSIÓN por ciclo
  IF v_comp.dimension_general IS NOT NULL AND v_comp.dimension_general <> '' THEN
    SELECT *
    INTO v_dim
    FROM public.dimensions
    WHERE ciclo_id = NEW.ciclo_id
      AND nombre   = v_comp.dimension_general
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La dimensión "%" no existe para el ciclo %',
        v_comp.dimension_general, NEW.ciclo_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- opcional: alinear dimension_id en competencias
    IF v_comp.dimension_id IS DISTINCT FROM v_dim.id THEN
      UPDATE public.competencias
      SET dimension_id = v_dim.id
      WHERE id = v_comp.id;
    END IF;
  ELSE
    v_dim := NULL;
  END IF;

  -- 3) Validar / resolver GRUPO dentro de la dimensión
  IF v_comp.grupo IS NOT NULL AND v_comp.grupo <> '' THEN
    IF v_dim.id IS NULL THEN
      RAISE EXCEPTION 'No se puede asignar grupo "%" sin dimensión para la competencia %',
        v_comp.grupo, v_comp.id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT *
    INTO v_grp
    FROM public.groups
    WHERE dimension_id = v_dim.id
      AND nombre       = v_comp.grupo
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El grupo "%" no existe en la dimensión "%" (ciclo %)',
        v_comp.grupo, v_dim.nombre, NEW.ciclo_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- opcional: alinear grupo_id en competencias
    IF v_comp.grupo_id IS DISTINCT FROM v_grp.id THEN
      UPDATE public.competencias
      SET grupo_id = v_grp.id
      WHERE id = v_comp.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_ciclos_competencias_validar_dim_grupo() OWNER TO evaluaciones_user;

--
-- TOC entry 253 (class 1255 OID 24687)
-- Name: import_evaluadores_batch(jsonb); Type: FUNCTION; Schema: public; Owner: evaluaciones_user
--

CREATE FUNCTION public.import_evaluadores_batch(p_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  item jsonb;
  v_nombre           text;
  v_email            text;
  v_cargo            text;
  v_evaluado_nombre  text;
  v_evaluado_id      bigint;
  inserted_count     int := 0;
  idx                int := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un arreglo JSON';
  END IF;

  FOR item IN SELECT jsonb_array_elements(p_items)
  LOOP
    idx := idx + 1;

    v_nombre          := trim(item->>'nombre');
    v_email           := trim(item->>'email');
    v_cargo           := trim(item->>'cargo');
    v_evaluado_nombre := trim(item->>'evaluado_nombre');

    IF v_nombre IS NULL OR v_nombre = '' THEN
      RAISE EXCEPTION 'Fila %: nombre vacío', idx;
    END IF;
    IF v_email IS NULL OR v_email = '' THEN
      RAISE EXCEPTION 'Fila %: email vacío para %', idx, v_nombre;
    END IF;
    IF v_evaluado_nombre IS NULL OR v_evaluado_nombre = '' THEN
      RAISE EXCEPTION 'Fila %: nombre de evaluado vacío para %', idx, v_nombre;
    END IF;
    IF v_cargo IS NULL OR v_cargo = '' THEN
      RAISE EXCEPTION 'Fila %: cargo vacío para %', idx, v_nombre;
    END IF;

    -- Buscar evaluado por nombre (case-insensitive, espacios ignorados al borde)
    SELECT e.id
    INTO v_evaluado_id
    FROM evaluados e
    WHERE trim(lower(e.nombre)) = trim(lower(v_evaluado_nombre));

    IF v_evaluado_id IS NULL THEN
      RAISE EXCEPTION 'Fila %: no se encontró evaluado con nombre "%"', idx, v_evaluado_nombre;
    END IF;

    INSERT INTO evaluadores(nombre, email, cargo, evaluado_id)
    VALUES (v_nombre, v_email, v_cargo, v_evaluado_id);

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('insertados', inserted_count);
END;
$$;


ALTER FUNCTION public.import_evaluadores_batch(p_items jsonb) OWNER TO evaluaciones_user;

--
-- TOC entry 240 (class 1255 OID 24809)
-- Name: validar_eliminacion_ciclo(); Type: FUNCTION; Schema: public; Owner: evaluaciones_user
--

CREATE FUNCTION public.validar_eliminacion_ciclo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM evaluaciones WHERE ciclo_id = OLD.id) THEN
        RAISE EXCEPTION 'No se puede eliminar un ciclo con evaluaciones completadas. Cambie el estado a "finalizada" en su lugar.';
    END IF;
    RETURN OLD;
END;
$$;


ALTER FUNCTION public.validar_eliminacion_ciclo() OWNER TO evaluaciones_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 230 (class 1259 OID 24768)
-- Name: ciclos_competencias; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.ciclos_competencias (
    ciclo_id bigint NOT NULL,
    competencia_id bigint NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    fecha_agregada timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ciclos_competencias OWNER TO evaluaciones_user;

--
-- TOC entry 3585 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE ciclos_competencias; Type: COMMENT; Schema: public; Owner: evaluaciones_user
--

COMMENT ON TABLE public.ciclos_competencias IS 'Competencias asignadas a cada ciclo de evaluación. Permite reutilizar competencias entre ciclos.';


--
-- TOC entry 229 (class 1259 OID 24752)
-- Name: ciclos_evaluacion; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.ciclos_evaluacion (
    id bigint NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    estado text DEFAULT 'activa'::text NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ciclos_evaluacion_estado_check CHECK ((estado = ANY (ARRAY['activa'::text, 'pausada'::text, 'finalizada'::text, 'borrador'::text])))
);


ALTER TABLE public.ciclos_evaluacion OWNER TO evaluaciones_user;

--
-- TOC entry 3586 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE ciclos_evaluacion; Type: COMMENT; Schema: public; Owner: evaluaciones_user
--

COMMENT ON TABLE public.ciclos_evaluacion IS 'Ciclos o proyectos de evaluación independientes que pueden ejecutarse en paralelo';


--
-- TOC entry 3587 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN ciclos_evaluacion.estado; Type: COMMENT; Schema: public; Owner: evaluaciones_user
--

COMMENT ON COLUMN public.ciclos_evaluacion.estado IS 'activa: se pueden crear evaluadores | pausada: no se crean nuevos evaluadores | finalizada: solo lectura | borrador: en configuración';


--
-- TOC entry 228 (class 1259 OID 24751)
-- Name: ciclos_evaluacion_id_seq; Type: SEQUENCE; Schema: public; Owner: evaluaciones_user
--

CREATE SEQUENCE public.ciclos_evaluacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ciclos_evaluacion_id_seq OWNER TO evaluaciones_user;

--
-- TOC entry 3588 (class 0 OID 0)
-- Dependencies: 228
-- Name: ciclos_evaluacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: evaluaciones_user
--

ALTER SEQUENCE public.ciclos_evaluacion_id_seq OWNED BY public.ciclos_evaluacion.id;


--
-- TOC entry 220 (class 1259 OID 24609)
-- Name: competencias; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.competencias (
    id bigint NOT NULL,
    clave text NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    orden integer DEFAULT 0 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    tipo text DEFAULT 'likert'::text NOT NULL,
    grupo text,
    escala_min integer DEFAULT 1 NOT NULL,
    escala_max integer DEFAULT 5 NOT NULL,
    etiqueta_min text DEFAULT 'Muy bajo'::text NOT NULL,
    etiqueta_max text DEFAULT 'Excelente'::text NOT NULL,
    dimension_general text
);


ALTER TABLE public.competencias OWNER TO evaluaciones_user;

--
-- TOC entry 3589 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN competencias.dimension_general; Type: COMMENT; Schema: public; Owner: evaluaciones_user
--

COMMENT ON COLUMN public.competencias.dimension_general IS 'Agrupación de alto nivel: Fiabilidad, Armonía, Interés';


--
-- TOC entry 221 (class 1259 OID 24626)
-- Name: competencias_aplica_cargo; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.competencias_aplica_cargo (
    competencia_id bigint NOT NULL,
    cargo text NOT NULL
);


ALTER TABLE public.competencias_aplica_cargo OWNER TO evaluaciones_user;

--
-- TOC entry 219 (class 1259 OID 24608)
-- Name: competencias_id_seq; Type: SEQUENCE; Schema: public; Owner: evaluaciones_user
--

CREATE SEQUENCE public.competencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competencias_id_seq OWNER TO evaluaciones_user;

--
-- TOC entry 3590 (class 0 OID 0)
-- Dependencies: 219
-- Name: competencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: evaluaciones_user
--

ALTER SEQUENCE public.competencias_id_seq OWNED BY public.competencias.id;


--
-- TOC entry 225 (class 1259 OID 24676)
-- Name: configuracion; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.configuracion (
    clave text NOT NULL,
    valor text NOT NULL
);


ALTER TABLE public.configuracion OWNER TO evaluaciones_user;

--
-- TOC entry 234 (class 1259 OID 24838)
-- Name: dimensions; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.dimensions (
    id bigint NOT NULL,
    ciclo_id bigint NOT NULL,
    nombre text NOT NULL,
    orden integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.dimensions OWNER TO evaluaciones_user;

--
-- TOC entry 233 (class 1259 OID 24837)
-- Name: dimensions_id_seq; Type: SEQUENCE; Schema: public; Owner: evaluaciones_user
--

CREATE SEQUENCE public.dimensions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dimensions_id_seq OWNER TO evaluaciones_user;

--
-- TOC entry 3591 (class 0 OID 0)
-- Dependencies: 233
-- Name: dimensions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: evaluaciones_user
--

ALTER SEQUENCE public.dimensions_id_seq OWNED BY public.dimensions.id;


--
-- TOC entry 223 (class 1259 OID 24640)
-- Name: evaluaciones; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.evaluaciones (
    id bigint NOT NULL,
    evaluador_id bigint NOT NULL,
    evaluado_id bigint NOT NULL,
    cargo_evaluador text NOT NULL,
    comentarios text DEFAULT ''::text NOT NULL,
    fecha_completada timestamp with time zone DEFAULT now() NOT NULL,
    ciclo_id bigint NOT NULL
);


ALTER TABLE public.evaluaciones OWNER TO evaluaciones_user;

--
-- TOC entry 222 (class 1259 OID 24639)
-- Name: evaluaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: evaluaciones_user
--

CREATE SEQUENCE public.evaluaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evaluaciones_id_seq OWNER TO evaluaciones_user;

--
-- TOC entry 3592 (class 0 OID 0)
-- Dependencies: 222
-- Name: evaluaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: evaluaciones_user
--

ALTER SEQUENCE public.evaluaciones_id_seq OWNED BY public.evaluaciones.id;


--
-- TOC entry 218 (class 1259 OID 24592)
-- Name: evaluadores; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.evaluadores (
    id bigint NOT NULL,
    nombre text NOT NULL,
    email text NOT NULL,
    cargo text NOT NULL,
    token text,
    evaluado_id bigint,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    estado text DEFAULT 'Pendiente'::text NOT NULL,
    ciclo_id bigint NOT NULL
);


ALTER TABLE public.evaluadores OWNER TO evaluaciones_user;

--
-- TOC entry 217 (class 1259 OID 24591)
-- Name: evaluadores_id_seq; Type: SEQUENCE; Schema: public; Owner: evaluaciones_user
--

CREATE SEQUENCE public.evaluadores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evaluadores_id_seq OWNER TO evaluaciones_user;

--
-- TOC entry 3593 (class 0 OID 0)
-- Dependencies: 217
-- Name: evaluadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: evaluaciones_user
--

ALTER SEQUENCE public.evaluadores_id_seq OWNED BY public.evaluadores.id;


--
-- TOC entry 216 (class 1259 OID 24581)
-- Name: evaluados; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.evaluados (
    id bigint NOT NULL,
    nombre text NOT NULL,
    puesto text NOT NULL,
    area text NOT NULL,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ciclo_id bigint DEFAULT 1 NOT NULL
);


ALTER TABLE public.evaluados OWNER TO evaluaciones_user;

--
-- TOC entry 215 (class 1259 OID 24580)
-- Name: evaluados_id_seq; Type: SEQUENCE; Schema: public; Owner: evaluaciones_user
--

CREATE SEQUENCE public.evaluados_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evaluados_id_seq OWNER TO evaluaciones_user;

--
-- TOC entry 3594 (class 0 OID 0)
-- Dependencies: 215
-- Name: evaluados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: evaluaciones_user
--

ALTER SEQUENCE public.evaluados_id_seq OWNED BY public.evaluados.id;


--
-- TOC entry 236 (class 1259 OID 24856)
-- Name: groups; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.groups (
    id bigint NOT NULL,
    ciclo_id bigint NOT NULL,
    dimension_id bigint NOT NULL,
    nombre text NOT NULL,
    orden integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.groups OWNER TO evaluaciones_user;

--
-- TOC entry 235 (class 1259 OID 24855)
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: evaluaciones_user
--

CREATE SEQUENCE public.groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.groups_id_seq OWNER TO evaluaciones_user;

--
-- TOC entry 3595 (class 0 OID 0)
-- Dependencies: 235
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: evaluaciones_user
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- TOC entry 224 (class 1259 OID 24661)
-- Name: respuestas; Type: TABLE; Schema: public; Owner: evaluaciones_user
--

CREATE TABLE public.respuestas (
    evaluacion_id bigint NOT NULL,
    competencia_id bigint NOT NULL,
    valor integer NOT NULL,
    comentario text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.respuestas OWNER TO evaluaciones_user;

--
-- TOC entry 226 (class 1259 OID 24698)
-- Name: reporte_competencias; Type: VIEW; Schema: public; Owner: evaluaciones_user
--

CREATE VIEW public.reporte_competencias AS
 SELECT c.clave,
    c.titulo,
    count(r.comentario) AS total_respuestas,
    round(avg(r.valor), 2) AS promedio,
    min(r.valor) AS minimo,
    max(r.valor) AS maximo
   FROM (public.competencias c
     JOIN public.respuestas r ON ((r.competencia_id = c.id)))
  GROUP BY c.clave, c.titulo
 HAVING (count(r.comentario) > 0)
  ORDER BY c.titulo;


ALTER VIEW public.reporte_competencias OWNER TO evaluaciones_user;

--
-- TOC entry 227 (class 1259 OID 24703)
-- Name: reporte_competencias_por_cargo; Type: VIEW; Schema: public; Owner: evaluaciones_user
--

CREATE VIEW public.reporte_competencias_por_cargo AS
 SELECT e.cargo_evaluador,
    c.clave,
    c.titulo,
    count(r.comentario) AS total_respuestas,
    round(avg(r.valor), 2) AS promedio
   FROM ((public.competencias c
     JOIN public.respuestas r ON ((r.competencia_id = c.id)))
     JOIN public.evaluaciones e ON ((e.id = r.evaluacion_id)))
  GROUP BY e.cargo_evaluador, c.clave, c.titulo
 HAVING (count(r.comentario) > 0)
  ORDER BY e.cargo_evaluador, c.titulo;


ALTER VIEW public.reporte_competencias_por_cargo OWNER TO evaluaciones_user;

--
-- TOC entry 232 (class 1259 OID 24813)
-- Name: vista_competencias_por_dimension; Type: VIEW; Schema: public; Owner: evaluaciones_user
--

CREATE VIEW public.vista_competencias_por_dimension AS
 SELECT c.dimension_general,
    c.clave,
    c.titulo,
    count(DISTINCT r.evaluacion_id) AS total_evaluaciones,
    avg(r.valor) AS promedio_general
   FROM (public.competencias c
     LEFT JOIN public.respuestas r ON ((r.competencia_id = c.id)))
  WHERE ((c.activa = true) AND (c.tipo = 'likert'::text))
  GROUP BY c.dimension_general, c.clave, c.titulo
  ORDER BY c.dimension_general, c.titulo;


ALTER VIEW public.vista_competencias_por_dimension OWNER TO evaluaciones_user;

--
-- TOC entry 231 (class 1259 OID 24800)
-- Name: vista_stats_por_ciclo; Type: VIEW; Schema: public; Owner: evaluaciones_user
--

CREATE VIEW public.vista_stats_por_ciclo AS
SELECT
    NULL::bigint AS ciclo_id,
    NULL::text AS ciclo_nombre,
    NULL::text AS ciclo_estado,
    NULL::bigint AS total_evaluadores,
    NULL::bigint AS total_evaluados,
    NULL::bigint AS total_evaluaciones,
    NULL::bigint AS evaluadores_pendientes,
    NULL::bigint AS evaluadores_completados,
    NULL::bigint AS competencias_activas;


ALTER VIEW public.vista_stats_por_ciclo OWNER TO evaluaciones_user;

--
-- TOC entry 3596 (class 0 OID 0)
-- Dependencies: 231
-- Name: VIEW vista_stats_por_ciclo; Type: COMMENT; Schema: public; Owner: evaluaciones_user
--

COMMENT ON VIEW public.vista_stats_por_ciclo IS 'Estadísticas agregadas por ciclo de evaluación';


--
-- TOC entry 3336 (class 2604 OID 24755)
-- Name: ciclos_evaluacion id; Type: DEFAULT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.ciclos_evaluacion ALTER COLUMN id SET DEFAULT nextval('public.ciclos_evaluacion_id_seq'::regclass);


--
-- TOC entry 3324 (class 2604 OID 24612)
-- Name: competencias id; Type: DEFAULT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.competencias ALTER COLUMN id SET DEFAULT nextval('public.competencias_id_seq'::regclass);


--
-- TOC entry 3342 (class 2604 OID 24841)
-- Name: dimensions id; Type: DEFAULT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.dimensions ALTER COLUMN id SET DEFAULT nextval('public.dimensions_id_seq'::regclass);


--
-- TOC entry 3332 (class 2604 OID 24643)
-- Name: evaluaciones id; Type: DEFAULT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluaciones ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_id_seq'::regclass);


--
-- TOC entry 3321 (class 2604 OID 24595)
-- Name: evaluadores id; Type: DEFAULT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluadores ALTER COLUMN id SET DEFAULT nextval('public.evaluadores_id_seq'::regclass);


--
-- TOC entry 3317 (class 2604 OID 24584)
-- Name: evaluados id; Type: DEFAULT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluados ALTER COLUMN id SET DEFAULT nextval('public.evaluados_id_seq'::regclass);


--
-- TOC entry 3346 (class 2604 OID 24859)
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- TOC entry 3572 (class 0 OID 24768)
-- Dependencies: 230
-- Data for Name: ciclos_competencias; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.ciclos_competencias (ciclo_id, competencia_id, activa, fecha_agregada) FROM stdin;
1	28	t	2025-11-10 20:47:34.373014+00
1	25	t	2025-11-10 20:47:34.373014+00
1	29	t	2025-11-10 20:47:34.373014+00
1	30	t	2025-11-10 20:47:34.373014+00
1	31	t	2025-11-10 20:47:34.373014+00
1	32	t	2025-11-10 20:47:34.373014+00
1	33	t	2025-11-10 20:47:34.373014+00
1	34	t	2025-11-10 20:47:34.373014+00
1	11	t	2025-11-10 20:47:34.373014+00
1	12	t	2025-11-10 20:47:34.373014+00
1	13	t	2025-11-10 20:47:34.373014+00
1	15	t	2025-11-10 20:47:34.373014+00
1	17	t	2025-11-10 20:47:34.373014+00
1	18	t	2025-11-10 20:47:34.373014+00
1	14	t	2025-11-10 20:47:34.373014+00
1	16	t	2025-11-10 20:47:34.373014+00
1	37	t	2025-11-10 20:47:34.373014+00
1	38	t	2025-11-10 20:47:34.373014+00
1	21	t	2025-11-10 20:47:34.373014+00
1	22	t	2025-11-10 20:47:34.373014+00
1	23	t	2025-11-10 20:47:34.373014+00
1	24	t	2025-11-10 20:47:34.373014+00
1	20	t	2025-11-10 20:47:34.373014+00
1	40	t	2025-11-10 20:47:34.373014+00
1	41	t	2025-11-10 20:47:34.373014+00
1	43	t	2025-11-10 20:47:34.373014+00
1	44	t	2025-11-10 20:47:34.373014+00
1	45	t	2025-11-10 20:47:34.373014+00
1	35	t	2025-11-10 20:47:34.373014+00
1	36	t	2025-11-10 20:47:34.373014+00
1	19	t	2025-11-10 20:47:34.373014+00
1	47	t	2025-11-10 20:47:34.373014+00
1	39	t	2025-11-10 20:47:34.373014+00
1	48	t	2025-11-10 20:47:34.373014+00
1	42	t	2025-11-10 20:47:34.373014+00
1	49	t	2025-11-10 20:47:34.373014+00
1	51	t	2025-11-10 20:47:34.373014+00
1	56	t	2025-11-10 20:47:34.373014+00
1	53	t	2025-11-10 20:47:34.373014+00
1	54	t	2025-11-10 20:47:34.373014+00
1	55	t	2025-11-10 20:47:34.373014+00
1	58	t	2025-11-10 20:47:34.373014+00
1	57	t	2025-11-10 20:47:34.373014+00
1	59	t	2025-11-10 20:47:34.373014+00
1	60	t	2025-11-10 20:47:34.373014+00
1	61	t	2025-11-10 20:47:34.373014+00
1	10	f	2025-11-10 20:47:34.373014+00
\.


--
-- TOC entry 3571 (class 0 OID 24752)
-- Dependencies: 229
-- Data for Name: ciclos_evaluacion; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.ciclos_evaluacion (id, nombre, descripcion, fecha_inicio, fecha_fin, estado, fecha_creacion, fecha_actualizacion) FROM stdin;
1	Evaluación 360° - Inicial	Ciclo creado automáticamente para migrar datos existentes	2025-11-10	\N	activa	2025-11-10 20:47:34.373014+00	2025-11-12 22:42:48.458666+00
4	Evaluacion de prueba	Es una evaluacion de prueba para validar el proceso completo	2025-11-13	2025-11-30	borrador	2025-11-13 20:35:52.22974+00	2025-11-13 20:35:52.22974+00
\.


--
-- TOC entry 3564 (class 0 OID 24609)
-- Dependencies: 220
-- Data for Name: competencias; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.competencias (id, clave, titulo, descripcion, orden, activa, tipo, grupo, escala_min, escala_max, etiqueta_min, etiqueta_max, dimension_general) FROM stdin;
42	Resolución de Solicitudes	Competencia Técnica	¿Resuelve los requerimientos técnicos de forma efectiva y oportuna?	30	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
45	Mejora Continua	Innovacion	¿Propone acciones o ideas que contribuyen a mejorar los procesos y servicios internos?	33	t	likert	Autoconocimiento	1	5	Muy bajo	Excelente	Interés
47	Vision Estrategica	Liderazgo	¿Propongo mejoras que beneficien el rendimiento técnico del área?	34	t	likert	Autoconocimiento	1	5	Muy bajo	Excelente	Interés
17	Cumplimiento	Resultados	¿Cumple con los objetivos y metas del área técnica?	7	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
56	Servicio Interno	Servicio	¿Cumplo con los procesos internos y entrego resultados con calidad y puntualidad?	41	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
37	Ejemplo	Liderazgo	¿Da el ejemplo con su trabajo y comportamiento técnico?	25	t	likert	Ser Modelo	1	5	Muy bajo	Excelente	Armonía
28	Dirección Clara	Liderazgo	¿Da instrucciones técnicas claras y comprensibles?	16	t	likert	Ser Modelo	1	5	Muy bajo	Excelente	Armonía
20	Conocimiento Técnico	Competencia Técnica	¿Demuestra sólido conocimiento técnico en su área?	10	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
18	Proactividad	Liderazgo	¿Es proactivo en identificar y prevenir problemas técnicos?	8	t	likert	Pensamiento Positivo	1	5	Muy bajo	Excelente	Interés
24	Confiabilidad	Profesionalismo	¿Es una persona confiable en el cumplimiento de compromisos?	14	t	likert	Conducta Ética	1	5	Muy bajo	Excelente	Fiabilidad
21	Apoyo entre Pares	Colaboración	¿Está disponible para apoyar cuando otros supervisores lo necesitan?	11	t	likert	Apoyo	1	5	Muy bajo	Excelente	Interés
29	Apoyo Técnico	Liderazgo	¿Brinda apoyo cuando tengo dificultades técnicas?	17	t	likert	Apoyo	1	5	Muy bajo	Excelente	Interés
12	Gestión de Equipo	Liderazgo	¿Administra eficientemente los recursos técnicos y humanos del equipo?	2	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
51	Toma de decisiones	Liderazgo	¿Asumo responsabilidad por mis decisiones y resultados técnicos?	37	t	likert	Conducta Ética	1	5	Muy bajo	Excelente	Fiabilidad
19	Colaboración	Trabajo en equipo	¿Colabora activamente con otros supervisores/ingenieros?	9	t	likert	Respeto	1	5	Muy bajo	Excelente	Armonía
22	Comunicación	Comunicación	¿Comparte información técnica relevante con el equipo de supervisores?	12	t	likert	Ser Modelo	1	5	Muy bajo	Excelente	Armonía
49	comunicacion	Comunicación	¿Comunico de manera clara y efectiva mis ideas y decisiones al equipo?	36	t	likert	Ser Modelo	1	5	Muy bajo	Excelente	Armonía
23	Resolución de Conflictos	Liderazgo	¿Maneja conflictos de manera constructiva?	13	t	likert	Gestión Emocional	1	5	Muy bajo	Excelente	Armonía
44	Coordinación con Otras Áreas	Colaboración	¿Coordina adecuadamente con otros departamentos para cumplir los procesos internos?	32	t	likert	Pensamiento Positivo	1	5	Muy bajo	Excelente	Interés
25	Actitud Positiva	Liderazgo	¿Mantiene actitud positiva incluso en situaciones difíciles?	15	t	likert	Pensamiento Positivo	1	5	Muy bajo	Excelente	Interés
35	Inspiración	Liderazgo	¿Me inspira a dar lo mejor de mí en el trabajo técnico?	23	t	likert	Ser Modelo	1	5	Muy bajo	Excelente	Armonía
48	Gestión del Tiempo	Resultados	¿Planifico adecuadamente mis tareas y prioridades para cumplir con los objetivos?	35	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
13	Resolución de Problemas	Competencia Técnica	¿Resuelve problemas técnicos complejos de manera efectiva?	3	t	likert	Perseverancia y Resiliencia	1	5	Muy bajo	Excelente	Fiabilidad
39	Entregas a Tiempo	Resultados	¿Cumple con los plazos acordados para las solicitudes o servicios técnicos?	27	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
38	Cumplimiento de Procesos	Servicio Interno	¿Cumple con los procedimientos y estándares internos establecidos?	26	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
40	Calidad del Servicio	Servicio Interno	¿El trabajo entregado cumple con los niveles de calidad requeridos por el área solicitante?	28	t	likert	Apoyo	1	5	Muy bajo	Excelente	Interés
41	Comunicación y Seguimiento	Comunicación	¿Mantiene una comunicación clara y da seguimiento a los requerimientos hasta su cierre?	29	t	likert	Ser Modelo	1	5	Muy bajo	Excelente	Armonía
43	Orientación al Cliente Interno	Servicio	¿Muestra disposición y actitud de servicio al atender las necesidades de otras áreas?	31	t	likert	Apoyo	1	5	Muy bajo	Excelente	Interés
16	Toma de Decisiones	Liderazgo	¿Toma decisiones técnicas acertadas bajo presión?	6	t	likert	Perseverancia y Resiliencia	1	5	Muy bajo	Excelente	Fiabilidad
14	Comunicación Ascendente	Comunicación	¿Comunica claramente el estado del área y necesidades técnicas?	4	t	likert	Ser Modelo	1	5	Muy bajo	Excelente	Armonía
36	Comunicacion	Comunicación	¿Escucha mis sugerencias y retroalimentación técnica?	24	t	likert	Gestión Emocional	1	5	Muy bajo	Excelente	Armonía
33	Disponibilidad	Liderazgo	¿Está disponible cuando el equipo técnico necesita su apoyo?	21	t	likert	Apoyo	1	5	Muy bajo	Excelente	Interés
30	Capacitación	Desarrollo	¿Me enseña y ayuda a desarrollar mis habilidades técnicas?	18	t	likert	Apoyo	1	5	Muy bajo	Excelente	Interés
11	Visión Estratégica	Liderazgo	¿Propone mejoras e iniciativas que benefician al área técnica?	1	t	likert	Gestión del Desempeño	1	5	Muy bajo	Excelente	Fiabilidad
31	Reconocimiento	Motivación	¿Reconoce el buen trabajo y esfuerzo del equipo?	19	t	likert	Pensamiento Positivo	1	5	Muy bajo	Excelente	Interés
34	Justicia	Liderazgo	¿Toma decisiones justas en la asignación de trabajo?	22	t	likert	Gestión Emocional	1	5	Muy bajo	Excelente	Armonía
32	Trato Respetuoso	Liderazgo	¿Trata al equipo técnico con respeto y profesionalismo?	20	t	likert	Respeto	1	5	Muy bajo	Excelente	Armonía
15	Desarrollo del Personal	Liderazgo	¿Se preocupa por el desarrollo técnico de su equipo?	5	t	likert	Autoconocimiento	1	5	Muy bajo	Excelente	Interés
53	Resolucion de Problemas	Competencia Técnica	¿Identifico causas raíz y aporto soluciones efectivas ante problemas técnicos?	38	t	likert	Perseverancia y Resiliencia	1	5	Muy bajo	Excelente	Fiabilidad
10	Liderazgo	Visión Estratégica	¿Propone mejoras e iniciativas que benefician al área técnica?	0	f	likert	Autoconocimiento	1	5	Muy bajo	Excelente	Sin clasificar
57	Ética y Profesionalismo	Profesionalismo	¿Actúo con responsabilidad, respeto y coherencia en el trabajo diario?	42	t	likert	Conducta Ética	1	5	Muy bajo	Excelente	Fiabilidad
59	Innovación	Liderazgo	¿Aporta ideas innovadoras para mejorar procesos técnicos?	44	t	likert	Pensamiento Positivo	1	5	Muy bajo	Excelente	Interés
54	Desarrollo Profesional	Desarrollo	¿Busco oportunidades para actualizar mis conocimientos técnicos?	39	t	likert	Pensamiento Positivo	1	5	Muy bajo	Excelente	Interés
55	Trabajo en Equipo	Colaboración	¿Colaboro activamente con mis compañeros y apoyo las metas del grupo?	40	t	likert	Respeto	1	5	Muy bajo	Excelente	Armonía
58	Autocrítica y Mejora Continua	Desarrollo	¿Reflexiono sobre mis errores y aplico acciones de mejora?	43	t	likert	Autoconocimiento	1	5	Muy bajo	Excelente	Interés
60	Fortalezas	Liderazgo	¿Qué fortalezas de liderazgo técnico destacarías en esta persona?	45	t	texto	\N	1	5	Muy bajo	Excelente	Sin clasificar
61	Oportunidad de Mejora	Liderazgo	¿Qué aspectos debería mejorar o desarrollar para fortalecer su liderazgo?	46	t	texto	\N	1	5	Muy bajo	Excelente	Sin clasificar
\.


--
-- TOC entry 3565 (class 0 OID 24626)
-- Dependencies: 221
-- Data for Name: competencias_aplica_cargo; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.competencias_aplica_cargo (competencia_id, cargo) FROM stdin;
10	Jefe inmediato
11	Jefe inmediato
12	Jefe inmediato
13	Jefe inmediato
14	Jefe inmediato
16	Jefe inmediato
17	Jefe inmediato
18	Jefe inmediato
19	Compañero
20	Compañero
21	Compañero
22	Compañero
23	Compañero
24	Compañero
28	Sub-alterno
29	Sub-alterno
30	Sub-alterno
31	Sub-alterno
32	Sub-alterno
33	Sub-alterno
34	Sub-alterno
35	Sub-alterno
36	Sub-alterno
37	Sub-alterno
38	Cliente
39	Cliente
40	Cliente
41	Cliente
43	Cliente
44	Cliente
45	Cliente
47	Autoevaluacion
48	Autoevaluacion
49	Autoevaluacion
51	Autoevaluacion
53	Autoevaluacion
54	Autoevaluacion
55	Autoevaluacion
56	Autoevaluacion
57	Autoevaluacion
58	Autoevaluacion
25	Compañero
59	Compañero
15	Jefe inmediato
42	Cliente
\.


--
-- TOC entry 3569 (class 0 OID 24676)
-- Dependencies: 225
-- Data for Name: configuracion; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.configuracion (clave, valor) FROM stdin;
evaluacionActiva	true
fechaInicio	2025-11-04
fechaCierre	2025-11-30
nombreEvaluacion	Evaluación 360° Q4 2025
\.


--
-- TOC entry 3574 (class 0 OID 24838)
-- Dependencies: 234
-- Data for Name: dimensions; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.dimensions (id, ciclo_id, nombre, orden, created_at, updated_at) FROM stdin;
1	1	Fiabilidad	1	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
2	1	Armonía	2	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
3	1	Interés	3	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
\.


--
-- TOC entry 3567 (class 0 OID 24640)
-- Dependencies: 223
-- Data for Name: evaluaciones; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.evaluaciones (id, evaluador_id, evaluado_id, cargo_evaluador, comentarios, fecha_completada, ciclo_id) FROM stdin;
25	141	5	Cliente		2025-11-07 14:55:32.186309+00	1
26	142	6	Cliente		2025-11-07 14:56:06.552286+00	1
27	143	7	Cliente		2025-11-07 14:56:37.621678+00	1
28	133	7	Cliente		2025-11-07 14:57:09.310541+00	1
29	109	3	Cliente		2025-11-07 14:57:31.079841+00	1
30	110	4	Cliente		2025-11-07 15:04:19.35302+00	1
31	27	3	Sub-alterno		2025-11-07 15:09:00.346166+00	1
32	28	4	Sub-alterno		2025-11-07 15:10:05.511394+00	1
33	111	5	Cliente		2025-11-07 15:10:14.159636+00	1
34	119	3	Cliente		2025-11-07 15:10:19.007848+00	1
35	29	5	Sub-alterno		2025-11-07 15:10:39.267599+00	1
36	30	6	Sub-alterno		2025-11-07 15:10:57.762196+00	1
37	31	7	Sub-alterno		2025-11-07 15:11:19.110611+00	1
38	114	3	Cliente		2025-11-07 15:20:33.410987+00	1
39	120	4	Cliente		2025-11-07 15:23:00.856209+00	1
40	149	3	Cliente		2025-11-07 15:23:34.139802+00	1
41	78	3	Compañero		2025-11-07 15:25:43.37518+00	1
42	150	4	Cliente		2025-11-07 15:26:18.913446+00	1
43	151	5	Cliente		2025-11-07 15:27:24.827856+00	1
44	121	5	Cliente		2025-11-07 15:41:13.65783+00	1
45	152	6	Cliente		2025-11-07 15:42:35.80255+00	1
46	153	7	Cliente		2025-11-07 15:43:40.840066+00	1
47	122	6	Cliente		2025-11-07 15:45:13.358999+00	1
48	163	7	Cliente	Se observa buena disposición de en la realización de tareas con actitud positiva que contagia el estado de ánimo de los copañeros de trabajo.	2025-11-07 15:48:10.860783+00	1
49	112	6	Cliente	Siento que se acomoda mucho a otros y por no generar conflictos deja pasar muchas cosas, es muy permisivo y no asume responsabilidades.	2025-11-07 15:48:49.718947+00	1
50	115	4	Cliente		2025-11-07 15:50:14.134437+00	1
51	116	5	Cliente		2025-11-07 15:52:10.880232+00	1
52	123	7	Cliente		2025-11-07 15:52:25.800962+00	1
53	162	6	Cliente	Muy buen colaborador, respetuoso y responsable	2025-11-07 15:53:26.761214+00	1
54	117	6	Cliente		2025-11-07 15:53:30.478325+00	1
55	113	7	Cliente	No es responsable con los activos de la empresa, no los cuida y vela por que su personal cumpla el cuidado del mismo tanto EPP como herramientas y equipos, no demuestra empatía o considero que tiene una actitud cerrada cuando se le cuestiona, tiende a defender en lugar de analizar de manera imparcial su comportamiento o el de su personal a cargo, no hay compromiso con el cuidado de la seguridad y salud del personal a cargo y es algo que percibo en toda el área de liderazgo de USED	2025-11-07 15:54:52.98481+00	1
56	63	3	Compañero		2025-11-07 15:55:08.501812+00	1
57	43	3	Sub-alterno		2025-11-07 15:55:28.037828+00	1
58	118	7	Cliente		2025-11-07 15:56:01.825054+00	1
59	48	3	Sub-alterno	Se debería de reconocer el arduo trabajo técnico y todo lo que conlleva	2025-11-07 15:56:33.922022+00	1
60	49	4	Sub-alterno		2025-11-07 15:58:29.80964+00	1
61	64	4	Compañero		2025-11-07 15:58:46.264107+00	1
62	161	5	Cliente	Tiene mucho potencial, posee mucho conocimiento técnico pero debe ser combinado con practica de buenas relaciones interpersonales con los que lidera	2025-11-07 15:59:35.834368+00	1
63	50	5	Sub-alterno	Es uno de los mejores supervisores de toda la empresa, la empatía y la buena relación con los técnicos hace que todos le tengamos aprecio y respeto	2025-11-07 16:00:32.576463+00	1
64	52	7	Sub-alterno	Como persona muy bien pero en ocasiones desempeñando su cargo es muy injusto y prepotente y muchas veces carga tanto como físicamente y psicológicamente al técnico	2025-11-07 16:03:09.770173+00	1
65	160	4	Cliente	Un colaborador con gran conocimiento técnico, excelente ser humano, pero debe haber mejora en la comunicación con otras áreas involucradas con procesos de su área de servicio	2025-11-07 16:06:20.965293+00	1
66	65	5	Autoevaluacion		2025-11-07 16:10:11.053842+00	1
67	159	3	Cliente	Seguir con la misma actitud de entrega y responsabilidad en el cumplimiento de sus actividades	2025-11-07 16:11:45.412498+00	1
68	66	6	Compañero		2025-11-07 16:12:25.564279+00	1
69	67	7	Jefe inmediato		2025-11-07 16:14:40.239346+00	1
70	94	4	Sub-alterno	La empatía permite fomentar un ambiente de confianza donde todas las personas de la unidad se sientan valorados y respetados	2025-11-07 16:25:34.226315+00	1
71	95	5	Sub-alterno	En ciertas situaciones sus emociones pueden llegar a afectar, sin embargo, sabe afrontar los retos	2025-11-07 16:32:45.83902+00	1
73	73	3	Autoevaluacion		2025-11-07 17:19:42.48603+00	1
74	74	4	Compañero		2025-11-07 17:21:12.583178+00	1
75	97	6	Sub-alterno		2025-11-07 17:21:24.042137+00	1
76	75	5	Compañero		2025-11-07 17:23:30.178325+00	1
77	76	6	Jefe inmediato		2025-11-07 17:24:55.486158+00	1
78	88	7	Jefe inmediato		2025-11-07 17:28:22.086389+00	1
79	98	7	Sub-alterno		2025-11-07 17:30:02.971013+00	1
80	51	6	Sub-alterno	Como comentario general (fuera de contexto de los supervisores) se debería de incentivar el área técnica de USED ya que es sabido por todos que desarrollamos trabajos que nadie más hace , tanto físico como especializado , siento que se debería de valorar más	2025-11-07 17:31:33.557179+00	1
81	12	3	Sub-alterno		2025-11-07 17:33:56.68723+00	1
82	13	4	Sub-alterno		2025-11-07 17:35:00.315813+00	1
83	14	5	Sub-alterno		2025-11-07 17:35:55.770447+00	1
84	16	7	Sub-alterno		2025-11-07 17:36:56.327037+00	1
85	17	3	Sub-alterno		2025-11-07 17:47:22.737488+00	1
86	83	3	Jefe inmediato		2025-11-07 17:47:54.841222+00	1
87	84	4	Jefe inmediato		2025-11-07 17:49:04.418773+00	1
88	85	5	Sub-alterno		2025-11-07 17:50:05.172984+00	1
89	18	4	Sub-alterno		2025-11-07 17:51:37.084626+00	1
90	154	3	Cliente		2025-11-07 17:51:47.158325+00	1
91	86	6	Compañero		2025-11-07 17:55:07.991917+00	1
92	19	5	Sub-alterno		2025-11-07 17:57:06.595904+00	1
93	87	7	Autoevaluacion		2025-11-07 17:57:30.248033+00	1
94	155	4	Cliente		2025-11-07 17:57:41.859811+00	1
95	134	3	Cliente		2025-11-07 17:59:02.905244+00	1
96	20	6	Sub-alterno		2025-11-07 18:00:31.532191+00	1
97	135	4	Cliente		2025-11-07 18:02:50.469615+00	1
72	96	3	Sub-alterno		2025-11-07 17:11:44.205361+00	1
7	144	3	Cliente	excelente compañero	2025-11-07 00:51:31.391105+00	1
8	146	5	Cliente	claridad en la comunicación	2025-11-07 01:09:26.757897+00	1
9	128	7	Cliente		2025-11-07 14:28:44.31434+00	1
10	127	6	Cliente		2025-11-07 14:30:33.478612+00	1
11	126	5	Cliente		2025-11-07 14:32:26.695324+00	1
12	125	4	Cliente		2025-11-07 14:33:35.207441+00	1
13	124	3	Cliente		2025-11-07 14:34:23.267129+00	1
14	129	3	Cliente		2025-11-07 14:35:08.913908+00	1
15	58	3	Sub-alterno		2025-11-07 14:40:58.292465+00	1
16	59	4	Sub-alterno		2025-11-07 14:45:32.298863+00	1
17	130	4	Cliente		2025-11-07 14:48:24.13737+00	1
18	60	5	Sub-alterno		2025-11-07 14:48:29.833202+00	1
19	61	6	Sub-alterno		2025-11-07 14:50:53.593008+00	1
20	131	5	Cliente		2025-11-07 14:52:46.196068+00	1
21	62	7	Sub-alterno		2025-11-07 14:53:12.300111+00	1
22	139	3	Cliente		2025-11-07 14:53:31.696694+00	1
23	140	4	Cliente		2025-11-07 14:54:58.465134+00	1
24	132	6	Cliente		2025-11-07 14:55:07.861466+00	1
123	44	4	Sub-alterno		2025-11-07 19:16:15.585349+00	1
124	22	3	Sub-alterno		2025-11-07 19:16:18.114683+00	1
125	45	5	Sub-alterno		2025-11-07 19:16:41.777837+00	1
126	46	6	Sub-alterno		2025-11-07 19:17:10.797695+00	1
127	23	4	Sub-alterno		2025-11-07 19:17:11.104413+00	1
128	10	6	Sub-alterno		2025-11-07 19:17:13.267997+00	1
129	24	5	Sub-alterno		2025-11-07 19:17:33.854455+00	1
130	25	6	Sub-alterno		2025-11-07 19:18:03.574245+00	1
131	26	7	Sub-alterno		2025-11-07 19:18:42.124955+00	1
132	47	7	Sub-alterno		2025-11-07 19:19:20.688999+00	1
133	15	6	Sub-alterno		2025-11-07 19:33:01.874964+00	1
134	99	3	Compañero		2025-11-07 19:34:24.837048+00	1
135	37	3	Sub-alterno		2025-11-07 19:41:50.963943+00	1
136	68	3	Compañero		2025-11-07 19:44:28.943881+00	1
137	89	3	Jefe inmediato		2025-11-07 19:44:57.449554+00	1
138	100	4	Compañero		2025-11-07 19:45:12.416464+00	1
139	145	4	Cliente	mejorar como equipo	2025-11-07 19:45:40.530612+00	1
140	101	5	Compañero		2025-11-07 19:45:53.67114+00	1
141	38	4	Sub-alterno		2025-11-07 19:47:05.029566+00	1
142	38	4	Sub-alterno		2025-11-07 19:47:08.578643+00	1
143	102	6	Autoevaluacion		2025-11-07 19:47:24.631926+00	1
144	69	4	Compañero		2025-11-07 19:47:43.626257+00	1
145	39	5	Sub-alterno		2025-11-07 19:48:20.959012+00	1
146	103	5	Compañero		2025-11-07 19:48:25.137849+00	1
147	41	6	Sub-alterno		2025-11-07 19:53:14.285436+00	1
148	147	6	Cliente	mejorar la comunicación	2025-11-07 19:53:46.093985+00	1
149	70	5	Compañero	Debe mejorar el manejo del estrés, especialmente en situaciones de alta presión, buscando estrategias que le permitan mantener la calma y transmitir serenidad al grupo.	2025-11-07 19:53:55.747224+00	1
150	42	7	Sub-alterno		2025-11-07 19:55:17.921495+00	1
151	42	7	Sub-alterno		2025-11-07 19:55:19.771541+00	1
152	71	6	Compañero		2025-11-07 19:57:10.065167+00	1
153	148	7	Cliente	comunicación efectiva	2025-11-07 19:58:10.33963+00	1
154	105	4	Cliente	debe mejorar en la organización y retroalimentación a sus actividades y equipo	2025-11-07 20:01:24.174207+00	1
155	104	3	Cliente	debe mejorar en la organización y seguridad laboral de su equipo de trabajo	2025-11-07 20:03:46.862433+00	1
156	106	5	Cliente	debe recibir charlas de atención al cliente y el trato a los demás	2025-11-07 20:09:23.512996+00	1
157	90	4	Jefe inmediato		2025-11-07 20:09:26.157022+00	1
158	91	5	Jefe inmediato		2025-11-07 20:12:21.802792+00	1
159	107	6	Cliente	debe recibir charlas de gestión de equipo	2025-11-07 20:12:58.524157+00	1
160	92	6	Jefe inmediato		2025-11-07 20:15:05.091388+00	1
161	108	7	Cliente	fortalecer su papel de líder de grupo	2025-11-07 20:15:42.590372+00	1
162	93	7	Jefe inmediato		2025-11-07 20:18:21.658771+00	1
163	164	7	Compañero		2025-11-07 20:26:10.81331+00	1
98	21	7	Sub-alterno		2025-11-07 18:05:46.237613+00	1
99	79	4	Autoevaluacion		2025-11-07 18:24:54.007078+00	1
100	80	5	Compañero		2025-11-07 18:28:42.460169+00	1
101	81	6	Compañero		2025-11-07 18:30:56.718874+00	1
102	7	3	Sub-alterno		2025-11-07 18:33:13.213846+00	1
103	82	7	Jefe inmediato		2025-11-07 18:33:36.935748+00	1
104	32	3	Sub-alterno		2025-11-07 18:36:14.177082+00	1
105	53	3	Sub-alterno		2025-11-07 18:36:43.465532+00	1
106	33	4	Sub-alterno		2025-11-07 18:41:49.616322+00	1
107	34	5	Sub-alterno		2025-11-07 18:45:07.874064+00	1
108	54	4	Sub-alterno		2025-11-07 18:48:08.527892+00	1
109	8	4	Sub-alterno		2025-11-07 18:50:05.152497+00	1
110	35	6	Sub-alterno		2025-11-07 18:51:39.983111+00	1
111	36	7	Sub-alterno		2025-11-07 18:52:12.343411+00	1
112	55	5	Sub-alterno		2025-11-07 18:52:26.518837+00	1
113	9	5	Sub-alterno		2025-11-07 18:56:22.037557+00	1
114	56	6	Sub-alterno		2025-11-07 18:56:52.59683+00	1
115	136	5	Cliente		2025-11-07 19:03:22.859244+00	1
116	57	7	Sub-alterno		2025-11-07 19:03:41.196273+00	1
117	137	6	Cliente		2025-11-07 19:04:43.62345+00	1
118	156	5	Cliente		2025-11-07 19:05:06.177696+00	1
119	138	7	Cliente		2025-11-07 19:05:41.581119+00	1
120	157	6	Cliente		2025-11-07 19:07:33.993969+00	1
121	11	7	Sub-alterno		2025-11-07 19:09:30.373757+00	1
122	158	7	Cliente		2025-11-07 19:11:12.997067+00	1
\.


--
-- TOC entry 3562 (class 0 OID 24592)
-- Dependencies: 218
-- Data for Name: evaluadores; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.evaluadores (id, nombre, email, cargo, token, evaluado_id, fecha_registro, estado, ciclo_id) FROM stdin;
59	YONI HUMBERTO POSADAS RAMIREZ	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 22:31:45.553099+00	Completada	1
30	FRANKLIN JARED CHAVEZ ALVARADO	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:35:51.740566+00	Completada	1
31	FRANKLIN JARED CHAVEZ ALVARADO	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 21:36:29.917382+00	Completada	1
63	MARLON GABRIEL SOLIS ALFARO	msolis@energiapd.com	Compañero	\N	3	2025-11-06 22:38:22.596402+00	Completada	1
43	KEVIN ANTHONY ROMERO	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:53:14.243445+00	Completada	1
48	LESTER JOSUE SAGASTUME CASTELLANOS	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 22:15:51.726302+00	Completada	1
49	LESTER JOSUE SAGASTUME CASTELLANOS	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 22:16:03.123706+00	Completada	1
64	MARLON GABRIEL SOLIS ALFARO	msolis@energiapd.com	Compañero	\N	4	2025-11-06 22:38:34.306657+00	Completada	1
50	LESTER JOSUE SAGASTUME CASTELLANOS	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 22:16:18.549936+00	Completada	1
52	LESTER JOSUE SAGASTUME CASTELLANOS	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 22:16:50.529578+00	Completada	1
65	MARLON GABRIEL SOLIS ALFARO	msolis@energiapd.com	Autoevaluacion	\N	5	2025-11-06 22:38:45.666307+00	Completada	1
66	MARLON GABRIEL SOLIS ALFARO	msolis@energiapd.com	Compañero	\N	6	2025-11-06 22:39:06.087055+00	Completada	1
67	MARLON GABRIEL SOLIS ALFARO	msolis@energiapd.com	Jefe inmediato	\N	7	2025-11-06 22:39:30.051085+00	Completada	1
51	LESTER JOSUE SAGASTUME CASTELLANOS	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 22:16:30.939496+00	Completada	1
12	DANIEL ALEJANDRO TORRES HERNANDEZ	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:22:58.605429+00	Completada	1
13	DANIEL ALEJANDRO TORRES HERNANDEZ	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:23:13.28662+00	Completada	1
14	DANIEL ALEJANDRO TORRES HERNANDEZ	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:23:34.660028+00	Completada	1
16	DANIEL ALEJANDRO TORRES HERNANDEZ	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 21:24:13.66928+00	Completada	1
17	EDGAR OTONIEL MORENO AGUILAR	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:25:08.993206+00	Completada	1
18	EDGAR OTONIEL MORENO AGUILAR	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:25:31.956731+00	Completada	1
20	EDGAR OTONIEL MORENO AGUILAR	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:26:38.067172+00	Completada	1
21	EDGAR OTONIEL MORENO AGUILAR	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 21:27:03.738797+00	Completada	1
7	AXEL RENE AGUILAR SANTOS	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:20:44.510704+00	Completada	1
32	ISAI CALEB AGUILAR PONCE	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:37:56.231086+00	Completada	1
53	WILMER DAVID MEJIA TORRES	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 22:30:04.294306+00	Completada	1
33	ISAI CALEB AGUILAR PONCE	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:38:16.508376+00	Completada	1
34	ISAI CALEB AGUILAR PONCE	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:38:37.331372+00	Completada	1
54	WILMER DAVID MEJIA TORRES	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 22:30:13.36066+00	Completada	1
8	AXEL RENE AGUILAR SANTOS	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:20:58.266278+00	Completada	1
35	ISAI CALEB AGUILAR PONCE	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:38:54.493919+00	Completada	1
36	ISAI CALEB AGUILAR PONCE	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 21:39:21.495007+00	Completada	1
55	WILMER DAVID MEJIA TORRES	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 22:30:28.359727+00	Completada	1
9	AXEL RENE AGUILAR SANTOS	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:21:17.919042+00	Completada	1
56	WILMER DAVID MEJIA TORRES	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 22:30:40.631549+00	Completada	1
57	WILMER DAVID MEJIA TORRES	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 22:31:08.029306+00	Completada	1
11	AXEL RENE AGUILAR SANTOS	kmelgar@gmail.com	Sub-alterno	\N	7	2025-11-06 21:22:32.597663+00	Completada	1
44	KEVIN ANTHONY ROMERO	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:53:25.759262+00	Completada	1
22	EMILISON ALEXIS ALVARADO CEBALLOS	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:27:23.312694+00	Completada	1
45	KEVIN ANTHONY ROMERO	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:53:37.346136+00	Completada	1
46	KEVIN ANTHONY ROMERO	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:54:01.078915+00	Completada	1
23	EMILISON ALEXIS ALVARADO CEBALLOS	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:27:48.941609+00	Completada	1
10	AXEL RENE AGUILAR SANTOS	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:21:33.732974+00	Completada	1
24	EMILISON ALEXIS ALVARADO CEBALLOS	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:28:04.93062+00	Completada	1
25	EMILISON ALEXIS ALVARADO CEBALLOS	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:28:30.153365+00	Completada	1
26	EMILISON ALEXIS ALVARADO CEBALLOS	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 21:32:53.976239+00	Completada	1
47	KEVIN ANTHONY ROMERO	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 21:54:28.095185+00	Completada	1
15	DANIEL ALEJANDRO TORRES HERNANDEZ	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:23:53.054477+00	Completada	1
37	JULIO CESAR PEREZ CUELLAR	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:39:38.954314+00	Completada	1
38	JULIO CESAR PEREZ CUELLAR	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:39:52.081156+00	Completada	1
39	JULIO CESAR PEREZ CUELLAR	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:40:08.762377+00	Completada	1
41	JULIO CESAR PEREZ CUELLAR	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 21:46:53.588538+00	Completada	1
125	Dania Reyes	dreyes@energiapd.com	Cliente	\N	4	2025-11-06 23:29:32.129449+00	Completada	1
124	Dania Reyes	dreyes@energiapd.com	Cliente	\N	3	2025-11-06 23:29:09.35402+00	Completada	1
127	Dania Reyes	dreyes@energiapd.com	Cliente	\N	6	2025-11-06 23:30:28.950959+00	Completada	1
126	Dania Reyes	dreyes@energiapd.com	Cliente	\N	5	2025-11-06 23:29:45.972677+00	Completada	1
129	Angela Ventura	aventura@energiapd.com	Cliente	\N	3	2025-11-06 23:33:26.903911+00	Completada	1
130	Angela Ventura	aventura@energiapd.com	Cliente	\N	4	2025-11-06 23:33:58.634079+00	Completada	1
131	Angela Ventura	aventura@energiapd.com	Cliente	\N	5	2025-11-06 23:36:25.321279+00	Completada	1
109	Isabel Matute	gprocesos@energiapd.com	Cliente	\N	3	2025-11-06 23:23:33.747628+00	Completada	1
110	Isabel Matute	gprocesos@energiapd.com	Cliente	\N	4	2025-11-06 23:23:50.148921+00	Completada	1
111	Isabel Matute	gprocesos@energiapd.com	Cliente	\N	5	2025-11-06 23:24:07.286377+00	Completada	1
119	Levy Cruz	compras@energiapd.com	Cliente	\N	3	2025-11-06 23:26:37.472316+00	Completada	1
114	Cindy Ayala	recursoshumanos@energiapd.com	Cliente	\N	3	2025-11-06 23:25:02.3424+00	Completada	1
120	Levy Cruz	compras@energiapd.com	Cliente	\N	4	2025-11-06 23:27:17.646892+00	Completada	1
78	JAMIL ENRIQUE MEJIA MARTINEZ	jmejia@energiapd.com	Compañero	\N	3	2025-11-06 22:48:52.839259+00	Completada	1
121	Levy Cruz	compras@energiapd.com	Cliente	\N	5	2025-11-06 23:27:30.332023+00	Completada	1
122	Levy Cruz	compras@energiapd.com	Cliente	\N	6	2025-11-06 23:28:09.104059+00	Completada	1
112	Isabel Matute	gprocesos@energiapd.com	Cliente	\N	6	2025-11-06 23:24:24.27838+00	Completada	1
115	Cindy Ayala	recursoshumanos@energiapd.com	Cliente	\N	4	2025-11-06 23:25:24.185414+00	Completada	1
116	Cindy Ayala	recursoshumanos@energiapd.com	Cliente	\N	5	2025-11-06 23:25:37.956441+00	Completada	1
123	Levy Cruz	compras@energiapd.com	Cliente	\N	7	2025-11-06 23:28:22.375943+00	Completada	1
113	Isabel Matute	gprocesos@energiapd.com	Cliente	\N	7	2025-11-06 23:24:43.67313+00	Completada	1
118	Cindy Ayala	recursoshumanos@energiapd.com	Cliente	\N	7	2025-11-06 23:26:03.766454+00	Completada	1
94	JADE JULIETH DAVILA SOTO	oillab@energiapd.com	Sub-alterno	\N	4	2025-11-06 23:07:49.42609+00	Completada	1
95	JADE JULIETH DAVILA SOTO	oillab@energiapd.com	Sub-alterno	\N	5	2025-11-06 23:08:00.068218+00	Completada	1
96	JADE JULIETH DAVILA SOTO	oillab@energiapd.com	Sub-alterno	\N	3	2025-11-06 23:08:20.408881+00	Completada	1
73	HECTOR FRANCISCO SUAZO ZEPEDA	ingsupervisorused@energiapd.com	Autoevaluacion	\N	3	2025-11-06 22:47:19.373653+00	Completada	1
74	HECTOR FRANCISCO SUAZO ZEPEDA	ingsupervisorused@energiapd.com	Compañero	\N	4	2025-11-06 22:47:27.937829+00	Completada	1
97	JADE JULIETH DAVILA SOTO	oillab@energiapd.com	Sub-alterno	\N	6	2025-11-06 23:08:33.591984+00	Completada	1
75	HECTOR FRANCISCO SUAZO ZEPEDA	ingsupervisorused@energiapd.com	Compañero	\N	5	2025-11-06 22:47:44.123024+00	Completada	1
76	HECTOR FRANCISCO SUAZO ZEPEDA	ingsupervisorused@energiapd.com	Jefe inmediato	\N	6	2025-11-06 22:48:06.018364+00	Completada	1
88	HECTOR FRANCISCO SUAZO ZEPEDA	ingsupervisorused@energiapd.com	Jefe inmediato	\N	7	2025-11-06 23:01:23.166468+00	Completada	1
98	JADE JULIETH DAVILA SOTO	oillab@energiapd.com	Sub-alterno	\N	7	2025-11-06 23:08:49.962573+00	Completada	1
83	MAXWELL ALEXANDER LOPEZ FUNEZ	supervisorude@energiapd.com	Jefe inmediato	\N	3	2025-11-06 22:59:04.395489+00	Completada	1
84	MAXWELL ALEXANDER LOPEZ FUNEZ	supervisorude@energiapd.com	Jefe inmediato	\N	4	2025-11-06 22:59:25.8279+00	Completada	1
85	MAXWELL ALEXANDER LOPEZ FUNEZ	supervisorude@energiapd.com	Sub-alterno	\N	5	2025-11-06 23:00:21.628838+00	Completada	1
86	MAXWELL ALEXANDER LOPEZ FUNEZ	supervisorude@energiapd.com	Compañero	\N	6	2025-11-06 23:00:39.224108+00	Completada	1
87	MAXWELL ALEXANDER LOPEZ FUNEZ	supervisorude@energiapd.com	Autoevaluacion	\N	7	2025-11-06 23:00:54.948798+00	Completada	1
79	JAMIL ENRIQUE MEJIA MARTINEZ	jmejia@energiapd.com	Autoevaluacion	\N	4	2025-11-06 22:49:11.960687+00	Completada	1
80	JAMIL ENRIQUE MEJIA MARTINEZ	jmejia@energiapd.com	Compañero	\N	5	2025-11-06 22:49:27.34898+00	Completada	1
81	JAMIL ENRIQUE MEJIA MARTINEZ	jmejia@energiapd.com	Compañero	\N	6	2025-11-06 22:51:00.347859+00	Completada	1
82	JAMIL ENRIQUE MEJIA MARTINEZ	jmejia@energiapd.com	Jefe inmediato	\N	7	2025-11-06 22:51:22.178592+00	Completada	1
99	TULIO GUSTAVO HERNANDEZ GUZMAN	tguzman@energiapd.com	Compañero	\N	3	2025-11-06 23:09:51.559186+00	Completada	1
68	DENNIS STIVEN ROMERO SAGASTUME	dromero@energiapd.com	Compañero	\N	3	2025-11-06 22:45:13.499316+00	Completada	1
89	NICOLAS ALEXI ALFARO CASTILLO	nalfaro@energiapd.com	Jefe inmediato	\N	3	2025-11-06 23:04:33.119768+00	Completada	1
100	TULIO GUSTAVO HERNANDEZ GUZMAN	tguzman@energiapd.com	Compañero	\N	4	2025-11-06 23:10:03.732432+00	Completada	1
101	TULIO GUSTAVO HERNANDEZ GUZMAN	tguzman@energiapd.com	Compañero	\N	5	2025-11-06 23:10:15.958592+00	Completada	1
69	DENNIS STIVEN ROMERO SAGASTUME	dromero@energiapd.com	Compañero	\N	4	2025-11-06 22:45:59.532257+00	Completada	1
103	TULIO GUSTAVO HERNANDEZ GUZMAN	tguzman@energiapd.com	Compañero	\N	5	2025-11-06 23:10:42.053922+00	Completada	1
70	DENNIS STIVEN ROMERO SAGASTUME	dromero@energiapd.com	Compañero	\N	5	2025-11-06 22:46:13.377663+00	Completada	1
71	DENNIS STIVEN ROMERO SAGASTUME	dromero@energiapd.com	Compañero	\N	6	2025-11-06 22:46:28.285888+00	Completada	1
105	Fabian Ordoñez	hordonez@energiapd.com	Cliente	\N	4	2025-11-06 23:22:12.173428+00	Completada	1
104	Fabian Ordoñez	hordonez@energiapd.com	Cliente	\N	3	2025-11-06 23:21:11.725657+00	Completada	1
106	Fabian Ordoñez	hordonez@energiapd.com	Cliente	\N	5	2025-11-06 23:22:24.615968+00	Completada	1
90	NICOLAS ALEXI ALFARO CASTILLO	nalfaro@energiapd.com	Jefe inmediato	\N	4	2025-11-06 23:04:59.683221+00	Completada	1
153	Erik Majano	emajano@energiapd.com	Cliente	\N	7	2025-11-06 23:44:34.708308+00	Completada	1
144	Mauricio Cruz	bodega@energiapd.com	Cliente	\N	3	2025-11-06 23:40:53.639949+00	Completada	1
146	Mauricio Cruz	bodega@energiapd.com	Cliente	\N	5	2025-11-06 23:41:26.584135+00	Completada	1
128	Dania Reyes	dreyes@energiapd.com	Cliente	\N	7	2025-11-06 23:30:44.49961+00	Completada	1
58	YONI HUMBERTO POSADAS RAMIREZ	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 22:31:26.141457+00	Completada	1
163	Oscar Leiva	oleiva@energiapd.com	Cliente	\N	7	2025-11-07 15:06:15.925212+00	Completada	1
139	Ema Galindo	presupuestos2@energiapd.com	Cliente	\N	3	2025-11-06 23:38:24.472198+00	Completada	1
156	Marco Hernandez	encargadoflotavehicular@energiapd.com	Cliente	\N	5	2025-11-07 15:06:15.925212+00	Completada	1
60	YONI HUMBERTO POSADAS RAMIREZ	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 22:32:07.625869+00	Completada	1
61	YONI HUMBERTO POSADAS RAMIREZ	kmelgar@energiapd.com	Sub-alterno	\N	6	2025-11-06 22:32:29.457145+00	Completada	1
62	YONI HUMBERTO POSADAS RAMIREZ	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 22:32:53.896269+00	Completada	1
27	FRANKLIN JARED CHAVEZ ALVARADO	kmelgar@energiapd.com	Sub-alterno	\N	3	2025-11-06 21:33:53.291369+00	Completada	1
28	FRANKLIN JARED CHAVEZ ALVARADO	kmelgar@energiapd.com	Sub-alterno	\N	4	2025-11-06 21:34:20.165258+00	Completada	1
29	FRANKLIN JARED CHAVEZ ALVARADO	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:34:56.633498+00	Completada	1
140	Ema Galindo	presupuestos2@energiapd.com	Cliente	\N	4	2025-11-06 23:39:46.679662+00	Completada	1
162	Oscar Leiva	oleiva@energiapd.com	Cliente	\N	6	2025-11-07 15:06:15.925212+00	Completada	1
132	Angela Ventura	aventura@energiapd.com	Cliente	\N	6	2025-11-06 23:36:40.421456+00	Completada	1
141	Ema Galindo	presupuestos2@energiapd.com	Cliente	\N	5	2025-11-06 23:40:02.768839+00	Completada	1
117	Cindy Ayala	recursoshumanos@energiapd.com	Cliente	\N	6	2025-11-06 23:25:50.984472+00	Completada	1
142	Ema Galindo	presupuestos2@energiapd.com	Cliente	\N	6	2025-11-06 23:40:15.268899+00	Completada	1
143	Ema Galindo	presupuestos2@energiapd.com	Cliente	\N	7	2025-11-06 23:40:28.564138+00	Completada	1
161	Oscar Leiva	oleiva@energiapd.com	Cliente	\N	5	2025-11-07 15:06:15.925212+00	Completada	1
133	Angela Ventura	aventura@energiapd.com	Cliente	\N	7	2025-11-06 23:36:51.968868+00	Completada	1
91	NICOLAS ALEXI ALFARO CASTILLO	nalfaro@energiapd.com	Jefe inmediato	\N	5	2025-11-06 23:06:19.109795+00	Completada	1
107	Fabian Ordoñez	hordonez@energiapd.com	Cliente	\N	6	2025-11-06 23:22:38.977107+00	Completada	1
92	NICOLAS ALEXI ALFARO CASTILLO	nalfaro@energiapd.com	Jefe inmediato	\N	6	2025-11-06 23:06:37.265995+00	Completada	1
108	Fabian Ordoñez	hordonez@energiapd.com	Cliente	\N	7	2025-11-06 23:23:07.614696+00	Completada	1
93	NICOLAS ALEXI ALFARO CASTILLO	nalfaro@energiapd.com	Jefe inmediato	\N	7	2025-11-06 23:06:56.429932+00	Completada	1
138	Bianca Lopez	presupuestos1@energiapd.com	Cliente	\N	7	2025-11-06 23:38:04.662079+00	Completada	1
149	Erik Majano	emajano@energiapd.com	Cliente	\N	3	2025-11-06 23:42:26.168568+00	Completada	1
160	Oscar Leiva	oleiva@energiapd.com	Cliente	\N	4	2025-11-07 15:06:15.925212+00	Completada	1
150	Erik Majano	emajano@energiapd.com	Cliente	\N	4	2025-11-06 23:43:57.507552+00	Completada	1
151	Erik Majano	emajano@energiapd.com	Cliente	\N	5	2025-11-06 23:44:08.589889+00	Completada	1
159	Oscar Leiva	oleiva@energiapd.com	Cliente	\N	3	2025-11-07 15:06:15.925212+00	Completada	1
152	Erik Majano	emajano@energiapd.com	Cliente	\N	6	2025-11-06 23:44:24.128067+00	Completada	1
157	Marco Hernandez	encargadoflotavehicular@energiapd.com	Cliente	\N	6	2025-11-07 15:06:15.925212+00	Completada	1
154	Marco Hernandez	encargadoflotavehicular@energiapd.com	Cliente	\N	3	2025-11-07 15:06:15.925212+00	Completada	1
19	EDGAR OTONIEL MORENO AGUILAR	kmelgar@energiapd.com	Sub-alterno	\N	5	2025-11-06 21:26:04.321104+00	Completada	1
158	Marco Hernandez	encargadoflotavehicular@energiapd.com	Cliente	\N	7	2025-11-07 15:06:15.925212+00	Completada	1
155	Marco Hernandez	encargadoflotavehicular@energiapd.com	Cliente	\N	4	2025-11-07 15:06:15.925212+00	Completada	1
134	Bianca Lopez	presupuestos1@energiapd.com	Cliente	\N	3	2025-11-06 23:37:08.85615+00	Completada	1
145	Mauricio Cruz	bodega@energiapd.com	Cliente	\N	4	2025-11-06 23:41:13.952064+00	Completada	1
135	Bianca Lopez	presupuestos1@energiapd.com	Cliente	\N	4	2025-11-06 23:37:21.453671+00	Completada	1
136	Bianca Lopez	presupuestos1@energiapd.com	Cliente	\N	5	2025-11-06 23:37:39.539165+00	Completada	1
102	TULIO GUSTAVO HERNANDEZ GUZMAN	tguzman@energiapd.com	Autoevaluacion	\N	6	2025-11-06 23:10:32.466178+00	Completada	1
137	Bianca Lopez	presupuestos1@energiapd.com	Cliente	\N	6	2025-11-06 23:37:51.047251+00	Completada	1
147	Mauricio Cruz	bodega@energiapd.com	Cliente	\N	6	2025-11-06 23:41:38.877386+00	Completada	1
42	JULIO CESAR PEREZ CUELLAR	kmelgar@energiapd.com	Sub-alterno	\N	7	2025-11-06 21:47:06.210659+00	Completada	1
148	Mauricio Cruz	bodega@energiapd.com	Cliente	\N	7	2025-11-06 23:42:00.279561+00	Completada	1
164	DENNIS STIVEN ROMERO SAGASTUME	dromero@energiapd.com	Compañero	\N	7	2025-11-07 20:21:46.46093+00	Completada	1
\.


--
-- TOC entry 3560 (class 0 OID 24581)
-- Dependencies: 216
-- Data for Name: evaluados; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.evaluados (id, nombre, puesto, area, fecha_registro, activo, ciclo_id) FROM stdin;
3	Hector Suazo	Ingeniero USED	Tecnica	2025-11-06 20:56:18.398408+00	t	1
4	Jamil Mejia	Ingeniero USED	Tecnica	2025-11-06 20:56:37.965396+00	t	1
5	Marlon Solis	Ingeniero USED	Tecnica	2025-11-06 20:57:31.161819+00	t	1
6	Tulio Hernandez	Ingeniero USED	Tecnica	2025-11-06 21:08:58.415723+00	t	1
7	Maxwell Lopez	Tecnico supervisor USED	Tecnica	2025-11-06 21:09:24.340848+00	t	1
\.


--
-- TOC entry 3576 (class 0 OID 24856)
-- Dependencies: 236
-- Data for Name: groups; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.groups (id, ciclo_id, dimension_id, nombre, orden, created_at, updated_at) FROM stdin;
1	1	1	Gestión del Desempeño	1	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
2	1	1	Ser Modelo	2	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
3	1	1	Perseverancia y Resiliencia	3	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
4	1	2	Apoyo	1	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
5	1	2	Conducta Ética	2	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
6	1	2	Respeto	3	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
7	1	3	Pensamiento Positivo	1	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
8	1	3	Gestión Emocional	2	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
9	1	3	Autoconocimiento	3	2025-11-13 20:49:57.277079+00	2025-11-13 20:49:57.277079+00
\.


--
-- TOC entry 3568 (class 0 OID 24661)
-- Dependencies: 224
-- Data for Name: respuestas; Type: TABLE DATA; Schema: public; Owner: evaluaciones_user
--

COPY public.respuestas (evaluacion_id, competencia_id, valor, comentario) FROM stdin;
117	38	5	
117	39	5	
117	40	5	
117	41	2	
117	42	2	
117	43	2	
117	44	3	
117	45	3	
117	60	0	
117	61	0	
118	38	2	
118	39	3	
118	40	4	
118	41	3	
118	42	4	
118	43	2	
118	44	2	
118	45	3	
118	60	0	Es una persona comprometida con su trabajo, con buena disposición para apoyar cuando se le requiere en su área. Demuestra responsabilidad en la ejecución de sus tareas y mantiene interés por cumplir sus funciones asignadas.
118	61	0	Debería enfocarse en fortalecer el cumplimiento de los procesos establecidos y en mejorar la gestión y seguimiento de las actividades bajo su responsabilidad.
119	38	5	
119	39	5	
119	40	4	
119	41	4	
7	38	5	
7	39	4	
7	40	5	
7	41	5	
7	42	5	
7	43	5	
7	44	5	
7	45	5	
7	60	0	influir positivamente en un equipo, estratégico en toma de decisiones
7	61	0	delegación y empoderamiento
8	38	3	
8	39	4	
8	40	3	
8	41	3	
8	42	4	
8	43	4	
8	44	4	
8	45	4	
8	60	0	la capacidad de delegar tareas
8	61	0	comunicación efectiva
9	38	4	
9	39	4	
9	40	4	
9	41	3	
9	42	4	
9	43	4	
9	44	3	
9	45	3	
9	60	0	No lo conozco desde ese punto, creeria que su experiencia lo puede impulsar
9	61	0	Comunicacion y actitud
10	38	5	
10	39	5	
10	40	5	
10	41	3	
10	42	5	
10	43	3	
10	44	4	
10	45	4	
10	60	0	No trabajo directamente con el, no podria decir esas fortalezas por que solo hay comunicacion especifica por clientes.
10	61	0	Su comunicacion, no es comunicativo , no expresa bien
11	38	5	
11	39	5	
11	40	5	
11	41	3	
11	42	5	
11	43	4	
11	44	4	
11	45	4	
11	60	0	Es el companero con el cual  he tenido mas relacion de la parte tecnica y podria decir que es una persona inteligente, que tiene experiencia y que tiene bastante conocimiento.
11	61	0	Su inteligencia emocional
12	38	3	
12	39	3	
12	40	4	
12	41	2	
12	42	2	
12	43	3	
12	44	3	
12	45	3	
12	60	0	Su experiencia
12	61	0	Su comunicacion, su inteligencia emocional, es muy cambiante de humor.
13	38	4	
13	39	4	
13	40	4	
13	41	4	
13	42	4	
13	43	4	
13	44	4	
13	45	4	
13	60	0	No trabajo directamente con el, no podria decir esas fortalezas por que solo hay comunicacion especifica por clientes
13	61	0	Su comunicacion, expresarse correctamente
14	38	4	
14	39	4	
14	40	5	
14	41	4	
14	42	4	
14	43	3	
14	44	4	
14	45	3	
14	60	0	Tiene mucha experiencia y conocimiento, lo cual considero le permite liderar un equipo de trabajo y orientarlo para poder desarrollar las actividades de manera efectiva. Esas mismas fortalezas, le permiten que el personal tenga confienza, puedan escucharlo y dejarse orientar.
14	61	0	Empoderarse un poco más, tener seguridad de sus criterios al momento de desarrollar un trabajo.
15	28	5	
15	29	5	
15	30	4	
15	31	4	
15	32	5	
15	33	4	
15	34	4	
15	35	5	
15	36	5	
15	37	5	
15	60	0	Siempre se pone al lado de los técnicos al realizar un trabajo y brinda instrucciones claras y es muy bueno encontrando la solución a los problemas
15	61	0	.
16	28	5	
16	29	4	
16	30	3	
16	31	4	
16	32	5	
16	33	3	
16	34	4	
16	35	4	
16	36	3	
16	37	4	
16	60	0	Es muy bueno en analizar los puntos para los trabajos a realizar y dar las mejores soluciones
16	61	0	Darle seguimiento al plan de carrera de cada técnico
17	38	4	
17	39	5	
17	40	5	
17	41	4	
17	42	5	
17	43	4	
17	44	4	
17	45	4	
17	60	0	Conocimiento, experiencia y empoderamiento/autoridad para poder guiar su equipo de trabajo.
17	61	0	Motivar al resto de su equipo para que puedan crecer profesionalmente y alenatarles para fomentar el ambiente de equipo mas cercano y ameno.
18	28	5	
18	29	5	
18	30	5	
18	31	5	
18	32	5	
18	33	5	
18	34	5	
18	35	5	
18	36	5	
18	37	5	
18	60	0	No tiene problemas en compartir su conocimiento con los técnicos
18	61	0	.
19	28	4	
19	29	4	
19	30	4	
19	31	4	
19	32	5	
19	33	5	
19	34	5	
19	35	4	
19	36	5	
19	37	4	
19	60	0	Siempre mira por el bienestar de los técnicos
19	61	0	.
20	38	5	
20	39	5	
20	40	5	
20	41	4	
20	42	5	
20	43	5	
20	44	4	
20	45	4	
20	60	0	Conocimiento técnico y espiritu de líder, empoderando a su equipo.
20	61	0	Fortalezer en tema de inteligencia emocional
21	28	5	
21	29	5	
21	30	5	
21	31	3	
21	32	4	
21	33	4	
21	34	4	
21	35	5	
21	36	3	
21	37	4	
21	60	0	Es alguien que está pendiente de todo y siempre trabaja a la par del técnico
21	61	0	No tener favoritismo con los técnicos
22	38	5	
22	39	5	
22	40	4	
22	41	5	
22	42	5	
22	43	5	
22	44	3	
22	45	4	
22	60	0	Se toma el tiempo de explicar parte de procesos si se le solicita
22	61	0	mejor coordinación de tiempos
23	38	4	
23	39	2	
23	40	5	
23	41	2	
23	42	4	
23	43	3	
23	44	3	
23	45	5	
23	60	0	
23	61	0	
24	38	4	
24	39	5	
24	40	5	
24	41	2	
24	42	4	
24	43	2	
24	44	3	
24	45	2	
24	60	0	Conocimiento técnico
24	61	0	Trabajar en el espíritu de liderazo y mejorar comunicación con cliente interno y con cliente externo al momento de estar en campo.
25	38	5	
25	39	4	
25	40	4	
25	41	4	
25	42	5	
25	43	5	
25	44	4	
25	45	5	
25	60	0	
25	61	0	
26	38	4	
26	39	5	
26	40	5	
26	41	3	
26	42	4	
26	43	4	
26	44	5	
26	45	3	
26	60	0	
26	61	0	
27	38	4	
27	39	4	
27	40	4	
27	41	4	
27	42	4	
27	43	5	
27	44	3	
27	45	4	
27	60	0	
27	61	0	
28	38	4	
28	39	4	
28	40	5	
28	41	5	
28	42	4	
28	43	4	
28	44	3	
28	45	3	
28	60	0	Conocimiento tecnico y experiencia en el rubro.
28	61	0	Trabajar en la motivación propia para poder incentivar a los demás que estan bajo su cargo.
29	38	4	
29	39	3	
29	40	4	
29	41	4	
29	42	4	
29	43	4	
29	44	4	
29	45	4	
29	60	0	Es una persona que pone orden en su área, es imparcial, asume cuando tiene oportunidades de mejora
29	61	0	empoderarlo mas en el área, darle mas don de mando... la mayoría de los lideres del área tienen un actitud que no es favorable y no es un buen ejemplo
30	38	3	
30	39	1	
30	40	3	
30	41	1	
30	42	4	
30	43	4	
30	44	2	
30	45	3	
30	60	0	Podría llegar a ser una gran influencia positiva en la empresa y adoptara los valores que nos definen: ser comunicativo, responsable, tener credibilidad etc. pero actualmente percibo que no tiene un liderazgo positivo.
30	61	0	Debería ser un buen ejemplo en su área, ser responsable, tener mas carácter: al momento de enterarse de una falta tomar decisiones acertadas y no dejarlas pasar por encima sino que tomar acción como líder de la unidad técnica mas grande de la empresa. asumir las consecuencias de sus actos y no responder con negativas, exaltaciones o excusando sus actos o los de otros compañeros.
31	28	4	
31	29	4	
31	30	4	
31	31	3	
31	32	5	
31	33	3	
31	34	4	
31	35	3	
31	36	4	
31	37	3	
31	60	0	
31	61	0	
32	28	4	
32	29	5	
32	30	4	
32	31	2	
32	32	5	
32	33	5	
32	34	4	
32	35	3	
32	36	4	
32	37	4	
32	60	0	
32	61	0	
33	38	2	
33	39	2	
33	40	2	
33	41	2	
33	42	4	
33	43	3	
33	44	3	
33	45	1	
33	60	0	
33	61	0	Su actitud en muchas ocasiones es respaldar conductas inadecuadas de su personal, le falta empoderarse y tomar responsabilidad de líder de la unidad técnica, no ser tan condescendiente con el personal que comete fallas una y otra vez. \nSer responsable y asumir cuando debe mejorar algo o se equivoco en algo por no cumplir lo establecido \nSer un ejemplo para su personal a cargo, cumplir con el uso de EPP y exigirle a su personal
34	38	5	
34	39	5	
34	40	5	
34	41	5	
34	42	5	
34	43	5	
34	44	5	
34	45	4	
34	60	0	Apoyo continuo.\nComunicacion\nColabora para dar idea y solucionar.
34	61	0	
35	28	5	
35	29	5	
35	30	5	
35	31	5	
35	32	5	
35	33	5	
35	34	5	
35	35	5	
35	36	5	
35	37	5	
35	60	0	
35	61	0	
36	28	5	
36	29	5	
36	30	5	
36	31	5	
36	32	5	
36	33	5	
36	34	5	
36	35	5	
36	36	5	
36	37	5	
36	60	0	
36	61	0	
37	28	4	
37	29	4	
37	30	4	
37	31	4	
37	32	4	
37	33	4	
37	34	4	
37	35	4	
37	36	4	
37	37	4	
37	60	0	
37	61	0	
38	38	4	
38	39	4	
38	40	4	
38	41	4	
38	42	4	
38	43	5	
38	44	4	
38	45	4	
38	60	0	Apertura para comunicarse con su equipo, actitud positiva, iniciativa y voluntad para querer generar y aplicar cambios en su equipo de trabajo. Una persona que intenta tener equilibrio en su entorno laboral y conciente de las falencias de su equipo
38	61	0	Impulsar mas su liderazgo
39	38	3	
39	39	3	
39	40	2	
39	41	3	
39	42	5	
39	43	3	
39	44	2	
39	45	2	
39	60	0	
39	61	0	Una de los aspectos de un lider es poder motivar al personal y hacer ver que puede realizar su trabajo de la mejor manera. No lo tiene.\nA partir de ahi puede desarrollarse para mejorar.
40	38	5	
40	39	5	
40	40	4	
40	41	5	
40	42	5	
40	43	5	
40	44	5	
40	45	5	
40	60	0	Autogestión \nGestión del personal \nCriterio
40	61	0	
41	19	4	
41	20	4	
41	21	4	
41	22	4	
41	23	4	
41	24	4	
41	25	4	
41	59	4	
41	60	0	Es diplomático, respetuoso y es un gran soporte técnico, el personal lo respeta significativamente.
41	61	0	Planificación más a detalle, disminuir el asumir y mayor sentido de urgencia.
42	38	5	
42	39	4	
42	40	4	
42	41	4	
42	42	5	
42	43	5	
42	44	5	
42	45	4	
42	60	0	Organizado \nPlanifica
42	61	0	Criterio propio, se influencia de diferentes partes y parece no se congruente en ocaciones
43	38	5	
43	39	4	
43	40	4	
43	41	4	
43	42	4	
43	43	5	
43	44	5	
43	45	4	
43	60	0	Gestión grupos de trabajo \nmano del personal
43	61	0	Presentar mayor carácter, se influencia rápido
44	38	3	
44	39	3	
44	40	3	
44	41	3	
44	42	4	
44	43	3	
44	44	2	
44	45	2	
44	60	0	
44	61	0	
45	38	4	
45	39	3	
45	40	4	
45	41	3	
45	42	3	
45	43	4	
45	44	4	
45	45	3	
45	60	0	Coordina actividades.
45	61	0	Autogestión\ncontrol del personal
46	38	4	
46	39	5	
46	40	5	
46	41	5	
46	42	4	
46	43	4	
46	44	5	
46	45	5	
46	60	0	Autogestión\nControl de los equipos de trabajo
46	61	0	Planificación \nToma de decisiones
47	38	4	
47	39	4	
47	40	5	
47	41	4	
47	42	4	
47	43	5	
47	44	4	
47	45	3	
47	60	0	Disposicion para alcanzar lo establecido.
47	61	0	Caracter.
48	38	4	
48	39	4	
48	40	4	
48	41	4	
48	42	5	
48	43	3	
48	44	4	
48	45	3	
48	60	0	Responsabilidad en el cumplimiento de las tareas asignadas por sus superiores
48	61	0	Mostrar más interés en la colaboración con los demás departamentos de la empresa
49	38	2	
49	39	1	
49	40	2	
49	41	2	
49	42	4	
49	43	2	
49	44	3	
49	45	1	
49	60	0	
49	61	0	Tener mas voz de mando, ser mas comunicativo, tener una actitud mas proactiva, ejercer un liderazgo positivo en su área
50	38	3	
50	39	3	
50	40	2	
50	41	3	
50	42	3	
50	43	3	
50	44	2	
50	45	3	
50	60	0	Conocimiento y experiencia en su area
50	61	0	Comunicación, delegar trabajos segun la capacidad de cada colaborador, conocer a sus colaboradores mediante evaluaciones medibles
51	38	4	
51	39	4	
51	40	4	
51	41	4	
51	42	4	
51	43	4	
51	44	4	
51	45	4	
51	60	0	Disposición de aprender y de contribuir con el equipo
51	61	0	Empoderamiento del puesto. Asumir la responsabilidad que conlleva su puesto de trabajo y liderar al equipo de forma positiva
52	38	4	
52	39	4	
52	40	4	
52	41	4	
52	42	4	
52	43	4	
52	44	4	
52	45	3	
52	60	0	
52	61	0	Caracter.
53	38	5	
53	39	5	
53	40	5	
53	41	5	
53	42	5	
53	43	4	
53	44	4	
53	45	3	
53	60	0	Es respetuoso, mantiene la calma y posee conocimiento técnico avanzado
53	61	0	No muestra interés en colaborar con otras áreas de la empresa
54	38	4	
54	39	4	
54	40	4	
54	41	4	
54	42	4	
54	43	4	
54	44	4	
54	45	4	
54	60	0	
54	61	0	Empoderamiento del puesto y las responsabilidades que conlleva guiar a su equipo de trabajo,
55	38	1	
55	39	1	
55	40	2	
55	41	1	
55	42	3	
55	43	2	
55	44	2	
55	45	1	
55	60	0	ninguna, no ejerce un liderazgo positivo
55	61	0	Ser responsable, comunicativo, mejorar su compromiso
56	19	5	
56	20	5	
56	21	5	
56	22	5	
56	23	5	
56	24	4	
56	25	5	
56	59	5	
56	60	0	Mentoría y transferencia de conocimiento\n\nEscucha activa y empatía técnica\n\nColaboración y trabajo en equipo
56	61	0	Considero oportunidades de mejora en planificación y procedimientos administrativos
57	28	5	
57	29	5	
57	30	5	
57	31	5	
57	32	5	
57	33	5	
57	34	5	
57	35	5	
57	36	5	
57	37	5	
57	60	0	Siempre escucha ideas y las apoya cuando son buenas
57	61	0	.
58	38	4	
58	39	4	
58	40	4	
58	41	3	
58	42	4	
58	43	3	
58	44	4	
58	45	3	
58	60	0	Conocimiento en su area
58	61	0	Ejecutar de manera positiva su liderazgo, empoderamiento ante su equipo de trabajo, actitud
59	28	5	
59	29	4	
59	30	4	
59	31	2	
59	32	4	
59	33	4	
59	34	2	
59	35	3	
59	36	4	
59	37	4	
59	60	0	Aporta conocimiento para desarrollar el trabajo
59	61	0	Empatía
60	28	3	
60	29	4	
60	30	3	
60	31	2	
60	32	4	
60	33	4	
60	34	2	
60	35	3	
60	36	3	
60	37	4	
60	60	0	Buena relación de vez en cuando
60	61	0	No cargar tanto al técnico psicológicamente
61	19	3	
61	20	5	
61	21	3	
61	22	3	
61	23	2	
61	24	2	
61	25	1	
61	59	5	
61	60	0	Actualización de conocimientos activamente\n\nBusca innovar procedimientos del área
61	61	0	Manejo de emociones y como estas afectan el entorno\n\nManejo de conflictos\n\nControl ante los cambios, para no actuar por impulso
62	38	4	
62	39	4	
62	40	5	
62	41	4	
62	42	5	
62	43	4	
62	44	4	
62	45	5	
62	60	0	capacidad de organización y ejecución de actividades técnicas relacionadas al trabajo asignado
62	61	0	Su temperamento, es explosivo en sus reacciones con el personal a cargo
63	28	5	
63	29	5	
63	30	5	
63	31	5	
63	32	5	
63	33	5	
63	34	5	
63	35	4	
63	36	5	
63	37	5	
63	60	0	Se pone el equipo al hombro cuando es necesario
63	61	0	Ninguno
64	28	4	
64	29	3	
64	30	3	
64	31	1	
64	32	2	
64	33	1	
64	34	3	
64	35	2	
64	36	4	
64	37	2	
64	60	0	
64	61	0	Debería de dar un mejor trato al técnico ya que en ocasiones es muy incomprensible
65	38	4	
65	39	4	
65	40	5	
65	41	2	
65	42	5	
65	43	3	
65	44	4	
65	45	4	
65	60	0	Capacidad analítica, coordinación y proactiva
65	61	0	Mejoras en la comunicación con otras áreas de la empresa y apegarse en el cumplimiento de procedimientos de los clientes internos
66	47	4	
66	48	4	
66	49	5	
66	51	5	
66	53	4	
66	54	5	
66	55	5	
66	56	3	
66	57	4	
66	58	3	
66	60	0	Responsabilidad\nResilencia\nDisposición continua para el aprendizaje
66	61	0	Planificación\nManejo de conflictos\nEscucha activa\nProcrastinación
67	38	5	
67	39	5	
67	40	5	
67	41	5	
67	42	5	
67	43	5	
67	44	5	
67	45	5	
67	60	0	Responsabilidad, alto conocimiento técnico, entregado a su trabajo y proactivo
67	61	0	sin comentarios
68	19	4	
68	20	4	
68	21	4	
68	22	4	
68	23	4	
68	24	4	
68	25	4	
68	59	4	
68	60	0	Responsabilidad\nTolerante\nEscucha activa\nAnálitico
68	61	0	Empoderamiento\nPlanificación
69	11	4	
69	12	3	
69	13	5	
69	14	4	
69	15	4	
69	16	4	
69	17	5	
69	18	4	
69	60	0	Control de emociones\nGestión de equipos\nFlexibilidad al cambio
69	61	0	Planificación\nEmpoderamiento
70	28	4	
70	29	4	
70	30	2	
70	31	2	
70	32	4	
70	33	3	
70	34	2	
70	35	4	
70	36	4	
70	37	3	
70	60	0	Tiene una visión clara, toma de decisiones
70	61	0	Comunicación efectiva, inteligencia emocional y empatía, la capacidad de delegar actividades confiando en su equipo
71	28	4	
71	29	5	
71	30	4	
71	31	4	
71	32	5	
71	33	4	
71	34	3	
71	35	4	
71	36	3	
71	37	4	
71	60	0	Comunicación, empatía y adaptabilidad
71	61	0	Su liderazgo en ciertas situaciones, sentido de urgencia, ver más hacia futuro
72	28	3	
72	29	4	
72	30	2	
72	31	3	
72	32	4	
72	33	4	
72	34	3	
72	35	3	
72	36	4	
72	37	5	
72	60	0	Es una persona que motiva a los demás, delega actividades
72	61	0	Asumir que una persona hará una actividad como el la pensó, lo que hace que le ocasione problemas a la otra persona al momento de ejecutar la actividad
73	47	5	
73	48	4	
73	49	4	
73	51	5	
73	53	4	
73	54	4	
73	55	5	
73	56	4	
73	57	4	
73	58	4	
73	60	0	Competencias técnicas
73	61	0	Priorizar
74	19	3	
74	20	4	
74	21	3	
74	22	3	
74	23	3	
74	24	3	
74	25	3	
74	59	3	
74	60	0	Competencia técnica
74	61	0	Comunicación y planificación
75	28	3	
75	29	4	
75	30	2	
75	31	5	
75	32	5	
75	33	3	
75	34	3	
75	35	3	
75	36	3	
75	37	5	
75	60	0	Compresivo, empatico y muy profesional
75	61	0	Ser más autoritario, mejorar comunicación
76	19	3	
76	20	3	
76	21	4	
76	22	4	
76	23	3	
76	24	4	
76	25	3	
76	59	4	
76	60	0	Colaboración
76	61	0	Competencias técnicas
77	11	4	
77	12	4	
77	13	3	
77	14	4	
77	15	3	
77	16	3	
77	17	4	
77	18	4	
77	60	0	Profesional
77	61	0	Competencias técnicas en el puesto
78	11	4	
78	12	3	
78	13	4	
78	14	3	
78	15	3	
78	16	2	
78	17	4	
78	18	4	
78	60	0	Conocimiento técnico
78	61	0	Toma de decisiones,\nplanificación y administración del recurso
79	28	4	
79	29	5	
79	30	3	
79	31	3	
79	32	4	
79	33	5	
79	34	4	
79	35	3	
79	36	3	
79	37	4	
79	60	0	Resolución de problemas a la hora de hacer un trabajo, responsable
79	61	0	Comunicación, y inteligencia emocional
80	28	4	
80	29	3	
80	30	3	
80	31	3	
80	32	4	
80	33	4	
80	34	4	
80	35	3	
80	36	4	
80	37	4	
80	60	0	Toma la iniciativa y ayuda a la área técnica a desarrollar las actividades
80	61	0	Distribuir un poco las cargas de trabajo
81	28	5	
81	29	5	
81	30	5	
81	31	5	
81	32	5	
81	33	5	
81	34	5	
81	35	5	
81	36	5	
81	37	5	
81	60	0	
81	61	0	
82	28	4	
82	29	5	
82	30	5	
82	31	5	
82	32	5	
82	33	5	
82	34	4	
82	35	5	
82	36	5	
82	37	5	
82	60	0	
82	61	0	
83	28	5	
83	29	5	
83	30	5	
83	31	5	
83	32	5	
83	33	5	
83	34	4	
83	35	5	
83	36	5	
83	37	5	
83	60	0	
83	61	0	
84	28	5	
84	29	5	
84	30	5	
84	31	5	
84	32	5	
84	33	5	
84	34	5	
84	35	5	
84	36	5	
84	37	5	
84	60	0	
84	61	0	
85	28	5	
85	29	5	
85	30	4	
85	31	5	
85	32	5	
85	33	4	
85	34	4	
85	35	4	
85	36	4	
85	37	5	
85	60	0	Apoyar en actividad complejas, respeto y comunicación en el desarrollo del trabajo
85	61	0	En mi opinión sería darle destreza al técnico en mejorar sus habilidades técnicas en trabajos ya que se sobre desespera
86	11	4	
86	12	4	
86	13	4	
86	14	4	
86	15	4	
86	16	4	
86	17	4	
86	18	4	
86	60	0	Actitud
86	61	0	Comunicacion
87	11	4	
87	12	4	
87	13	4	
87	14	4	
87	15	4	
87	16	4	
87	17	4	
87	18	4	
87	60	0	Es Analítico
87	61	0	Debería Mejorar La Forma de transmitir mensajes
88	28	4	
88	29	4	
88	30	4	
88	31	4	
88	32	4	
88	33	4	
88	34	4	
88	35	4	
88	36	4	
88	37	4	
88	60	0	Empatía
88	61	0	Ser menos impulsivo
89	28	5	
89	29	4	
89	30	4	
89	31	4	
89	32	4	
89	33	5	
89	34	4	
89	35	4	
89	36	4	
89	37	4	
89	60	0	En temas de trabajo, ayuda el apoyo en soluciones y tratar de que el personal técnico también pueda brindar soluciones al momento de cada actividad
89	61	0	Comunicación efectiva con el personal técnico
90	38	4	
90	39	4	
90	40	4	
90	41	5	
90	42	4	
90	43	5	
90	44	5	
90	45	5	
90	60	0	Destaco su compromiso con la mejora continua y su disposición para aprender y aplicar nuevos métodos de trabajo. Muestra responsabilidad en sus funciones, atención al detalle y buena organización.
90	61	0	Podría continuar fortaleciendo su capacidad de comunicación y delegación, especialmente en la coordinación con otros equipos o áreas
91	19	4	
91	20	4	
91	21	4	
91	22	4	
91	23	4	
91	24	4	
91	25	4	
91	59	4	
91	60	0	Mantiene la calma En situaciones dificiles
91	61	0	Ser seguro de sí mismo
92	28	5	
92	29	5	
92	30	5	
92	31	5	
92	32	5	
92	33	5	
92	34	5	
92	35	5	
92	36	5	
92	37	5	
92	60	0	En la organización y en el apoyo de trabajos, en la comunicación para poder explicar, ayuda a orientar al técnico en mejorar su rendimiento
92	61	0	En mi persona , considero que fortalece un buen liderazgo en campo
93	47	4	
93	48	3	
93	49	4	
93	51	4	
93	53	4	
93	54	5	
93	55	4	
93	56	3	
93	57	4	
93	58	4	
93	60	0	Me considero Un Líder, Influyó bastante En mi personal a cargo
93	61	0	Debería mejorar mi temperamento
94	38	2	
94	39	2	
94	40	4	
94	41	3	
94	42	4	
94	43	3	
94	44	1	
94	45	3	
94	60	0	Posee disposición y conocimientos necesarios para desempeñar sus labores. Muestra compromiso con las tareas asignadas y mantiene una actitud colaborativa cuando necesita adecuadamente. Su experiencia técnica le permite comprender los procesos operativos, lo cual puede servir de base para fortalecer su liderazgo.
94	61	0	Debería trabajar en el seguimiento de las tareas y la organización de sus procesos para garantizar una ejecución más eficiente. También debe fomentar la importancia de la comunicación de su equipo con otras áreas.
95	38	5	
95	39	5	
95	40	5	
95	41	5	
95	42	5	
95	43	5	
95	44	5	
95	45	5	
95	60	0	Comunicación, empatía, integridad, responsabilidad y confianza de si mismo.
95	61	0	todo esta bien con el.
96	28	4	
96	29	5	
96	30	4	
96	31	5	
96	32	5	
96	33	5	
96	34	4	
96	35	4	
96	36	5	
96	37	5	
96	60	0	Apoya en cada trabajo, y la comunicación efectiva
96	61	0	Ser seguro en tomar decisiones de trabajo
97	38	5	
97	39	4	
97	40	4	
97	41	3	
97	42	3	
97	43	5	
97	44	4	
97	45	5	
97	60	0	
97	61	0	
98	28	5	
98	29	5	
98	30	5	
98	31	5	
98	32	5	
98	33	5	
98	34	5	
98	35	5	
98	36	5	
98	37	5	
98	60	0	En qué se destaca en temas de experiencia y aprendizaje en cada personal y ayuda el técnico en muchos casos a desarrollar actividades
98	61	0	Tiene un buen liderazgo en campo
99	47	4	
99	48	4	
99	49	3	
99	51	4	
99	53	4	
99	54	4	
99	55	4	
99	56	3	
99	57	3	
99	58	4	
99	60	0	Soluciones técnicas, soporte técnico al personal
99	61	0	Evitar hablar con sarcasmo y de manera directa, ser más diplomático en la comunicación del personal y capacitar al personal técnicamente. Ser mas exigente y no permisivo
100	19	4	
100	20	3	
100	21	4	
100	22	3	
100	23	2	
100	24	2	
100	25	2	
100	59	3	
112	35	5	
100	60	0	Curva de aprendizaje rápida, tiene sentido de superación
100	61	0	Mayor confianza en él mismo, hablar más con los técnicos cuando ellos fallan, no tomarse las cosas personales, planificación
101	19	4	
101	20	3	
101	21	4	
101	22	1	
101	23	1	
101	24	2	
101	25	2	
101	59	2	
101	60	0	Disponibilidad, respetuoso y solidario
101	61	0	Iniciativa, planificación, sentido de superación, voluntad comunicacional
102	28	5	
102	29	5	
102	30	5	
102	31	5	
102	32	5	
102	33	5	
102	34	5	
102	35	5	
102	36	5	
102	37	5	
102	60	0	Trata al equipo técnico con respeto y profesionalimo\nLa paciencia que nos tiene
102	61	0	Creo que nada
103	11	3	
103	12	2	
103	13	4	
103	14	3	
103	15	2	
103	16	3	
103	17	3	
103	18	1	
103	60	0	Tiene buen liderazgo, los técnicos confían en él, conoce la mayoría de los trabajos.
103	61	0	Enfocar su liderazgo, mantener una línea con los técnicos, ser positivo y no negativo, tener sentido de pertenencia y responsabilidad
104	28	5	
104	29	5	
104	30	5	
104	31	5	
104	32	4	
104	33	5	
104	34	5	
104	35	4	
104	36	5	
104	37	5	
104	60	0	Ayuda y enseña de la mejor manera \nEs comprensible
104	61	0	
105	28	5	
105	29	5	
105	30	5	
105	31	5	
105	32	5	
105	33	5	
105	34	5	
105	35	5	
105	36	5	
105	37	5	
105	60	0	Creatividad, comunicación, dedicación
105	61	0	Mantener la calma bajo Presión
106	28	3	
106	29	3	
106	30	3	
106	31	4	
106	32	2	
106	33	3	
106	34	2	
106	35	3	
106	36	3	
106	37	1	
106	60	0	
106	61	0	
107	28	5	
107	29	5	
107	30	5	
107	31	5	
107	32	5	
107	33	5	
107	34	5	
107	35	5	
107	36	5	
107	37	5	
107	60	0	Comprensión a los técnicos \nBuen liderazgo \nSabe distribuir roles en trabajo
107	61	0	
108	28	5	
108	29	5	
108	30	5	
108	31	5	
108	32	5	
108	33	5	
108	34	5	
108	35	5	
108	36	5	
108	37	5	
108	60	0	Dominio Técnico sólido
108	61	0	Toma de decisiones
109	28	2	
109	29	2	
109	30	3	
109	31	3	
109	32	1	
109	33	3	
109	34	2	
109	35	1	
109	36	1	
109	37	1	
109	60	0	Siento que el no es un lider solo un jefe
109	61	0	Todos
110	28	5	
110	29	5	
110	30	5	
110	31	5	
110	32	5	
110	33	5	
110	34	5	
110	35	5	
110	36	5	
110	37	5	
110	60	0	
110	61	0	Falta de liderazgo al momento de dar órdenes en específico en el trabajo \nQue no permita le falten el respeto
111	28	5	
111	29	5	
111	30	5	
111	31	5	
111	32	5	
111	33	5	
111	34	5	
111	35	5	
111	36	5	
111	37	5	
111	60	0	
111	61	0	
112	28	5	
112	29	5	
112	30	5	
112	31	5	
112	32	5	
112	33	5	
112	34	5	
112	36	5	
112	37	5	
112	60	0	Forma y Guía a Técnicos
112	61	0	Tomar decisiones
113	28	3	
113	29	3	
113	30	3	
113	31	5	
113	32	4	
113	33	5	
113	34	5	
113	35	3	
113	36	5	
113	37	3	
113	60	0	Reconocer el esfuerzo que se hace en los trabajos
113	61	0	La comunicación \nMantener la calma bajo presión
114	28	5	
114	29	5	
114	30	5	
114	31	5	
114	32	5	
114	33	5	
114	34	5	
114	35	5	
114	36	5	
114	37	5	
114	60	0	Dominio Técnico
114	61	0	Delegación de Tareas y Gestión de Tiempo
115	38	5	
115	39	4	
115	40	5	
115	41	2	
115	42	2	
115	43	2	
115	44	2	
115	45	2	
115	60	0	
115	61	0	
116	28	5	
116	29	5	
116	30	5	
116	31	5	
116	32	5	
116	33	5	
116	34	5	
116	35	5	
116	36	5	
116	37	5	
116	60	0	Rigurosidad
116	61	0	Reconocimiento
119	42	4	
119	43	4	
119	44	4	
119	45	4	
119	60	0	
119	61	0	
120	38	2	
120	39	4	
120	40	4	
120	41	3	
120	42	4	
120	43	3	
120	44	2	
120	45	2	
120	60	0	Es una persona comprometida con su trabajo y con buena disposición para apoyar cuando se le necesita.
120	61	0	Debe fortalecer el cumplimiento de procesos y gestiones internas de la compañía.
121	28	4	
121	29	4	
121	30	3	
121	31	3	
121	32	4	
121	33	3	
121	34	4	
121	35	2	
121	36	4	
121	37	3	
121	60	0	Lo bastante que sabe y está dispuesto a enseñar
121	61	0	Brindar apoyo cuando el equipo ya está cansado
122	38	1	
122	39	3	
122	40	4	
122	41	2	
122	42	4	
122	43	1	
122	44	1	
122	45	1	
122	60	0	Muestra compromiso y conocimientos técnicos con su trabajo y asignaciones, con disposición para el cumplimiento de tareas de las áreas técnicas.
122	61	0	Debe comprometerse al cumplimiento de procesos, gestiones, políticas internas y brindar mayor apoyo o espíritu de colaboración con otros departamentos para fortalecer el trabajo en equipo.
123	28	3	
123	29	2	
123	30	1	
123	31	3	
123	32	2	
123	33	1	
123	34	3	
123	35	2	
123	36	1	
123	37	3	
123	60	0	
123	61	0	
124	28	5	
124	29	5	
124	30	5	
124	31	5	
124	32	5	
124	33	5	
124	34	5	
124	35	5	
124	36	5	
124	37	5	
124	60	0	
124	61	0	
125	28	5	
125	29	4	
125	30	5	
125	31	4	
125	32	5	
125	33	4	
125	34	5	
125	35	4	
125	36	5	
125	37	5	
125	60	0	
125	61	0	
126	28	4	
126	29	4	
126	30	4	
126	31	3	
126	32	4	
126	33	4	
126	34	4	
126	35	3	
126	36	4	
126	37	4	
126	60	0	
126	61	0	
127	28	5	
127	29	5	
127	30	5	
127	31	5	
127	32	5	
127	33	5	
127	34	5	
127	35	5	
127	36	4	
127	37	5	
127	60	0	
127	61	0	
128	28	5	
128	29	4	
128	30	5	
128	31	5	
128	32	5	
128	33	5	
128	34	5	
128	35	4	
128	36	5	
128	37	5	
128	60	0	Ayuda al equipo en chambas pesadas
128	61	0	La comunicación
129	28	5	
129	29	5	
129	30	5	
129	31	5	
129	32	5	
129	33	5	
129	34	5	
129	35	5	
129	36	5	
129	37	5	
129	60	0	
129	61	0	
130	28	5	
130	29	5	
130	30	5	
130	31	5	
130	32	5	
130	33	5	
130	34	5	
130	35	5	
130	36	5	
130	37	5	
130	60	0	
130	61	0	
131	28	5	
131	29	5	
131	30	5	
131	31	5	
131	32	5	
131	33	5	
131	34	5	
131	35	5	
131	36	5	
131	37	5	
131	60	0	
131	61	0	
132	28	4	
132	29	5	
132	30	4	
132	31	5	
132	32	4	
132	33	5	
132	34	4	
132	35	5	
132	36	4	
132	37	5	
132	60	0	
132	61	0	
133	28	5	
133	29	5	
133	30	5	
133	31	5	
133	32	5	
133	33	5	
133	34	5	
133	35	5	
133	36	5	
133	37	5	
133	60	0	
133	61	0	
134	19	5	
134	20	4	
134	21	5	
134	22	5	
134	23	5	
134	24	5	
134	25	5	
134	59	5	
134	60	0	Comunicación, Disponibilidad y compromiso
134	61	0	ninguno
135	28	5	
135	29	5	
135	30	3	
135	31	4	
135	32	5	
135	33	4	
135	34	4	
135	35	4	
135	36	5	
135	37	5	
135	60	0	Su imparcialidad su experiencia pl
135	61	0	Planificación
136	19	4	
136	20	5	
136	21	5	
136	22	5	
136	23	5	
136	24	4	
136	25	4	
136	59	4	
136	60	0	ES UNA PERSONA CON AMPLIO CONOCIMIENTO EN CAMPO Y APOYA COMPARTIENDOLO CON EL EQUIPO
136	61	0	MEJORA DE COMUNICACIÓN AL MOMENTO DE RETRASOS O PROBLEMAS EN LAS ACTIVIDADES Y DEBE MEJORAR LA PARTE ADMINISTRATIVA ANTES Y DESPUES DE LOS TRABAJOS
137	11	3	
137	12	4	
137	13	3	
137	14	3	
137	15	3	
137	16	4	
137	17	4	
137	18	3	
137	60	0	Conoces su trabajo y transmite confianza a su equipo
137	61	0	La planificación
138	19	5	
138	20	5	
138	21	5	
138	22	5	
138	23	3	
138	24	5	
138	25	3	
138	59	5	
138	60	0	Compromiso
138	61	0	Contratar sus emociones ante problemas. Ya que aveces generas situaciones de estrés
139	38	3	
139	39	4	
139	40	4	
139	41	3	
139	42	4	
139	43	3	
139	44	3	
139	45	3	
139	60	0	Brinda a los miembros de su equipo toda su atención
139	61	0	mejorar la capacitad de comunicación en las otras áreas
140	19	5	
140	20	5	
140	21	5	
140	22	5	
140	23	5	
140	24	5	
140	25	5	
140	59	5	
140	60	0	Compromiso y comunicación
140	61	0	Ninguno
141	28	4	
141	29	3	
141	30	4	
141	31	5	
141	32	5	
141	33	4	
141	34	2	
141	35	4	
141	36	2	
141	37	4	
141	60	0	Empatía, uniforme respecto al trato
141	61	0	Planificación realista
142	28	4	
142	29	3	
142	30	4	
142	31	5	
142	32	5	
142	33	4	
142	34	2	
142	35	4	
142	36	2	
142	37	4	
142	60	0	Empatía, uniforme respecto al trato
142	61	0	Planificación realista
143	47	4	
143	48	4	
143	49	4	
143	51	5	
143	53	4	
143	54	5	
143	55	5	
143	56	5	
143	57	5	
143	58	5	
143	60	0	Responsabilidad y compromiso
143	61	0	Comunicación
144	19	5	
144	20	5	
144	21	5	
144	22	4	
144	23	2	
144	24	4	
144	25	3	
144	59	4	
144	60	0	Presenta un alto compromiso en los trabajos de la unidad y toma riendas en la planificación y apoyo a todos los compañeros.
144	61	0	La comunicacion efectiva y el control al momento de confrontar un problema.
145	28	5	
145	29	5	
145	30	5	
145	31	4	
145	32	5	
145	33	5	
145	34	3	
145	35	4	
145	36	4	
145	37	5	
145	60	0	
145	61	0	
146	19	5	
146	20	5	
146	21	5	
146	22	5	
146	23	5	
146	24	5	
146	25	5	
146	59	5	
146	60	0	Compromiso y responsabilidad
146	61	0	Ninguno
147	28	4	
147	29	3	
147	30	3	
147	31	4	
147	32	5	
147	33	4	
147	34	3	
147	35	4	
147	36	5	
147	37	4	
147	60	0	El ser paciente
147	61	0	Equidad, tener más firmeza en su carácter
148	38	4	
148	39	4	
148	40	4	
148	41	3	
148	42	4	
148	43	3	
148	44	3	
148	45	3	
148	60	0	brinda a sus miembros de su equipo toda su atención
148	61	0	fortalecer el liderazgo para desarrollarlo en su lugar de trabajo
149	19	3	
149	20	4	
149	21	4	
149	22	3	
149	23	3	
149	24	4	
149	25	3	
149	59	3	
149	60	0	esta persona demuestra una sólida capacidad para tomar decisiones basadas en conocimiento técnico y análisis objetivo.
149	61	0	Podría mejorar su habilidad de escucha activa, dedicando más tiempo a comprender las ideas y preocupaciones de los miembros del equipo antes de tomar decisiones
150	28	3	
150	29	3	
150	30	3	
150	31	3	
150	32	3	
150	33	3	
150	34	2	
150	35	3	
150	36	4	
150	37	3	
150	60	0	
150	61	0	Empatía, equidad
151	28	3	
151	29	3	
151	30	3	
151	31	3	
151	32	3	
151	33	3	
151	34	2	
151	35	3	
151	36	4	
151	37	3	
151	60	0	
151	61	0	Empatía, equidad
152	19	3	
152	20	3	
152	21	4	
152	22	3	
152	23	3	
152	24	3	
152	25	4	
152	59	3	
152	60	0	Demuestra un alto valor de compromiso para finalizar los trabajos.
152	61	0	Podría mostrar mayor proactividad y sentido de urgencia ante los retos o imprevistos del trabajo. Ya que en ocasiones, su calma puede interpretarse como falta de interés.
153	38	4	
153	39	4	
153	40	4	
153	41	3	
153	42	4	
153	43	3	
153	44	3	
153	45	3	
153	60	0	brinda a los miembros de su equipo toda su atención
153	61	0	creatividad y comunicación efectiva
154	38	4	
154	39	4	
154	40	4	
154	41	4	
154	42	5	
154	43	4	
154	44	4	
154	45	4	
154	60	0	conocimiento
154	61	0	Comunicación y empatía, organización
155	38	4	
155	39	4	
155	40	4	
155	41	4	
155	42	4	
155	43	3	
155	44	4	
155	45	3	
155	60	0	trabajo en equipo
155	61	0	Gestión con su equipo y mejora organización
156	38	4	
156	39	4	
156	40	3	
156	41	3	
156	42	4	
156	43	3	
156	44	3	
156	45	3	
156	60	0	toma de decisiones, responsabilidad
156	61	0	comunicación Planificación y organización\nGestión del tiempo
157	11	4	
157	12	3	
157	13	3	
157	14	3	
157	15	3	
157	16	4	
157	17	3	
157	18	3	
157	60	0	Conocimiento teórico de normas técnicas y manejo de software y herramientas digitales
157	61	0	Enfoque práctico y relaciones con sus compañeros
158	11	3	
158	12	4	
158	13	4	
158	14	3	
158	15	3	
158	16	3	
158	17	3	
158	18	3	
158	60	0	Buena disposición
158	61	0	Seguridad y confianza con su equipo
159	38	4	
159	39	4	
159	40	4	
159	41	3	
159	42	4	
159	43	3	
159	44	3	
159	45	3	
159	60	0	Resolución de problema, responsable, aplicación de conocimientos
159	61	0	liderazgo, organización, delegación, gestión de equipo
160	11	2	
160	12	3	
160	13	3	
160	14	2	
160	15	2	
160	16	3	
160	17	3	
160	18	2	
160	60	0	Su disposición
160	61	0	Seguridad  en si mismo
161	38	2	
161	39	3	
161	40	2	
161	41	3	
161	42	4	
161	43	1	
161	44	2	
161	45	4	
161	60	0	conocimiento
161	61	0	debe mejorar su trato a los demás, coordinación, organización y planificación
162	11	3	
162	12	3	
162	13	3	
162	14	2	
162	15	3	
162	16	3	
162	17	3	
162	18	3	
162	60	0	Su Experiencia
162	61	0	Enfocar sus habilidades natas de líder para beneficio de su equipo y para una ejecución eficiente de su trabajo
163	19	3	
163	20	4	
163	21	4	
163	22	3	
163	23	3	
163	24	4	
163	25	3	
163	59	3	
163	60	0	Toma acciones y demuestra mando ante un equipo de técnicos asignados
163	61	0	Hay momentos que toma una actitud negativa en los trabajos y esto hace que se contamine el resto del grupo.
\.


--
-- TOC entry 3597 (class 0 OID 0)
-- Dependencies: 228
-- Name: ciclos_evaluacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: evaluaciones_user
--

SELECT pg_catalog.setval('public.ciclos_evaluacion_id_seq', 4, true);


--
-- TOC entry 3598 (class 0 OID 0)
-- Dependencies: 219
-- Name: competencias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: evaluaciones_user
--

SELECT pg_catalog.setval('public.competencias_id_seq', 61, true);


--
-- TOC entry 3599 (class 0 OID 0)
-- Dependencies: 233
-- Name: dimensions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: evaluaciones_user
--

SELECT pg_catalog.setval('public.dimensions_id_seq', 3, true);


--
-- TOC entry 3600 (class 0 OID 0)
-- Dependencies: 222
-- Name: evaluaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: evaluaciones_user
--

SELECT pg_catalog.setval('public.evaluaciones_id_seq', 163, true);


--
-- TOC entry 3601 (class 0 OID 0)
-- Dependencies: 217
-- Name: evaluadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: evaluaciones_user
--

SELECT pg_catalog.setval('public.evaluadores_id_seq', 164, true);


--
-- TOC entry 3602 (class 0 OID 0)
-- Dependencies: 215
-- Name: evaluados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: evaluaciones_user
--

SELECT pg_catalog.setval('public.evaluados_id_seq', 7, true);


--
-- TOC entry 3603 (class 0 OID 0)
-- Dependencies: 235
-- Name: groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: evaluaciones_user
--

SELECT pg_catalog.setval('public.groups_id_seq', 9, true);


--
-- TOC entry 3383 (class 2606 OID 24774)
-- Name: ciclos_competencias ciclos_competencias_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.ciclos_competencias
    ADD CONSTRAINT ciclos_competencias_pkey PRIMARY KEY (ciclo_id, competencia_id);


--
-- TOC entry 3377 (class 2606 OID 24763)
-- Name: ciclos_evaluacion ciclos_evaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.ciclos_evaluacion
    ADD CONSTRAINT ciclos_evaluacion_pkey PRIMARY KEY (id);


--
-- TOC entry 3365 (class 2606 OID 24632)
-- Name: competencias_aplica_cargo competencias_aplica_cargo_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.competencias_aplica_cargo
    ADD CONSTRAINT competencias_aplica_cargo_pkey PRIMARY KEY (competencia_id, cargo);


--
-- TOC entry 3360 (class 2606 OID 24625)
-- Name: competencias competencias_clave_key; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_clave_key UNIQUE (clave);


--
-- TOC entry 3362 (class 2606 OID 24623)
-- Name: competencias competencias_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_pkey PRIMARY KEY (id);


--
-- TOC entry 3375 (class 2606 OID 24682)
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- TOC entry 3387 (class 2606 OID 24848)
-- Name: dimensions dimensions_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.dimensions
    ADD CONSTRAINT dimensions_pkey PRIMARY KEY (id);


--
-- TOC entry 3368 (class 2606 OID 24648)
-- Name: evaluaciones evaluaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 3355 (class 2606 OID 24601)
-- Name: evaluadores evaluadores_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluadores
    ADD CONSTRAINT evaluadores_pkey PRIMARY KEY (id);


--
-- TOC entry 3352 (class 2606 OID 24590)
-- Name: evaluados evaluados_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluados
    ADD CONSTRAINT evaluados_pkey PRIMARY KEY (id);


--
-- TOC entry 3391 (class 2606 OID 24866)
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3373 (class 2606 OID 24665)
-- Name: respuestas respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_pkey PRIMARY KEY (evaluacion_id, competencia_id);


--
-- TOC entry 3381 (class 2606 OID 24765)
-- Name: ciclos_evaluacion unique_nombre_ciclo; Type: CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.ciclos_evaluacion
    ADD CONSTRAINT unique_nombre_ciclo UNIQUE (nombre);


--
-- TOC entry 3353 (class 1259 OID 24824)
-- Name: fki_evaluados_Ciclo_Id_FK; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX "fki_evaluados_Ciclo_Id_FK" ON public.evaluados USING btree (ciclo_id);


--
-- TOC entry 3384 (class 1259 OID 24785)
-- Name: idx_ciclos_competencias_ciclo; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_ciclos_competencias_ciclo ON public.ciclos_competencias USING btree (ciclo_id);


--
-- TOC entry 3385 (class 1259 OID 24786)
-- Name: idx_ciclos_competencias_competencia; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_ciclos_competencias_competencia ON public.ciclos_competencias USING btree (competencia_id);


--
-- TOC entry 3378 (class 1259 OID 24766)
-- Name: idx_ciclos_estado; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_ciclos_estado ON public.ciclos_evaluacion USING btree (estado);


--
-- TOC entry 3379 (class 1259 OID 24767)
-- Name: idx_ciclos_fecha_creacion; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_ciclos_fecha_creacion ON public.ciclos_evaluacion USING btree (fecha_creacion DESC);


--
-- TOC entry 3366 (class 1259 OID 24638)
-- Name: idx_competencias_aplica_cargo_cargo; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_competencias_aplica_cargo_cargo ON public.competencias_aplica_cargo USING btree (cargo);


--
-- TOC entry 3363 (class 1259 OID 24812)
-- Name: idx_competencias_dimension; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_competencias_dimension ON public.competencias USING btree (dimension_general);


--
-- TOC entry 3369 (class 1259 OID 24798)
-- Name: idx_evaluaciones_ciclo; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_evaluaciones_ciclo ON public.evaluaciones USING btree (ciclo_id);


--
-- TOC entry 3370 (class 1259 OID 24660)
-- Name: idx_evaluaciones_evaluado_id; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_evaluaciones_evaluado_id ON public.evaluaciones USING btree (evaluado_id);


--
-- TOC entry 3371 (class 1259 OID 24659)
-- Name: idx_evaluaciones_evaluador_id; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_evaluaciones_evaluador_id ON public.evaluaciones USING btree (evaluador_id);


--
-- TOC entry 3356 (class 1259 OID 24797)
-- Name: idx_evaluadores_ciclo; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_evaluadores_ciclo ON public.evaluadores USING btree (ciclo_id);


--
-- TOC entry 3357 (class 1259 OID 24799)
-- Name: idx_evaluadores_ciclo_estado; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_evaluadores_ciclo_estado ON public.evaluadores USING btree (ciclo_id, estado);


--
-- TOC entry 3358 (class 1259 OID 24607)
-- Name: idx_evaluadores_evaluado_id; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX idx_evaluadores_evaluado_id ON public.evaluadores USING btree (evaluado_id);


--
-- TOC entry 3388 (class 1259 OID 24878)
-- Name: ix_dimensions_ciclo; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX ix_dimensions_ciclo ON public.dimensions USING btree (ciclo_id);


--
-- TOC entry 3392 (class 1259 OID 24879)
-- Name: ix_groups_ciclo; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX ix_groups_ciclo ON public.groups USING btree (ciclo_id);


--
-- TOC entry 3393 (class 1259 OID 24880)
-- Name: ix_groups_dimension; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE INDEX ix_groups_dimension ON public.groups USING btree (dimension_id);


--
-- TOC entry 3389 (class 1259 OID 24854)
-- Name: ux_dimensions_ciclo_nombre; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE UNIQUE INDEX ux_dimensions_ciclo_nombre ON public.dimensions USING btree (ciclo_id, nombre);


--
-- TOC entry 3394 (class 1259 OID 24877)
-- Name: ux_groups_dimension_nombre; Type: INDEX; Schema: public; Owner: evaluaciones_user
--

CREATE UNIQUE INDEX ux_groups_dimension_nombre ON public.groups USING btree (dimension_id, nombre);


--
-- TOC entry 3557 (class 2618 OID 24803)
-- Name: vista_stats_por_ciclo _RETURN; Type: RULE; Schema: public; Owner: evaluaciones_user
--

CREATE OR REPLACE VIEW public.vista_stats_por_ciclo AS
 SELECT c.id AS ciclo_id,
    c.nombre AS ciclo_nombre,
    c.estado AS ciclo_estado,
    count(DISTINCT ev.id) AS total_evaluadores,
    count(DISTINCT ev.evaluado_id) AS total_evaluados,
    count(DISTINCT e.id) AS total_evaluaciones,
    count(DISTINCT
        CASE
            WHEN (ev.estado = 'Pendiente'::text) THEN ev.id
            ELSE NULL::bigint
        END) AS evaluadores_pendientes,
    count(DISTINCT
        CASE
            WHEN (ev.estado = 'Completada'::text) THEN ev.id
            ELSE NULL::bigint
        END) AS evaluadores_completados,
    count(DISTINCT cc.competencia_id) FILTER (WHERE (cc.activa = true)) AS competencias_activas
   FROM (((public.ciclos_evaluacion c
     LEFT JOIN public.evaluadores ev ON ((ev.ciclo_id = c.id)))
     LEFT JOIN public.evaluaciones e ON ((e.ciclo_id = c.id)))
     LEFT JOIN public.ciclos_competencias cc ON ((cc.ciclo_id = c.id)))
  GROUP BY c.id, c.nombre, c.estado
  ORDER BY c.fecha_creacion DESC;


--
-- TOC entry 3411 (class 2620 OID 24882)
-- Name: ciclos_competencias trg_ciclos_competencias_validar_dim_grupo; Type: TRIGGER; Schema: public; Owner: evaluaciones_user
--

CREATE TRIGGER trg_ciclos_competencias_validar_dim_grupo BEFORE INSERT OR UPDATE OF ciclo_id, competencia_id ON public.ciclos_competencias FOR EACH ROW EXECUTE FUNCTION public.fn_ciclos_competencias_validar_dim_grupo();


--
-- TOC entry 3409 (class 2620 OID 24808)
-- Name: ciclos_evaluacion trigger_actualizar_ciclo; Type: TRIGGER; Schema: public; Owner: evaluaciones_user
--

CREATE TRIGGER trigger_actualizar_ciclo BEFORE UPDATE ON public.ciclos_evaluacion FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();


--
-- TOC entry 3410 (class 2620 OID 24810)
-- Name: ciclos_evaluacion trigger_validar_eliminacion_ciclo; Type: TRIGGER; Schema: public; Owner: evaluaciones_user
--

CREATE TRIGGER trigger_validar_eliminacion_ciclo BEFORE DELETE ON public.ciclos_evaluacion FOR EACH ROW EXECUTE FUNCTION public.validar_eliminacion_ciclo();


--
-- TOC entry 3404 (class 2606 OID 24775)
-- Name: ciclos_competencias ciclos_competencias_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.ciclos_competencias
    ADD CONSTRAINT ciclos_competencias_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_evaluacion(id) ON DELETE CASCADE;


--
-- TOC entry 3405 (class 2606 OID 24780)
-- Name: ciclos_competencias ciclos_competencias_competencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.ciclos_competencias
    ADD CONSTRAINT ciclos_competencias_competencia_id_fkey FOREIGN KEY (competencia_id) REFERENCES public.competencias(id) ON DELETE CASCADE;


--
-- TOC entry 3398 (class 2606 OID 24633)
-- Name: competencias_aplica_cargo competencias_aplica_cargo_competencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.competencias_aplica_cargo
    ADD CONSTRAINT competencias_aplica_cargo_competencia_id_fkey FOREIGN KEY (competencia_id) REFERENCES public.competencias(id) ON DELETE CASCADE;


--
-- TOC entry 3406 (class 2606 OID 24849)
-- Name: dimensions dimensions_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.dimensions
    ADD CONSTRAINT dimensions_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_evaluacion(id) ON DELETE CASCADE;


--
-- TOC entry 3399 (class 2606 OID 24654)
-- Name: evaluaciones evaluaciones_evaluado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_evaluado_id_fkey FOREIGN KEY (evaluado_id) REFERENCES public.evaluados(id);


--
-- TOC entry 3400 (class 2606 OID 24649)
-- Name: evaluaciones evaluaciones_evaluador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_evaluador_id_fkey FOREIGN KEY (evaluador_id) REFERENCES public.evaluadores(id);


--
-- TOC entry 3396 (class 2606 OID 24602)
-- Name: evaluadores evaluadores_evaluado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluadores
    ADD CONSTRAINT evaluadores_evaluado_id_fkey FOREIGN KEY (evaluado_id) REFERENCES public.evaluados(id);


--
-- TOC entry 3395 (class 2606 OID 24819)
-- Name: evaluados evaluados_Ciclo_Id_FK; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluados
    ADD CONSTRAINT "evaluados_Ciclo_Id_FK" FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_evaluacion(id) NOT VALID;


--
-- TOC entry 3401 (class 2606 OID 24792)
-- Name: evaluaciones fk_evaluaciones_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluaciones_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_evaluacion(id) ON DELETE RESTRICT;


--
-- TOC entry 3397 (class 2606 OID 24787)
-- Name: evaluadores fk_evaluadores_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.evaluadores
    ADD CONSTRAINT fk_evaluadores_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_evaluacion(id) ON DELETE RESTRICT;


--
-- TOC entry 3407 (class 2606 OID 24867)
-- Name: groups groups_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_evaluacion(id) ON DELETE CASCADE;


--
-- TOC entry 3408 (class 2606 OID 24872)
-- Name: groups groups_dimension_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_dimension_id_fkey FOREIGN KEY (dimension_id) REFERENCES public.dimensions(id) ON DELETE CASCADE;


--
-- TOC entry 3402 (class 2606 OID 24671)
-- Name: respuestas respuestas_competencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_competencia_id_fkey FOREIGN KEY (competencia_id) REFERENCES public.competencias(id);


--
-- TOC entry 3403 (class 2606 OID 24666)
-- Name: respuestas respuestas_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: evaluaciones_user
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones(id) ON DELETE CASCADE;


--
-- TOC entry 3583 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO evaluaciones_user;


-- Completed on 2025-11-24 17:18:37

--
-- PostgreSQL database dump complete
--

\unrestrict qme3FQuVXlnzuQavUGA7R9U1IoTCMTqLOJUJEqFDpcBvCqKCQWJCLyQwzhlpzgw

