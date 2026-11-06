import type { EstadoEntrega, EstadoPago, ItemOrden } from './api'

export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  pendiente: 'Pago pendiente',
  pagada: 'Pagada',
  rechazada: 'Pago rechazado',
  por_cobrar: 'Pago en el lugar',
  reembolsada: 'Reembolsada',
  cancelada: 'Cancelada',
}

export const ESTADO_PAGO_BADGE: Record<EstadoPago, string> = {
  pendiente: 'badge-warning',
  pagada: 'badge-success',
  rechazada: 'badge-danger',
  por_cobrar: 'badge-muted',
  reembolsada: 'badge-muted',
  cancelada: 'badge-muted',
}

export const ESTADO_ENTREGA_LABEL: Record<EstadoEntrega, string> = {
  pendiente: 'Pendiente',
  en_camino: 'En camino',
  entregada: 'Entregada',
  no_asistio: 'No asistió',
  cancelada: 'Cancelada',
}

// Una cita no se "entrega" ni va "en camino": se agenda, se completa o el cliente no se presenta.
export const ESTADO_CITA_LABEL: Record<EstadoEntrega, string> = {
  pendiente: 'Agendada',
  en_camino: 'En curso',
  entregada: 'Completada',
  no_asistio: 'No asistió',
  cancelada: 'Cancelada',
}

// Servicio a domicilio: el profesional viaja a casa del cliente
export const ESTADO_CITA_DOMICILIO_LABEL: Record<EstadoEntrega, string> = {
  pendiente: 'Agendada',
  en_camino: 'En camino',
  entregada: 'Completada',
  no_asistio: 'Cliente ausente',
  cancelada: 'Cancelada',
}

// Servicio en el local del vendedor: el cliente es quien va
export const ESTADO_CITA_LOCAL_LABEL: Record<EstadoEntrega, string> = {
  pendiente: 'Agendada',
  en_camino: 'En curso',
  entregada: 'Completada',
  no_asistio: 'No asistió',
  cancelada: 'Cancelada',
}

export const ESTADO_ENTREGA_BADGE: Record<EstadoEntrega, string> = {
  pendiente: 'badge-warning',
  en_camino: 'badge-neutral',
  entregada: 'badge-success',
  no_asistio: 'badge-danger',
  cancelada: 'badge-muted',
}

// ¿El ítem es una cita de servicio? (las órdenes antiguas pueden no traer `tipo`, pero sí la cita)
export const esCita = (it: Pick<ItemOrden, 'tipo' | 'cita'>): boolean => it.tipo === 'servicio' || !!it.cita

// Si TODOS los ítems son citas se usa el vocabulario de citas; con productos (o mezcla), el de entrega.
export const soloCitas = (items: Array<Pick<ItemOrden, 'tipo' | 'cita'>>): boolean => items.length > 0 && items.every(esCita)

type ItemEstado = Pick<ItemOrden, 'tipo' | 'cita' | 'modalidadEntrega'>

// Textos de estado según lo que hay en los ítems: productos (o mezcla) -> entrega; solo citas -> según
// la modalidad (domicilio / local); citas de modalidades distintas -> vocabulario genérico de cita.
export function etiquetasDe(items: ItemEstado[]): Record<EstadoEntrega, string> {
  if (!soloCitas(items)) return ESTADO_ENTREGA_LABEL
  if (items.every((it) => it.modalidadEntrega === 'domicilio_cliente')) return ESTADO_CITA_DOMICILIO_LABEL
  if (items.every((it) => it.modalidadEntrega === 'local_vendedor')) return ESTADO_CITA_LOCAL_LABEL
  return ESTADO_CITA_LABEL
}

export const etiquetaEstado = (estado: EstadoEntrega, items: ItemEstado[]): string => etiquetasDe(items)[estado]

// Solo citas a domicilio: el vendedor puede marcar "En camino" mientras viaja
export const soloDomicilio = (items: ItemEstado[]): boolean => soloCitas(items) && items.every((it) => it.modalidadEntrega === 'domicilio_cliente')

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
  margenMinutos = 0,
): boolean {
  const dia = diaSemanaDeFecha(ahora.fecha)
  return reglas
    .filter((r) => r.diaSemana === dia)
    .some((r) => {
      const inicio = aMinutos(r.horaInicio)
      const espacio = aMinutos(r.horaFin) - inicio
      if (espacio < duracionMinutos) return false
      const ultimoInicio = inicio + Math.floor((espacio - duracionMinutos) / (duracionMinutos + margenMinutos)) * (duracionMinutos + margenMinutos)
      return ultimoInicio > ahora.minutos
    })
}

// Primera fecha en la que se puede agendar: hoy solo si todavía quedan horarios, si no el siguiente día con atención
export function primeraFechaDisponible(
  reglas: ReglaHorario[],
  duracionMinutos: number,
  ahora: { fecha: string; minutos: number } = ahoraPanama(),
  diasNoDisponibles: string[] = [],
  margenMinutos = 0,
): string {
  const dias = new Set(reglas.map((r) => r.diaSemana))
  for (let i = 0; i < 60; i++) {
    const fecha = sumarDiasFecha(ahora.fecha, i)
    if (!dias.has(diaSemanaDeFecha(fecha)) || diasNoDisponibles.includes(fecha)) continue
    if (i === 0 && !quedanHorariosHoy(reglas, duracionMinutos, ahora, margenMinutos)) continue
    return fecha
  }
  return ahora.fecha
}

// '2026-07-05T...' -> 'Hace 4 meses'
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const dias = Math.max(0, Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86_400_000))
  const plural = (n: number, u: string, p: string) => `Hace ${n} ${n === 1 ? u : p}`
  if (dias < 1) return 'Hoy'
  if (dias < 7) return plural(dias, 'día', 'días')
  if (dias < 30) return plural(Math.floor(dias / 7), 'semana', 'semanas')
  if (dias < 365) return plural(Math.floor(dias / 30), 'mes', 'meses')
  return plural(Math.floor(dias / 365), 'año', 'años')
}

// ¿Ya llegó el día y la hora de la cita? (hora de Panamá, UTC-5 fijo). Antes de eso el vendedor no puede
// marcarla como completada ni como "no asistió".
export function citaYaEmpezo(it: Pick<ItemOrden, 'cita'>, ahora: number = Date.now()): boolean {
  if (!it.cita) return true
  const inicio = Date.parse(`${it.cita.fecha}T${it.cita.horaInicio}:00-05:00`)
  return Number.isNaN(inicio) || inicio <= ahora
}

// Una cita se puede cancelar hasta estas horas antes de empezar (el servidor lo vuelve a comprobar)
export const HORAS_MIN_CANCELACION = 2

// ¿Se puede cancelar esta cita? Debe estar agendada, la orden pagada o con pago en el lugar, y faltar 2 h o más.
// Las citas están en hora de Panamá (UTC-5 fijo, sin horario de verano).
export function puedeCancelarCita(it: ItemOrden, estadoPago: EstadoPago, ahora: number = Date.now()): boolean {
  if (!it.cita || !esCita(it)) return false
  if (estadoPago !== 'pagada' && estadoPago !== 'por_cobrar') return false
  if ((it.estadoEntrega ?? 'pendiente') !== 'pendiente') return false
  const inicio = Date.parse(`${it.cita.fecha}T${it.cita.horaInicio}:00-05:00`)
  return !Number.isNaN(inicio) && inicio - ahora >= HORAS_MIN_CANCELACION * 3_600_000
}
