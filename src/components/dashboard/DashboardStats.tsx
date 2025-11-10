// src/components/dashboard/DashboardStats.tsx
import type { DashboardStats } from '../../types';

interface DashboardStatsProps {
  stats: DashboardStats;
  evaluadoresPendientes: number;
  competenciasActivas: number;
}

export function DashboardStatsCards({
  stats,
  evaluadoresPendientes,
  competenciasActivas
}: DashboardStatsProps) {
  const tasaCompletado =
    stats.totalEvaluadores > 0
      ? Math.round((stats.totalEvaluaciones / stats.totalEvaluadores) * 100)
      : 0;

  return (
    <section className="grid">
      <div className="card">
        <h3>Total Evaluadores</h3>
        <p className="big-number">{stats.totalEvaluadores}</p>
      </div>
      <div className="card">
        <h3>Total Evaluados</h3>
        <p className="big-number">{stats.totalEvaluados}</p>
      </div>
      <div className="card">
        <h3>Evaluaciones Completadas</h3>
        <p className="big-number">{stats.totalEvaluaciones}</p>
      </div>
      <div className="card">
        <h3>Evaluadores Pendientes</h3>
        <p className="big-number">{evaluadoresPendientes}</p>
      </div>
      <div className="card">
        <h3>Competencias Activas</h3>
        <p className="big-number">{competenciasActivas}</p>
      </div>
      <div className="card">
        <h3>Tasa de Completado</h3>
        <p className="big-number">{tasaCompletado}%</p>
      </div>
    </section>
  );
}