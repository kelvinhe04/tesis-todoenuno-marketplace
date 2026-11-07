import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, catalogoApi, imagenPrincipal, ordenesApi, type EstadoEntrega, type EstadoPago, type ItemOrden, type Orden } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { Select } from '../components/Select'
import { IconImage } from '../components/icons'
import { ESTADO_ENTREGA_BADGE, ESTADO_PAGO_BADGE, ESTADO_PAGO_LABEL, esCita, etiquetaEstado, formatFecha, formatFechaHora, formatHora12h, puedeCancelarCita, soloCitas } from '../lib/estado'
import styles from './Ordenes.module.css'

// Tres filtros que se combinan: tipo de publicación, estado del pago y estado de la entrega / cita
// (las palabras cambian: un producto se envía y se entrega; una cita se agenda y se completa).
type Tipo = 'todos' | 'producto' | 'servicio'
type FiltroPago = EstadoPago | 'todas'
type FiltroEntrega = EstadoEntrega | 'todas'

const TIPOS: Array<{ id: Tipo; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'producto', label: 'Productos' },
  { id: 'servicio', label: 'Servicios' },
]

const PAGOS: Array<{ id: FiltroPago; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes de pago' },
  { id: 'pagada', label: 'Pagadas' },
  { id: 'por_cobrar', label: 'Pago en el lugar' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'cancelada', label: 'Canceladas' },
]

const ENTREGAS: Record<Tipo, Array<{ id: FiltroEntrega; label: string }>> = {
  todos: [
    { id: 'todas', label: 'Todas' },
    { id: 'pendiente', label: 'Pendientes / Agendadas' },
    { id: 'en_camino', label: 'En camino' },
    { id: 'entregada', label: 'Entregadas / Completadas' },
    { id: 'no_asistio', label: 'No asistió' },
    { id: 'cancelada', label: 'Canceladas' },
  ],
  producto: [
    { id: 'todas', label: 'Todas' },
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'en_camino', label: 'En camino' },
    { id: 'entregada', label: 'Entregadas' },
    { id: 'cancelada', label: 'Canceladas' },
  ],
  servicio: [
    { id: 'todas', label: 'Todas' },
    { id: 'pendiente', label: 'Agendadas' },
    { id: 'en_camino', label: 'En camino' },
    { id: 'entregada', label: 'Completadas' },
    { id: 'no_asistio', label: 'No asistió' },
    { id: 'cancelada', label: 'Canceladas' },
  ],
}

const chipEstilo = (activo: boolean) => (activo ? { background: 'var(--color-text)', borderColor: 'var(--color-text)', color: '#fff' } : undefined)

export default function Ordenes() {
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)
  const [tipo, setTipo] = useState<Tipo>('todos')
  const [pago, setPago] = useState<FiltroPago>('todas')
  const [entrega, setEntrega] = useState<FiltroEntrega>('todas')
  const [aCancelar, setACancelar] = useState<{ orden: Orden; item: ItemOrden } | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null)

  // productoId -> foto principal ('' si la publicación ya no existe). Los ítems de una orden no guardan la foto.
  const [fotos, setFotos] = useState<Record<string, string>>({})

  useEffect(() => {
    ordenesApi
      .listar()
      .then(setOrdenes)
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const ids = [...new Set(ordenes.flatMap((o) => o.items.map((it) => it.productoId)))]
    ids.forEach((id) => {
      catalogoApi
        .obtener(id)
        .then((p) => setFotos((prev) => ({ ...prev, [id]: imagenPrincipal(p, 160) ?? '' })))
        .catch(() => setFotos((prev) => ({ ...prev, [id]: '' })))
    })
  }, [ordenes])

  // Una orden cuenta como "producto" y/o "servicio" según sus ítems (puede tener de ambos)
  const esDelTipo = (o: Orden, t: Tipo) => t === 'todos' || (t === 'servicio' ? o.items.some(esCita) : o.items.some((it) => !esCita(it)))
  // "Canceladas" agrupa las reembolsadas y las canceladas sin pago previo
  const cumplePago = (o: Orden, p: FiltroPago) => p === 'todas' || o.estadoPago === p || (p === 'cancelada' && o.estadoPago === 'reembolsada')
  const cumpleEntrega = (o: Orden, e: FiltroEntrega) => e === 'todas' || o.estadoEntrega === e

  // Cada contador muestra cuántas órdenes habría al elegir ese chip con los otros filtros ya aplicados
  const delTipo = ordenes.filter((o) => esDelTipo(o, tipo))
  const filtradas = delTipo.filter((o) => cumplePago(o, pago) && cumpleEntrega(o, entrega))
  const cambiarTipo = (t: Tipo) => {
    setTipo(t)
    setEntrega('todas')
    if (t === 'producto' && pago === 'por_cobrar') setPago('todas') // el pago en el lugar es solo de servicios
  }

  const confirmarCancelacion = async () => {
    if (!aCancelar) return
    setCancelando(true)
    setErrorCancelar(null)
    try {
      const actualizada = await ordenesApi.cancelarCita(aCancelar.orden.id, aCancelar.item.productoId)
      setOrdenes((prev) => prev.map((o) => (o.id === actualizada.id ? actualizada : o)))
      setACancelar(null)
    } catch (err) {
      setErrorCancelar(err instanceof ApiError ? err.message : 'No se pudo cancelar la cita')
    } finally {
      setCancelando(false)
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.375rem', marginBottom: '1.25rem' }}>Mis órdenes</h1>

      <div className={styles.filtros}>
        <div className={styles.filtroFila}>
          <span className={styles.filtroTitulo}>Tipo</span>
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => cambiarTipo(t.id)} className="btn btn-sm" style={chipEstilo(tipo === t.id)}>
              {t.label} ({ordenes.filter((o) => esDelTipo(o, t.id) && cumplePago(o, pago) && cumpleEntrega(o, entrega)).length})
            </button>
          ))}
        </div>
        <div className={styles.filtroFila}>
          <span className={styles.filtroTitulo}>Pago</span>
          <Select
            size="sm"
            width="16rem"
            value={pago}
            onChange={(v) => setPago(v as FiltroPago)}
            options={PAGOS.filter((p) => !(tipo === 'producto' && p.id === 'por_cobrar')).map((p) => ({
              value: p.id,
              label: `${p.label} (${delTipo.filter((o) => cumplePago(o, p.id) && cumpleEntrega(o, entrega)).length})`,
            }))}
          />
          <span className={styles.filtroTitulo} style={{ marginLeft: '0.75rem' }}>
            Entrega
          </span>
          <Select
            size="sm"
            width="17rem"
            value={entrega}
            onChange={(v) => setEntrega(v as FiltroEntrega)}
            options={ENTREGAS[tipo].map((e) => ({
              value: e.id,
              label: `${e.label} (${delTipo.filter((o) => cumplePago(o, pago) && cumpleEntrega(o, e.id)).length})`,
            }))}
          />
        </div>
      </div>

      {cargando ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          <p>No tienes órdenes en esta categoría todavía.</p>
          <Link to="/catalogo" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className={styles.list}>
          {filtradas.map((orden) => (
            <div
              key={orden.id}
              // Con un solo ítem, toda la tarjeta abre el producto (como en el carrito); los botones y enlaces siguen con lo suyo
              className={`card ${styles.row} ${orden.items.length === 1 ? styles.clicable : ''}`}
              onClick={(e) => {
                if (orden.items.length !== 1 || (e.target as HTMLElement).closest('button, a')) return
                navigate(`/productos/${orden.items[0].productoId}`)
              }}
            >
              <div className={styles.rowMeta}>
                <p style={{ fontWeight: 700 }}>#{orden.id.slice(0, 8)}</p>
                <p className="muted" style={{ fontSize: '0.8125rem' }}>
                  {formatFechaHora(orden.creadoEn)}
                </p>
              </div>
              <div className={styles.rowItems}>
                {orden.items.map((it, i) => (
                  <Link key={`${it.productoId}-${i}`} to={`/productos/${it.productoId}`} className={styles.item}>
                    <div className={styles.thumb}>
                      {fotos[it.productoId] ? (
                        <img src={fotos[it.productoId]} alt={it.nombre} />
                      ) : (
                        <IconImage width={20} height={20} />
                      )}
                    </div>
                    <div className={styles.itemInfo}>
                      <p className={styles.itemNombre}>{it.nombre}</p>
                      <p className="muted" style={{ fontSize: '0.8125rem' }}>
                        {it.cita ? 'Servicio' : `×${it.cantidad} · $${it.precio.toFixed(2)} c/u`}
                      </p>
                      {['pagada', 'por_cobrar', 'reembolsada', 'cancelada'].includes(orden.estadoPago) && (orden.items.length > 1 || it.estadoEntrega === 'cancelada') && it.estadoEntrega && (
                        <p className="muted" style={{ fontSize: '0.8125rem' }}>
                          {esCita(it) ? 'Estado de la cita' : 'Entrega'}: {etiquetaEstado(it.estadoEntrega, [it])}
                        </p>
                      )}
                      {it.cita && (
                        <p className="muted" style={{ fontSize: '0.8125rem' }}>
                          Cita: {formatFecha(it.cita.fecha)} · {formatHora12h(it.cita.horaInicio)} – {formatHora12h(it.cita.horaFin)}
                        </p>
                      )}
                      {/* Cancelar solo se permite hasta 1 h antes: si ya pasó ese límite, se explica por qué no hay botón */}
                      {it.cita &&
                        esCita(it) &&
                        (orden.estadoPago === 'pagada' || orden.estadoPago === 'por_cobrar') &&
                        (it.estadoEntrega ?? 'pendiente') === 'pendiente' &&
                        !puedeCancelarCita(it, orden.estadoPago) &&
                        Date.parse(`${it.cita.fecha}T${it.cita.horaInicio}:00-05:00`) > Date.now() && (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-warning, #9a6700)', fontWeight: 600 }}>
                            Ya no se puede cancelar: falta menos de 1 hora para la cita.
                          </p>
                        )}
                      {it.estadoEntrega === 'cancelada' && it.reembolso !== undefined && (
                        <p className="muted" style={{ fontSize: '0.8125rem' }}>
                          Reembolso de ${it.reembolso.toFixed(2)} (simulado)
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <div className={styles.badges}>
                <span className={`badge ${ESTADO_PAGO_BADGE[orden.estadoPago]}`}>{ESTADO_PAGO_LABEL[orden.estadoPago]}</span>
                {!(orden.estadoPago === 'cancelada' && orden.estadoEntrega === 'cancelada') && (
                  <span
                    className={`badge ${ESTADO_ENTREGA_BADGE[orden.estadoEntrega]}`}
                    title={soloCitas(orden.items) ? 'Estado de la cita' : 'Estado de la entrega'}
                  >
                    {etiquetaEstado(orden.estadoEntrega, orden.items)}
                  </span>
                )}
              </div>
              {(orden.estadoPago === 'pendiente' || orden.estadoPago === 'rechazada') && (
                <Link to={`/checkout?orden=${orden.id}`} className="btn btn-sm btn-primary">
                  Reintentar pago
                </Link>
              )}
              {orden.items
                .filter((it) => puedeCancelarCita(it, orden.estadoPago))
                .map((it) => (
                  <button
                    key={it.productoId}
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      setErrorCancelar(null)
                      setACancelar({ orden, item: it })
                    }}
                  >
                    {orden.items.filter((x) => puedeCancelarCita(x, orden.estadoPago)).length > 1 ? `Cancelar «${it.nombre}»` : 'Cancelar cita'}
                  </button>
                ))}
              <span style={{ fontWeight: 800, minWidth: '4.5rem', textAlign: 'right' }}>${orden.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        abierto={!!aCancelar}
        titulo="Cancelar cita"
        mensaje={
          aCancelar
            ? `Se cancelará «${aCancelar.item.nombre}» del ${formatFecha(aCancelar.item.cita!.fecha)} a las ${formatHora12h(aCancelar.item.cita!.horaInicio).replace(/\.$/, '')}. El horario quedará libre para otra persona. ${
                aCancelar.orden.estadoPago === 'pagada'
                  ? `Se registrará un reembolso de $${aCancelar.item.subtotal.toFixed(2)} (simulado en este entorno de pruebas).`
                  : 'Como ibas a pagar en el lugar, no hay nada que reembolsar.'
              }${errorCancelar ? ` ${errorCancelar}` : ''}`
            : ''
        }
        textoConfirmar="Sí, cancelar cita"
        textoCancelar="Mantener cita"
        peligro
        procesando={cancelando}
        onConfirmar={confirmarCancelacion}
        onCancelar={() => setACancelar(null)}
      />
    </div>
  )
}
