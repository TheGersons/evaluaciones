// src/components/dashboard/FormCompetencia.tsx
import { useState } from 'react';
import type { NuevaCompetencia } from '../../types';
import { CARGOS } from '../../types';

interface FormCompetenciaProps {
    onSubmit: (data: NuevaCompetencia) => Promise<void>;
    totalCompetencias: number;
}
const grupos = [
    'Gestión del Desempeño',
    'Ser Modelo',
    'Perseverancia y Resiliencia',
    'Apoyo',
    'Conducta Ética',
    'Respeto',
    'Pensamiento Positivo',
    'Gestión Emocional',
    'Autoconocimiento',
];
const getGruposFiltrados = (dimensionGeneral: string) => {
    switch (dimensionGeneral) {
        case 'fiabilidad':
            // Las primeras 3 (índices 0, 1, 2)
            return grupos.slice(0, 3);
        case 'armonnia': // Cuidado: si el valor en el option es 'armonnia', debe coincidir aquí.
            // Las siguientes 3 (índices 3, 4, 5)
            return grupos.slice(3, 6);
        case 'interes':
            // Las últimas 3 (índices 6, 7, 8)
            return grupos.slice(6, 9);
        default:
            return [];
    }
};

export function FormCompetencia({ onSubmit, /*totalCompetencias */ }: FormCompetenciaProps) {
    const [datos, setDatos] = useState<NuevaCompetencia>({
        clave: '',
        titulo: '',
        descripcion: '',
        aplicaA: [],
        tipo: 'likert',
        dimensionGeneral: '',
        grupo: ''
    });

    const [openCargos, setOpenCargos] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    function toggleCargoAplica(cargo: string) {
        setDatos((prev) => {
            const seleccionados = prev.aplicaA || [];
            if (seleccionados.includes(cargo)) {
                return {
                    ...prev,
                    aplicaA: seleccionados.filter((c) => c !== cargo)
                };
            } else {
                return {
                    ...prev,
                    aplicaA: [...seleccionados, cargo]
                };
            }
        });
    }
    const gruposParaSelect = getGruposFiltrados(datos.dimensionGeneral);
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!datos.clave.trim() || !datos.titulo.trim()) {
            alert('La clave y el título son obligatorios');
            return;
        }

        try {
            setSubmitting(true);
            await onSubmit({
                clave: datos.clave.trim(),
                titulo: datos.titulo.trim(),
                descripcion: datos.descripcion.trim(),
                aplicaA: datos.aplicaA,
                tipo: datos.tipo,
                dimensionGeneral: datos.dimensionGeneral,
                grupo: datos.grupo
            });

            setDatos({ clave: '', titulo: '', descripcion: '', aplicaA: [], tipo: 'likert', dimensionGeneral: '', grupo: '' });
            setOpenCargos(false);
        } catch (e: any) {
            console.error(e);
            alert('Error agregando competencia: ' + e.message);
        } finally {
            setSubmitting(false);
        }

    }



    return (
        <form className="form-row" onSubmit={handleSubmit}>
            <input
                type="text"
                placeholder="Clave interna (ej: Comunicación_pregunta1)"
                value={datos.clave}
                onChange={(e) => setDatos({ ...datos, clave: e.target.value })}
                disabled={submitting}
            />
            <input
                type="text"
                placeholder="Título o tema (ej: Comunicación / Responsabilidad / Compromiso)"
                value={datos.titulo}
                onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
                disabled={submitting}
            />
            <input
                type="text"
                placeholder="Aquí se escribe la pregunta a realizar"
                value={datos.descripcion}
                onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
                disabled={submitting}
            />

            <select
                className="select-cargo"
                value={datos.tipo}
                onChange={(e) => setDatos({ ...datos, tipo: e.target.value })}
                disabled={submitting}
            >
                <option value="likert">Escala 1 a 5</option>
                <option value="texto">Pregunta abierta</option>
            </select>
            <select
                className="select-cargo"
                value={datos.dimensionGeneral}
                onChange={(e) => setDatos({
                    ...datos,
                    dimensionGeneral: e.target.value,
                    // OPCIONAL: Resetear el grupo si se cambia la dimensión
                    grupo: ''
                })}
                disabled={submitting}
            >
                {/* Opción por defecto (se recomienda agregar una) */}
                <option value="" disabled>Selecciona una dimensión</option>
                <option value="fiabilidad">Fiabilidad</option>
                <option value="armonnia">Armonía</option>
                <option value="interes">Interés</option>
            </select>

            {/* SEGUNDO SELECTOR: GRUPOS FILTRADOS */}
            <select
                className="select-cargo"
                value={datos.grupo}
                onChange={(e) => setDatos({ ...datos, grupo: e.target.value })}
                disabled={submitting || gruposParaSelect.length === 0} // Deshabilita si no hay grupos
            >
                <option value="" disabled>Selecciona un grupo</option>
                {/* Mapeamos los grupos filtrados */}
                {gruposParaSelect.map((grupo) => (
                    <option key={grupo} value={grupo}>
                        {grupo}
                    </option>
                ))}
            </select>
            <div className="multi-select">
                <div
                    className="multi-select-trigger"
                    onClick={() => !submitting && setOpenCargos((o) => !o)}
                    style={{ cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
                >
                    <span>
                        {datos.aplicaA.length === 0
                            ? 'Aplica a: todos los cargos'
                            : `Aplica a: ${datos.aplicaA.join(', ')}`}
                    </span>
                    <span className="multi-select-arrow">▾</span>
                </div>

                {openCargos && !submitting && (
                    <div className="multi-select-dropdown">
                        {CARGOS.map((cargo) => (
                            <label key={cargo} className="multi-select-option">
                                <input
                                    type="checkbox"
                                    checked={datos.aplicaA.includes(cargo)}
                                    onChange={() => toggleCargoAplica(cargo)}
                                />
                                <span>{cargo}</span>
                            </label>
                        ))}

                        <button
                            type="button"
                            className="multi-select-clear"
                            onClick={() => setDatos((prev) => ({ ...prev, aplicaA: [] }))}
                        >
                            Todos los cargos
                        </button>
                    </div>
                )}
            </div>
            <button type="submit" disabled={submitting}>
                {submitting ? '⏳ Agregando...' : '➕ Agregar pregunta'}
            </button>
        </form>
    );
}