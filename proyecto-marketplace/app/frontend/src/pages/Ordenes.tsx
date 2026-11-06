import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, catalogoApi, imagenPrincipal, ordenesApi, type EstadoPago, type ItemOrden, type Orden } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { IconImage } from '../components/icons'
import { ESTADO_ENTREGA_BADGE, ESTADO_PAGO_BADGE, ESTADO_PAGO_LABEL, esCita, etiquetaEstado, formatFecha, formatHora12h, puedeCancelarCita, soloCitas } from '../lib/estado'
import styles from './Ordenes.module.css'

const TABS: Array<{ id: EstadoPago | 'todas'; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'pagada', label: 'Pagadas' },
  { id: 'por_cobrar', label: 'Pago en el lugar' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'cancelada', label: 'Canceladas' },
]

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<EstadoPago | 'todas'>('todas')
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
        .then((p) => setFotos((prev) => ({ ...prev, [id]: imagenPrincipal(p) ?? '' })))
        .catch(() => setFotos((prev) => ({ ...prev, [id]: '' })))
    })
  }, [ordenes])

  // "Canceladas" agrupa las reembolsadas y las canceladas sin pago previo
  const coincide = (o: Orden) => tab === 'todas' || o.estadoPago === tab || (tab === 'cancelada' && o.estadoPago === 'reembolsada')
  const filtradas = ordenes.filter(coincide)

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

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.active : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
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
            <div key={orden.id} className={`card ${styles.row}`}>
              <div className={styles.rowMeta}>
                <p style={{ fontWeight: 700 }}>#{orden.id.slice(0, 8)}</p>
                <p className="muted" style={{ fontSize: '0.8125rem' }}>
                  {new Date(orden.creadoEn).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })}
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
