import { useEffect, useState } from 'react'
import { VendorLayout } from '../../components/VendorLayout'
import { Select } from '../../components/Select'
import { ConfirmModal } from '../../components/ConfirmModal'
import { useAuth } from '../../context/AuthContext'
import { ordenesApi, type EstadoEntrega, type Orden } from '../../lib/api'
import { ESTADO_PAGO_BADGE, ESTADO_PAGO_LABEL, etiquetasDe, formatFecha, formatHora12h, soloCitas, soloDomicilio } from '../../lib/estado'
import styles from './Vendedor.module.css'

// Las pestañas sirven para productos y para citas, así que usan palabras que valen para los dos
const TABS: Array<{ id: EstadoEntrega | 'todas'; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'en_camino', label: 'En camino' },
  { id: 'entregada', label: 'Completadas' },
  { id: 'no_asistio', label: 'No asistió' },
]

// Opciones del selector: un producto se entrega; una cita se completa o el cliente no asiste
const OPCIONES_PRODUCTO: EstadoEntrega[] = ['pendiente', 'en_camino', 'entregada']
const OPCIONES_CITA: EstadoEntrega[] = ['pendiente', 'entregada', 'no_asistio']
const OPCIONES_CITA_DOMICILIO: EstadoEntrega[] = ['pendiente', 'en_camino', 'entregada', 'no_asistio']

export default function VendedorOrdenes() {
  const { usuario } = useAuth()
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<EstadoEntrega | 'todas'>('todas')
  const [actualizando, setActualizando] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<{ ordenId: string; estado: EstadoEntrega; etiqueta: string } | null>(null)

  useEffect(() => {
    ordenesApi
      .listarVendedor()
      .then(setOrdenes)
      .finally(() => setCargando(false))
  }, [])

  const cambiarEstado = async (ordenId: string, estadoEntrega: EstadoEntrega) => {
    setActualizando(ordenId)
    try {
      const actualizada = await ordenesApi.actualizarEstadoEntrega(ordenId, estadoEntrega)
      setOrdenes((prev) => prev.map((o) => (o.id === ordenId ? actualizada : o)))
    } finally {
      setActualizando(null)
    }
  }

  const filtradas = tab === 'todas' ? ordenes : ordenes.filter((o) => o.estadoEntrega === tab)

  return (
    <VendorLayout titulo="Órdenes recibidas">
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="btn btn-sm"
            style={
              tab === t.id
                ? { background: 'var(--color-text)', borderColor: 'var(--color-text)', color: '#fff' }
                : undefined
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">No hay órdenes en esta categoría.</div>
      ) : (
        <div className={styles.table}>
          {filtradas.map((orden) => {
            const propios = usuario ? orden.items.filter((it) => it.vendedorId === usuario.id) : orden.items
            const totalPropio = propios.reduce((acc, it) => acc + it.subtotal, 0)
            const citas = soloCitas(propios)
            const etiquetas = etiquetasDe(propios)
            const opciones = soloDomicilio(propios) ? OPCIONES_CITA_DOMICILIO : citas ? OPCIONES_CITA : OPCIONES_PRODUCTO
            return (
              <div key={orden.id} className={`card ${styles.tableRow}`}>
                <div className={styles.rowInfo}>
                  <p style={{ fontWeight: 700 }}>#{orden.id.slice(0, 8)}</p>
                  <p className="muted" style={{ fontSize: '0.8125rem' }}>
                    {propios.map((it) => (it.cita ? `${it.nombre} (cita ${formatFecha(it.cita.fecha)} ${formatHora12h(it.cita.horaInicio)})` : `${it.nombre} ×${it.cantidad}`)).join(', ')}
                  </p>
                  {orden.direccion && (
                    <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                      <b>{citas ? 'Cliente:' : 'Entregar a:'}</b> {orden.direccion.nombre} · Tel. {orden.direccion.telefono} · {orden.direccion.direccion}
                    </p>
                  )}
                </div>
                <span className="muted" style={{ fontSize: '0.8125rem' }}>
                  {new Date(orden.creadoEn).toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })}
                </span>
                <span className={`badge ${ESTADO_PAGO_BADGE[orden.estadoPago]}`}>{ESTADO_PAGO_LABEL[orden.estadoPago]}</span>
                <Select
                  size="sm"
                  width="9rem"
                  value={orden.estadoEntrega}
                  disabled={actualizando === orden.id || orden.estadoPago !== 'pagada'}
                  onChange={(v) =>
                    v === 'entregada' || v === 'no_asistio'
                      ? setPendiente({ ordenId: orden.id, estado: v as EstadoEntrega, etiqueta: etiquetas[v as EstadoEntrega] })
                      : cambiarEstado(orden.id, v as EstadoEntrega)
                  }
                  options={[...new Set([...opciones, orden.estadoEntrega])].map((e) => ({ value: e, label: etiquetas[e] }))}
                />
                <span style={{ fontWeight: 800, minWidth: '4.5rem', textAlign: 'right' }}>${totalPropio.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      )}
      <ConfirmModal
        abierto={!!pendiente}
        titulo={`Marcar como "${pendiente?.etiqueta ?? ''}"`}
        mensaje="Se le avisará al cliente por correo y en la app. Si te equivocas, podrás cambiar el estado después, pero el aviso ya se habrá enviado."
        textoConfirmar="Sí, marcar"
        procesando={!!pendiente && actualizando === pendiente.ordenId}
        onConfirmar={async () => {
          if (pendiente) await cambiarEstado(pendiente.ordenId, pendiente.estado)
          setPendiente(null)
        }}
        onCancelar={() => setPendiente(null)}
      />
    </VendorLayout>
  )
}
