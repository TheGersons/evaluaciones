// src/components/dashboard/FormEvaluador.tsx
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { NuevoEvaluador, Evaluado, BulkEvaluadorInput } from '../../types';
import { CARGOS } from '../../types';

interface FormEvaluadorProps {
  evaluados: Evaluado[];
  cicloId: string;
  onSubmit: (data: Omit<NuevoEvaluador, 'cicloId'> & { cicloId: number }) => Promise<void>;
  onImportBatch: (items: BulkEvaluadorInput[]) => Promise<void>;
}

export function FormEvaluador({ evaluados, cicloId, onSubmit, onImportBatch }: FormEvaluadorProps) {
  const [datos, setDatos] = useState({
    nombre: '',
    email: '',
    cargo: '',
    evaluadoId: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!datos.nombre.trim() || !datos.email.trim()) {
      alert('Nombre y correo son obligatorios');
      return;
    }
    if (!datos.cargo.trim()) {
      alert('Selecciona un cargo');
      return;
    }
    if (!datos.evaluadoId) {
      alert('Selecciona a quién evaluará esta persona');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        nombre: datos.nombre.trim(),
        email: datos.email.trim(),
        cargo: datos.cargo,
        evaluadoId: datos.evaluadoId,
        cicloId: Number(cicloId)
      });

      setDatos({ nombre: '', email: '', cargo: '', evaluadoId: '' });
    } catch (e: any) {
      console.error(e);
      alert('Error agregando evaluador');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClickImportarArchivo() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleArchivoImportado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportando(true);

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true
      }) as any[][];

      const parsed: BulkEvaluadorInput[] = [];

      for (const row of rows) {
        if (!row || row.length === 0) continue;

        const nombre = String(row[0] ?? '').trim();
        const email = String(row[1] ?? '').trim();
        const evaluadoNombre = String(row[2] ?? '').trim();
        const cargo = String(row[3] ?? '').trim();

        if (!nombre && !email && !evaluadoNombre && !cargo) continue;

        if (!nombre || !email || !evaluadoNombre || !cargo) {
          throw new Error(
            `Fila inválida: nombre, email, evaluado y cargo son obligatorios.\n` +
            `Revisa que el archivo no tenga encabezados o filas incompletas.`
          );
        }

        parsed.push({
          nombre,
          email,
          evaluado_nombre: evaluadoNombre,
          cargo
        });
      }

      if (parsed.length === 0) {
        alert('El archivo no contiene filas válidas.');
        return;
      }

      await onImportBatch(parsed);
      alert(`✅ Se importaron ${parsed.length} evaluadores correctamente.`);
    } catch (err: any) {
      console.error(err);
      alert(
        `Error importando evaluadores:\n` +
        (err?.message || 'Revisa el archivo y los nombres de evaluados.')
      );
    } finally {
      setImportando(false);
    }
  }

  return (
    <div>
      {/* Botón de importación */}
      <div style={{ marginBottom: '12px' }}>
        <button
          type="button"
          onClick={handleClickImportarArchivo}
          disabled={importando}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: '#10b981',
            color: 'white',
            fontWeight: 600,
            cursor: importando ? 'not-allowed' : 'pointer'
          }}
        >
          {importando ? 'Importando...' : '📂 Importar Excel / CSV'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleArchivoImportado}
        />
      </div>

      {/* Formulario manual */}
      <form className="form-row" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre del evaluador"
          value={datos.nombre}
          onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
          disabled={submitting}
        />
        <input
          type="email"
          placeholder="Correo electrónico"
          value={datos.email}
          onChange={(e) => setDatos({ ...datos, email: e.target.value })}
          disabled={submitting}
        />
        <select
          className="select-cargo"
          value={datos.evaluadoId}
          onChange={(e) => setDatos({ ...datos, evaluadoId: e.target.value })}
          disabled={submitting}
        >
          <option value="">Selecciona a quién evaluará</option>
          {evaluados.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.nombre} — {ev.puesto} ({ev.area})
            </option>
          ))}
        </select>
        <select
          className="select-cargo"
          value={datos.cargo}
          onChange={(e) => setDatos({ ...datos, cargo: e.target.value })}
          disabled={submitting}
        >
          <option value="">Cargo respecto al evaluado</option>
          {CARGOS.map((cargo) => (
            <option key={cargo} value={cargo}>
              {cargo}
            </option>
          ))}
        </select>
        <button type="submit" disabled={submitting}>
          {submitting ? '⏳ Agregando...' : '➕ Agregar evaluador'}
        </button>
      </form>
    </div>
  );
}