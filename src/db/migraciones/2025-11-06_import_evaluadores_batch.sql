CREATE OR REPLACE FUNCTION import_evaluadores_batch(p_items jsonb)
RETURNS jsonb
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
