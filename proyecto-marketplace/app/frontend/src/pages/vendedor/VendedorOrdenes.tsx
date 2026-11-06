import { useEffect, useState } from 'react'
import { VendorLayout } from '../../components/VendorLayout'
import { Select } from '../../components/Select'
import { ConfirmModal } from '../../components/ConfirmModal'
import { useAuth } from '../../context/AuthContext'
import { catalogoApi, imagenPrincipal, ordenesApi, type EstadoEntrega, type Orden } from '../../lib/api'
import { IconImage } from '../../components/icons'
import { ESTADO_PAGO_BADGE, ESTADO_PAGO_LABEL, esCita, etiquetasDe, citaYaEmpezo, formatFecha, formatHora12h, soloCitas, soloDomicilio } from '../../lib/estado'
import styles from './Vendedor.module.css'

// Filtros por tipo de publicación y, dentro de cada tipo, por estado (las palabras cambian: un producto se envía y
// se entrega; una cita se agenda, se completa, no asiste o se cancela).
type Tipo = 'todos' | 'producto' | 'servicio'
type Filtro = 'todas' | EstadoEntrega | 'por_cobrar'

const TIPOS: Array<{ id: Tipo; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'producto', label: 'Productos' },
  { id: 'servicio', label: 'Servicios' },
]

const FILTROS: Record<Tipo, Array<{ id: Filtro; label: string }>> = {
  todos: [
    { id: 'todas', label: 'Todas' },
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'en_camino', label: 'En camino' },
    { id: 'entregada', label: 'Completadas' },
    { id: 'no_asistio', label: 'No asistió' },
    { id: 'cancelada', label: 'Canceladas' },
  ],
  producto: [
    { id: 'todas', label: 'Todos' },
    { id: 'pendiente', label: 'Por enviar' },
    { id: 'en_camino', label: 'En camino' },
    { id: 'entregada', label: 'Entregados' },
  ],
  servicio: [
    { id: 'todas', label: 'Todas' },
    { id: 'pendiente', label: 'Agendadas' },
    { id: 'en_camino', label: 'En camino' },
    { id: 'entregada', label: 'Completadas' },
    { id: 'no_asistio', label: 'No asistió' },
    { id: 'cancelada', label: 'Canceladas' },
    { id: 'por_cobrar', label: 'Por cobrar' },
  ],
}

// Opciones del selector: un producto se entrega; una cita se completa o el cliente no asiste
const OPCIONES_PRODUCTO: EstadoEntrega[] = ['pendiente', 'en_camino', 'entregada']
const OPCIONES_CITA: EstadoEntrega[] = ['pendiente', 'entregada', 'no_asistio']
const OPCIONES_CITA_DOMICILIO: EstadoEntrega[] = ['pendiente', 'en_camino', 'entregada', 'no_asistio']

export default function VendedorOrdenes() {
  const { usuario } = useAuth()
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)
  const [tipo, setTipo] = useState<Tipo>('todos')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [actualizando, setActualizando] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<{ ordenId: string; estado: EstadoEntrega; etiqueta: string; porCobrar: boolean; total: number } | null>(null)

  useEffect(() => {
    ordenesApi
      .listarVendedor()
      .then(setOrdenes)
      .finally(() => setCargando(false))
  }, [])

  // productoId -> foto principal ('' si la publicación ya no existe). Los ítems de una orden no guardan la foto.
  const [fotos, setFotos] = useState<Record<string, string>>({})
  useEffect(() => {
    const ids = [...new Set(ordenes.flatMap((o) => o.items.map((it) => it.productoId)))]
    ids.forEach((id) => {
      catalogoApi
        .obtener(id)
        .then((p) => setFotos((prev) => ({ ...prev, [id]: imagenPrincipal(p) ?? '' })))
        .catch(() => setFotos((prev) => ({ ...prev, [id]: '' })))
    })
  }, [ordenes])

  const cambiarEstado = async (ordenId: string, estadoEntrega: EstadoEntrega) => {
    setActualizando(ordenId)
    try {
      const actualizada = await ordenesApi.actualizarEstadoEntrega(ordenId, estadoEntrega)
      setOrdenes((prev) => prev.map((o) => (o.id === ordenId ? actualizada : o)))
    } finally {
      setActualizando(null)
    }
  }

  // Una orden cuenta como "producto" y/o "servicio" según SUS ítems (una orden puede tener de ambos)
  const propiosDe = (o: Orden) => (usuario ? o.items.filter((it) => it.vendedorId === usuario.id) : o.items)
  const esDelTipo = (o: Orden, t: Tipo) => {
    if (t === 'todos') return true
    const propios = propiosDe(o)
    return t === 'servicio' ? propios.some(esCita) : propios.some((it) => !esCita(it))
  }
  const cumple = (o: Orden, f: Filtro) => f === 'todas' || (f === 'por_cobrar' ? o.estadoPago === 'por_cobrar' : o.estadoEntrega === f)

  const delTipo = ordenes.filter((o) => esDelTipo(o, tipo))
  const filtradas = delTipo.filter((o) => cumple(o, filtro))
  const cambiarTipo = (t: Tipo) => {
    setTipo(t)
    setFiltro('todas')
  }
  const chipEstilo = (activo: boolean) =>
    activo ? { background: 'var(--color-text)', borderColor: 'var(--color-text)', color: '#fff' } : undefined

  return (
    <VendorLayout titulo="Órdenes recibidas">
      <div className={styles.filtros}>
        <div className={styles.filtroFila}>
          <span className={styles.filtroTitulo}>Tipo</span>
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => cambiarTipo(t.id)} className="btn btn-sm" style={chipEstilo(tipo === t.id)}>
              {t.label} ({ordenes.filter((o) => esDelTipo(o, t.id)).length})
            </button>
          ))}
        </div>
        <div className={styles.filtroFila}>
          <span className={styles.filtroTitulo}>Estado</span>
          {FILTROS[tipo].map((f) => (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)} className="btn btn-sm" style={chipEstilo(filtro === f.id)}>
              {f.label} ({delTipo.filter((o) => cumple(o, f.id)).length})
            </button>
          ))}
        </div>
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
            // Hasta que llegue el día y la hora de la cita no se puede completar ni marcar "no asistió"
            const citaPendiente = propios.some((it) => it.cita && it.estadoEntrega !== 'cancelada' && !citaYaEmpezo(it))
            const bloqueada = (e: EstadoEntrega) => citaPendiente && (e === 'entregada' || e === 'no_asistio') && e !== orden.estadoEntrega
            return (
              <div key={orden.id} className={`card ${styles.tableRow}`}>
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  {propios.slice(0, 3).map((it, i) => (
                    <div key={`${it.productoId}-${i}`} className={`${styles.thumb} ${it.cita ? '' : styles.blanco}`} title={it.nombre}>
                      {fotos[it.productoId] ? (
                        <img src={fotos[it.productoId]} alt={it.nombre} className={it.cita ? styles.cover : styles.contain} />
                      ) : (
                        <IconImage width={20} height={20} />
                      )}
                    </div>
                  ))}
                  {propios.length > 3 && <span className="muted" style={{ alignSelf: 'center', fontSize: '0.8125rem' }}>+{propios.length - 3}</span>}
                </div>
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
                  disabled={actualizando === orden.id || (orden.estadoPago !== 'pagada' && orden.estadoPago !== 'por_cobrar') || orden.estadoEntrega === 'cancelada'}
                  onChange={(v) =>
                    v === 'entregada' || v === 'no_asistio'
                      ? setPendiente({ ordenId: orden.id, estado: v as EstadoEntrega, etiqueta: etiquetas[v as EstadoEntrega], porCobrar: orden.estadoPago === 'por_cobrar', total: totalPropio })
                      : cambiarEstado(orden.id, v as EstadoEntrega)
                  }
                  options={[...new Set([...opciones, orden.estadoEntrega])].map((e) => ({
                    value: e,
                    label: etiquetas[e],
                    disabled: bloqueada(e),
                    title: bloqueada(e) ? 'Disponible cuando llegue el día y la hora de la cita' : undefined,
                  }))}
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
        mensaje={
          pendiente?.porCobrar && pendiente.estado === 'entregada'
            ? `Se le avisará al cliente y se dará por cobrado el pago en efectivo de $${pendiente.total.toFixed(2)}. Si te equivocas, podrás cambiar el estado después, pero el aviso ya se habrá enviado.`
            : 'Se le avisará al cliente por correo y en la app. Si te equivocas, podrás cambiar el estado después, pero el aviso ya se habrá enviado.'
        }
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
