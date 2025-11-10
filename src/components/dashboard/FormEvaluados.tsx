// src/components/dashboard/FormEvaluado.tsx
import { useState } from 'react';
import type { NuevoEvaluado } from '../../types';

interface FormEvaluadoProps {
  onSubmit: (data: NuevoEvaluado) => Promise<void>;
}

export function FormEvaluado({ onSubmit }: FormEvaluadoProps) {
  const [datos, setDatos] = useState<NuevoEvaluado>({
    nombre: '',
    puesto: '',
    area: ''
  });

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!datos.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        nombre: datos.nombre.trim(),
        puesto: datos.puesto.trim(),
        area: datos.area.trim()
      });

      // Limpiar formulario después de éxito
      setDatos({ nombre: '', puesto: '', area: '' });
    } catch (e: any) {
      console.error(e);
      alert('Error agregando evaluado');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-row" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nombre completo"
        value={datos.nombre}
        onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
        disabled={submitting}
      />
      <input
        type="text"
        placeholder="Puesto (ej: Ingeniero Senior)"
        value={datos.puesto}
        onChange={(e) => setDatos({ ...datos, puesto: e.target.value })}
        disabled={submitting}
      />
      <input
        type="text"
        placeholder="Área (ej: Desarrollo)"
        value={datos.area}
        onChange={(e) => setDatos({ ...datos, area: e.target.value })}
        disabled={submitting}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? '⏳ Agregando...' : '➕ Agregar'}
      </button>
    </form>
  );
}