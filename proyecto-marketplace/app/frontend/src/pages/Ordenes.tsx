import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ordenesApi, type EstadoPago, type Orden } from '../lib/api'
import { ESTADO_ENTREGA_BADGE, ESTADO_ENTREGA_LABEL, ESTADO_PAGO_BADGE, ESTADO_PAGO_LABEL } from '../lib/estado'
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

  useEffect(() => {
    ordenesApi
      .listar()
      .then(setOrdenes)
      .finally(() => setCargando(false))
  }, [])

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
                {orden.items.map((it) => `${it.nombre} ×${it.cantidad}`).join(', ')}
              </div>
              <div className={styles.badges}>
                <span className={`badge ${ESTADO_PAGO_BADGE[orden.estadoPago]}`}>{ESTADO_PAGO_LABEL[orden.estadoPago]}</span>
                <span className={`badge ${ESTADO_ENTREGA_BADGE[orden.estadoEntrega]}`}>
                  {ESTADO_ENTREGA_LABEL[orden.estadoEntrega]}
                </span>
              </div>
              <span style={{ fontWeight: 800, minWidth: '4.5rem', textAlign: 'right' }}>${orden.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
