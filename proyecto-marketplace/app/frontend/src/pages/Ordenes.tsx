import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalogoApi, imagenPrincipal, ordenesApi, type EstadoPago, type Orden } from '../lib/api'
import { IconImage } from '../components/icons'
import { ESTADO_ENTREGA_BADGE, ESTADO_ENTREGA_LABEL, ESTADO_PAGO_BADGE, ESTADO_PAGO_LABEL, formatFecha, formatHora12h } from '../lib/estado'
import styles from './Ordenes.module.css'

const TABS: Array<{ id: EstadoPago | 'todas'; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'pagada', label: 'Pagadas' },
  { id: 'rechazada', label: 'Rechazadas' },
]

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<EstadoPago | 'todas'>('todas')

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

  const filtradas = tab === 'todas' ? ordenes : ordenes.filter((o) => o.estadoPago === tab)

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
                      {orden.estadoPago === 'pagada' && orden.items.length > 1 && it.estadoEntrega && (
                        <p className="muted" style={{ fontSize: '0.8125rem' }}>
                          Entrega: {ESTADO_ENTREGA_LABEL[it.estadoEntrega]}
                        </p>
                      )}
                      {it.cita && (
                        <p className="muted" style={{ fontSize: '0.8125rem' }}>
                          Cita: {formatFecha(it.cita.fecha)} · {formatHora12h(it.cita.horaInicio)} – {formatHora12h(it.cita.horaFin)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <div className={styles.badges}>
                <span className={`badge ${ESTADO_PAGO_BADGE[orden.estadoPago]}`}>{ESTADO_PAGO_LABEL[orden.estadoPago]}</span>
                <span className={`badge ${ESTADO_ENTREGA_BADGE[orden.estadoEntrega]}`} title="Estado de la entrega">
                  {ESTADO_ENTREGA_LABEL[orden.estadoEntrega]}
                </span>
              </div>
              {orden.estadoPago !== 'pagada' && (
                <Link to={`/checkout?orden=${orden.id}`} className="btn btn-sm btn-primary">
                  Reintentar pago
                </Link>
              )}
              <span style={{ fontWeight: 800, minWidth: '4.5rem', textAlign: 'right' }}>${orden.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
