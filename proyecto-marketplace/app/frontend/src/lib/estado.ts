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

// Al comprador no se le muestra la cantidad exacta: solo si hay, si quedan pocos o si se agotó
export const UMBRAL_POCO_STOCK = 5
export function textoStock(stock: number): string {
  if (stock <= 0) return 'Agotado'
  return stock < UMBRAL_POCO_STOCK ? 'Quedan pocos' : 'Disponible'
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

// ---- Fecha y hora de ahora, en la zona del negocio (Panamá) ----
// Igual que en el servidor: así "hoy" y las horas que ya pasaron no dependen de la zona del
// navegador ni de la del contenedor (UTC, 5 horas adelante de Panamá).
export const ZONA_NEGOCIO = 'America/Panama'

export function ahoraPanama(instante: Date = new Date()): { fecha: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante)
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
  }
}

// 'AAAA-MM-DD' + n días -> 'AAAA-MM-DD'
export function sumarDiasFecha(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return aFechaISO(new Date(a, m - 1, d + dias))
}

// Día de la semana (0 = domingo) de una fecha 'AAAA-MM-DD'
export function diaSemanaDeFecha(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).getDay()
}

interface ReglaHorario {
  diaSemana: number
  horaInicio: string
  horaFin: string
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// ¿Hoy queda algún horario por empezar? (hay atención hoy y el último inicio posible es posterior a la hora actual)
export function quedanHorariosHoy(
  reglas: ReglaHorario[],
  duracionMinutos: number,
  ahora: { fecha: string; minutos: number } = ahoraPanama(),
): boolean {
  const dia = diaSemanaDeFecha(ahora.fecha)
  return reglas
    .filter((r) => r.diaSemana === dia)
    .some((r) => {
      const inicio = aMinutos(r.horaInicio)
      const espacio = aMinutos(r.horaFin) - inicio
      if (espacio < duracionMinutos) return false
      const ultimoInicio = inicio + Math.floor((espacio - duracionMinutos) / duracionMinutos) * duracionMinutos
      return ultimoInicio > ahora.minutos
    })
}

// Primera fecha en la que se puede agendar: hoy solo si todavía quedan horarios, si no el siguiente día con atención
export function primeraFechaDisponible(
  reglas: ReglaHorario[],
  duracionMinutos: number,
  ahora: { fecha: string; minutos: number } = ahoraPanama(),
  diasNoDisponibles: string[] = [],
): string {
  const dias = new Set(reglas.map((r) => r.diaSemana))
  for (let i = 0; i < 60; i++) {
    const fecha = sumarDiasFecha(ahora.fecha, i)
    if (!dias.has(diaSemanaDeFecha(fecha)) || diasNoDisponibles.includes(fecha)) continue
    if (i === 0 && !quedanHorariosHoy(reglas, duracionMinutos, ahora)) continue
    return fecha
  }
  return ahora.fecha
}
