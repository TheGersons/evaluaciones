-- Agregar columna de comentario por respuesta
ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS comentario TEXT;

-- Normalizar valores existentes a cadena vacía
UPDATE respuestas
SET comentario = ''
WHERE comentario IS NULL;

-- Asegurar que no haya NULLs y que el default sea cadena vacía
ALTER TABLE respuestas
  ALTER COLUMN comentario SET DEFAULT '',
  ALTER COLUMN comentario SET NOT NULL;

-- Opcional: normalizar comentarios globales de evaluaciones
-- Solo si quieres forzar también NOT NULL ahí

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'evaluaciones'
      AND column_name = 'comentarios'
  ) THEN
    UPDATE evaluaciones
    SET comentarios = ''
    WHERE comentarios IS NULL;

    ALTER TABLE evaluaciones
      ALTER COLUMN comentarios SET DEFAULT '',
      ALTER COLUMN comentarios SET NOT NULL;
  END IF;
END $$;
