// src/utils/resultados/exportUtils.ts
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { ResultadoEvaluado } from '../../types/resultados.types';

/**
 * Exporta una sección del DOM como imagen PNG
 */
export async function exportSectionAsPng(containerId: string, fileName: string): Promise<void> {
    const el = document.getElementById(containerId);
    if (!el) {
        console.error(`No se encontró el elemento con id: ${containerId}`);
        return;
    }

    try {
        const canvas = await html2canvas(el, {
            backgroundColor: '#ffffff',
            scale: 2,
            x: 0,
            y: 0,
        });

        // Agregar margen blanco
        const margin = 30;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = canvas.width + margin * 2;
        newCanvas.height = canvas.height + margin * 2;
        const ctx = newCanvas.getContext('2d');

        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
            ctx.drawImage(canvas, margin, margin);
        }

        // Descargar
        const dataUrl = newCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
    } catch (error) {
        console.error('Error al exportar PNG:', error);
    }
}

/**
 * Exporta una sección del DOM como PDF
 */
export async function exportSectionAsPdf(containerId: string, fileName: string): Promise<void> {
    const el = document.getElementById(containerId);
    if (!el) {
        console.error(`No se encontró el elemento con id: ${containerId}`);
        return;
    }

    try {
        const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4'); // Orientación horizontal
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Calcular dimensiones con margen
        const margin = 10;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;

        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;
        const ratio = imgHeightPx / imgWidthPx;

        let renderW = maxW;
        let renderH = renderW * ratio;

        // Ajustar si excede la altura
        if (renderH > maxH) {
            renderH = maxH;
            renderW = renderH / ratio;
        }

        // Centrar en la página
        const x = (pageWidth - renderW) / 2;
        const y = (pageHeight - renderH) / 2;

        pdf.addImage(imgData, 'PNG', x, y, renderW, renderH, undefined, 'FAST');
        pdf.save(fileName);
    } catch (error) {
        console.error('Error al exportar PDF:', error);
    }
}

/**
 * Exporta los resultados como archivo Excel (CSV)
 */
export function exportarExcel(
    resultados: ResultadoEvaluado[],
    competenciasLikert: any[],
    cicloNombre: string
): void {
    try {
        let csv = 'Ranking,Nombre,Puesto,Promedio General,Num Evaluaciones,';
        csv += competenciasLikert.map(c => c.titulo).join(',') + '\n';

        resultados.forEach((r, index) => {
            csv += `${index + 1},${r.evaluado.nombre},${r.evaluado.puesto},`;
            csv += `${r.promedioGeneral.toFixed(2)},${r.numEvaluaciones},`;
            csv += competenciasLikert
                .map(c => (r.promediosPorCompetencia[c.id] || 0).toFixed(2))
                .join(',');
            csv += '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `resultados_evaluacion_${cicloNombre}.csv`;
        link.click();
        
        // Limpiar
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error al exportar Excel:', error);
    }
}

/**
 * Genera un nombre de archivo sanitizado
 */
export function sanitizeFileName(name: string): string {
    return name
        .replace(/\s+/g, '_')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
}