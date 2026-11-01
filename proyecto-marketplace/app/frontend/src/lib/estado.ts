import type { EstadoEntrega, EstadoPago } from './api'

export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  pendiente: 'Pago pendiente',
  pagada: 'Pagada',
  rechazada: 'Pago rechazado',
}

export const ESTADO_PAGO_BADGE: Record<EstadoPago, string> = {
  pendiente: 'badge-warning',
  pagada: 'badge-success',
  rechazada: 'badge-danger',
}

export const ESTADO_ENTREGA_LABEL: Record<EstadoEntrega, string> = {
  pendiente: 'Pendiente',
  en_camino: 'En camino',
  entregada: 'Entregada',
}

export const ESTADO_ENTREGA_BADGE: Record<EstadoEntrega, string> = {
  pendiente: 'badge-warning',
  en_camino: 'badge-neutral',
  entregada: 'badge-success',
}

// '2026-10-31' -> '31/10/2026' (día/mes/año)
export function formatFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

export function formatHora12h(hora: string): string {
  const [h, m] = hora.split(':').map(Number)
  const periodo = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${periodo}`
}

// Date -> 'AAAA-MM-DD' en hora LOCAL (toISOString usaría UTC y desfasaría el día por la noche)
export function aFechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Índice = Date.getDay() (0 = domingo), igual que `diaSemana` en las reglas de disponibilidad
export const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
