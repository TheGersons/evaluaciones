# Evaluación 360

Frontend en React + Vite + TypeScript para gestionar un flujo de evaluación 360°:

- Registro de evaluados (personas a evaluar)
- Registro de evaluadores y envío de enlaces personalizados
- Llenado de evaluaciones por parte de los evaluadores
- Panel de administración (dashboard)
- Panel de resultados agregados con gráficos y exportación a CSV

El backend expuesto es un API tipo PostgREST (PostgreSQL ↔ HTTP).

---

## Tecnologías

- React + TypeScript
- Vite
- Recharts (gráficas)
- Nginx como reverse proxy / servidor estático
- API REST sobre PostgreSQL (PostgREST o similar)

---

## Requisitos

- Node.js **>= 20.19** (Vite 7 no soporta Node 18)
- npm
- API REST disponible con los endpoints esperados (ejemplo típico PostgREST)
- Servidor Linux con Nginx para producción (opcional pero usado en este proyecto)

---

## Variables de entorno

El frontend usa una variable principal:

- `VITE_API_BASE_URL`  
  URL base del API. Si no se define, por defecto usa:

  ```txt
  /eval360/api
