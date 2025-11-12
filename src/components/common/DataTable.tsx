// src/components/common/DataTable.tsx
import { useMemo, useState } from 'react';

type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  getSortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  getSearchText?: (row: T) => string;
  initialPageSize?: number;
  searchable?: boolean; // <- NUEVA PROP
}

export function DataTable<T>({
  rows,
  columns,
  searchPlaceholder = "Buscar...",
  getSearchText,
  initialPageSize = 10,
  searchable = true, // <- por defecto visible
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [sortIndex, setSortIndex] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Filtro por texto (solo si searchable y hay getSearchText)
  const filtered = useMemo(() => {
    if (!searchable || !getSearchText) return rows;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => (getSearchText(row) || "").toLowerCase().includes(q));
  }, [rows, searchable, getSearchText, search]);

  // Orden
  let sorted = filtered;
  if (sortIndex !== null) {
    const col = columns[sortIndex];
    if (col.getSortValue) {
      sorted = [...filtered].sort((a, b) => {
        const va = col.getSortValue!(a);
        const vb = col.getSortValue!(b);
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
  }

  // Paginación
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = sorted.slice(start, end);

  function handleHeaderClick(index: number) {
    const col = columns[index];
    if (!col.getSortValue) return;
    if (sortIndex === index) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortIndex(index);
      setSortDir("asc");
      setPage(1); // vuelve a la primera página al cambiar orden
    }
  }

  function handlePageChange(next: number) {
    if (next < 1 || next > totalPages) return;
    setPage(next);
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setPage(1);
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
        gap: "8px",
        flexWrap: "wrap"
      }}>
        {/* Input de búsqueda solo si searchable y hay getSearchText */}
        {searchable && getSearchText && (
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              flex: "1",
              minWidth: "200px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              background: "#ffffff",
              color: "#111827"
            }}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>Filas por página</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            style={{
              padding: "4px 8px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "13px"
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                onClick={() => handleHeaderClick(idx)}
                style={col.getSortValue ? { cursor: "pointer" } : {}}
              >
                {col.header}
                {sortIndex === idx && (
                  <span style={{ marginLeft: "4px", fontSize: "10px" }}>
                    {sortDir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center" }}>
                Sin registros
              </td>
            </tr>
          ) : (
            pageRows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col, cIdx) => (
                  <td key={cIdx}>{col.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "8px",
        fontSize: "13px",
        color: "#6b7280",
        flexWrap: "wrap",
        gap: "8px"
      }}>
        <div>
          Mostrando {total === 0 ? 0 : start + 1}–{Math.min(end, total)} de {total}
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "none",
              background: currentPage === 1 ? "#e5e7eb" : "#4b5563",
              color: currentPage === 1 ? "#9ca3af" : "#ffffff",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontSize: "13px"
            }}
          >
            « Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "none",
              background: currentPage === totalPages ? "#e5e7eb" : "#4b5563",
              color: currentPage === totalPages ? "#9ca3af" : "#ffffff",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              fontSize: "13px"
            }}
          >
            Siguiente »
          </button>
        </div>
      </div>
    </div>
  );
}
