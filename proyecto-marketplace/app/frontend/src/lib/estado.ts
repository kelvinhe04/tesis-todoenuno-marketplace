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

export function formatHora12h(hora: string): string {
  const [h, m] = hora.split(':').map(Number)
  const periodo = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${periodo}`
}
