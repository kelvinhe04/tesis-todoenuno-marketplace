const BASE = '/api'

const TOKEN_KEY = 'mp_token'
const USER_KEY = 'mp_usuario'

export type Rol = 'comprador' | 'vendedor'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUsuarioGuardado(): Usuario | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? (JSON.parse(raw) as Usuario) : null
}

export function guardarSesion(token: string, usuario: Usuario) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(usuario))
}

export function limpiarSesion() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  }

  const resp = await fetch(`${BASE}${path}`, { ...options, headers })

  if (resp.status === 204) {
    return undefined as T
  }

  const isJson = resp.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await resp.json().catch(() => undefined) : undefined

  if (!resp.ok) {
    const mensaje = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || `Error ${resp.status}`
    throw new ApiError(resp.status, mensaje, data)
  }

  return data as T
}

// ---------------- auth ----------------

export interface RegistroPayload {
  nombre: string
  email: string
  password: string
  rol: Rol
}

export interface LoginPayload {
  email: string
  password: string
}

interface SesionRespuesta {
  token: string
  usuario: Usuario
}

export interface RequiereRolRespuesta {
  requiereRol: true
  nombre: string
  email: string
}

export const authApi = {
  registro: (dto: RegistroPayload) => request<SesionRespuesta>('/auth/registro', { method: 'POST', body: JSON.stringify(dto) }),
  login: (dto: LoginPayload) => request<SesionRespuesta>('/auth/login', { method: 'POST', body: JSON.stringify(dto) }),
  google: (credential: string, rol?: Rol) =>
    request<SesionRespuesta | RequiereRolRespuesta>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, rol }),
    }),
  me: () => request<Usuario>('/auth/me'),
  perfilPublico: (id: string) => request<{ id: string; nombre: string }>(`/auth/usuarios/${id}`),
}

// ---------------- catalogo ----------------

export type TipoPublicacion = 'producto' | 'servicio'
export type ModalidadEntrega = 'domicilio_cliente' | 'local_vendedor'

export interface ReglaDisponibilidad {
  diaSemana: number
  horaInicio: string
  horaFin: string
}

export interface Disponibilidad {
  duracionMinutos: number
  reglas: ReglaDisponibilidad[]
}

export interface Ubicacion {
  lat: number
  lng: number
}

export interface Producto {
  _id: string
  tipo: TipoPublicacion
  nombre: string
  marca?: string
  descripcion: string
  categoria: string
  precio: number
  stock: number
  modalidadEntrega?: ModalidadEntrega
  direccionLocal?: string
  ubicacion?: Ubicacion
  disponibilidad?: Disponibilidad
  imagenUrl?: string
  imagenes?: string[]
  vendedorId: string
  calificacionPromedio: number
  numResenas: number
  creadoEn: string
}

export interface FiltrosCatalogo {
  tipo?: TipoPublicacion
  categoria?: string
  precioMin?: number
  precioMax?: number
  calificacionMin?: number
  vendedorId?: string
  buscar?: string
  pagina?: number
  limite?: number
}

export interface PaginaCatalogo {
  items: Producto[]
  total: number
  pagina: number
  limite: number
  totalPaginas: number
}

export interface CrearProductoPayload {
  tipo: TipoPublicacion
  nombre: string
  marca?: string
  descripcion: string
  categoria: string
  precio: number
  stock?: number
  modalidadEntrega?: ModalidadEntrega
  direccionLocal?: string
  ubicacion?: Ubicacion
  disponibilidad?: Disponibilidad
  imagenUrl?: string
  imagenes?: string[]
}

export function imagenPrincipal(p: { imagenes?: string[]; imagenUrl?: string }): string | undefined {
  return p.imagenes?.[0] || p.imagenUrl
}

function aQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export const catalogoApi = {
  listar: (filtros: FiltrosCatalogo = {}) => request<PaginaCatalogo>(`/catalogo${aQueryString(filtros)}`),
  obtener: (id: string) => request<Producto>(`/catalogo/${id}`),
  crear: (dto: CrearProductoPayload) => request<Producto>('/catalogo', { method: 'POST', body: JSON.stringify(dto) }),
  actualizar: (id: string, dto: Partial<CrearProductoPayload>) =>
    request<Producto>(`/catalogo/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  eliminar: (id: string) => request<{ eliminado: boolean }>(`/catalogo/${id}`, { method: 'DELETE' }),
}

// ---------------- reseñas ----------------

export interface Resena {
  _id: string
  productoId: string
  compradorId: string
  compradorEmail: string
  ordenId: string
  calificacion: number
  comentario?: string
  creadoEn: string
}

export interface CrearResenaPayload {
  ordenId: string
  calificacion: number
  comentario?: string
}

export const resenasApi = {
  listar: (productoId: string) => request<Resena[]>(`/catalogo/${productoId}/resenas`),
  crear: (productoId: string, dto: CrearResenaPayload) =>
    request<Resena[]>(`/catalogo/${productoId}/resenas`, { method: 'POST', body: JSON.stringify(dto) }),
}

// ---------------- disponibilidad / reservas (citas de servicios) ----------------

export interface SlotDisponible {
  horaInicio: string
  horaFin: string
}

export type EstadoReserva = 'retenida' | 'confirmada' | 'cancelada'

export interface Reserva {
  _id: string
  productoId: string
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoReserva
}

export const disponibilidadApi = {
  obtener: (productoId: string, fecha: string) =>
    request<SlotDisponible[]>(`/catalogo/${productoId}/disponibilidad?fecha=${fecha}`),
}

export const reservasApi = {
  crear: (productoId: string, fecha: string, horaInicio: string) =>
    request<Reserva>(`/catalogo/${productoId}/reservas`, { method: 'POST', body: JSON.stringify({ fecha, horaInicio }) }),
  cancelar: (productoId: string, reservaId: string) =>
    request<Reserva>(`/catalogo/${productoId}/reservas/${reservaId}/cancelar`, { method: 'PATCH' }),
}

// ---------------- carrito ----------------

export interface CitaCarrito {
  reservaId: string
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoReserva
}

export interface ItemCarrito {
  productoId: string
  tipo: TipoPublicacion
  nombre: string
  precio: number
  cantidad: number
  subtotal: number
  imagenUrl?: string
  vendedorId: string
  cita?: CitaCarrito
}

export interface Carrito {
  items: ItemCarrito[]
  subtotal: number
  envio: number
  total: number
}

export const carritoApi = {
  obtener: () => request<Carrito>('/carrito'),
  agregar: (productoId: string, cantidad: number, reservaId?: string) =>
    request<Carrito>('/carrito/items', { method: 'POST', body: JSON.stringify({ productoId, cantidad, reservaId }) }),
  actualizar: (productoId: string, cantidad: number) =>
    request<Carrito>(`/carrito/items/${productoId}`, { method: 'PATCH', body: JSON.stringify({ cantidad }) }),
  eliminarItem: (productoId: string) => request<Carrito>(`/carrito/items/${productoId}`, { method: 'DELETE' }),
  vaciar: () => request<Carrito>('/carrito', { method: 'DELETE' }),
}

// ---------------- ordenes ----------------

export type EstadoPago = 'pendiente' | 'pagada' | 'rechazada'
export type EstadoEntrega = 'pendiente' | 'en_camino' | 'entregada'

export interface ItemOrden {
  productoId: string
  vendedorId: string
  nombre: string
  precio: number
  cantidad: number
  subtotal: number
  tipo?: TipoPublicacion
  cita?: { reservaId: string; fecha: string; horaInicio: string; horaFin: string }
}

export interface Direccion {
  nombre: string
  telefono: string
  direccion: string
}

export interface Orden {
  id: string
  compradorId: string
  items: ItemOrden[]
  direccion: Direccion
  subtotal: number
  envio: number
  total: number
  estadoPago: EstadoPago
  estadoEntrega: EstadoEntrega
  creadoEn: string
}

export const ordenesApi = {
  crear: (direccion: Direccion) => request<Orden>('/ordenes', { method: 'POST', body: JSON.stringify({ direccion }) }),
  listar: () => request<Orden[]>('/ordenes'),
  listarVendedor: () => request<Orden[]>('/ordenes/vendedor'),
  obtener: (id: string) => request<Orden>(`/ordenes/${id}`),
  actualizarEstadoEntrega: (id: string, estadoEntrega: EstadoEntrega) =>
    request<Orden>(`/ordenes/${id}/estado-entrega`, { method: 'PATCH', body: JSON.stringify({ estadoEntrega }) }),
}

// ---------------- pagos ----------------

export interface ProcesarPagoPayload {
  metodo: 'tarjeta' | 'paypal'
  numeroTarjeta?: string
  vencimiento?: string
  cvv?: string
}

export interface Pago {
  id: string
  ordenId: string
  monto: number
  metodo: string
  estado: 'aprobado' | 'rechazado'
  motivoRechazo?: string
  tarjetaUltimos4?: string
}

export const pagosApi = {
  procesar: (ordenId: string, dto: ProcesarPagoPayload) =>
    request<Pago>(`/pagos/ordenes/${ordenId}`, { method: 'POST', body: JSON.stringify(dto) }),
}

// ---------------- notificaciones ----------------

export interface Notificacion {
  id: string
  tipo: string
  mensaje: string
  ordenId: string
  leida: boolean
  creadoEn: string
}

export const notificacionesApi = {
  listar: () => request<Notificacion[]>('/notificaciones'),
  marcarLeida: (id: string) => request<Notificacion>(`/notificaciones/${id}/leida`, { method: 'PATCH' }),
}
