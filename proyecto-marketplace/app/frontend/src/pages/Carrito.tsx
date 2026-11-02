import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ApiError, carritoApi, type Carrito as CarritoType } from '../lib/api'
import { IconImage, IconMinus, IconPlus, IconTrash } from '../components/icons'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatFecha, formatHora12h } from '../lib/estado'
import styles from './Carrito.module.css'

// Un servicio sin cita vigente: la reserva venció (catalogo borra los holds vencidos) o fue cancelada
function horarioVencido(item: CarritoType['items'][number]): boolean {
  if (item.tipo !== 'servicio') return false
  if (!item.cita || item.cita.estado === 'cancelada') return true
  return item.cita.estado === 'retenida' && !!item.cita.expiraEn && new Date(item.cita.expiraEn).getTime() <= Date.now()
}

// Producto cuyo stock bajó por debajo de la cantidad que hay en el carrito (otro comprador se lo llevó)
function faltaStock(item: CarritoType['items'][number]): boolean {
  return item.tipo === 'producto' && item.stock !== undefined && item.cantidad > item.stock
}

function HorarioVencido({ productoId }: { productoId: string }) {
  return (
    <span style={{ fontSize: '0.8125rem', color: 'var(--color-danger)' }}>
      Horario vencido ·{' '}
      <Link to={`/productos/${productoId}`} style={{ textDecoration: 'underline' }}>
        elegir otro
      </Link>
    </span>
  )
}

// Cuenta regresiva de la retención (15 min) del horario de una cita
function RetencionCita({ expiraEn, productoId }: { expiraEn: string; productoId: string }) {
  const fin = new Date(expiraEn).getTime()
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const restantes = Math.max(0, Math.floor((fin - ahora) / 1000))
  if (restantes === 0) return <HorarioVencido productoId={productoId} />
  return (
    <span
      className="muted"
      style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', color: restantes < 120 ? 'var(--color-danger)' : undefined }}
    >
      Retenido {Math.floor(restantes / 60)}:{String(restantes % 60).padStart(2, '0')}
    </span>
  )
}

export default function Carrito() {
  const navigate = useNavigate()
  const { refrescar } = useCart()
  const [carrito, setCarrito] = useState<CarritoType | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actualizando, setActualizando] = useState<string | null>(null)
  const [itemAEliminar, setItemAEliminar] = useState<{ productoId: string; nombre: string } | null>(null)
  // Ítems que el comprador decidió NO pagar ahora (se quedan en el carrito). Por defecto se paga todo lo válido.
  const [omitidos, setOmitidos] = useState<Set<string>>(new Set())

  const conProblema = (it: CarritoType['items'][number]) => horarioVencido(it) || faltaStock(it)
  const seleccionado = (it: CarritoType['items'][number]) => !omitidos.has(it.productoId) && !conProblema(it)
  const alternar = (id: string) =>
    setOmitidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const cargar = () => {
    setCargando(true)
    carritoApi
      .obtener()
      .then(setCarrito)
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const cambiarCantidad = async (productoId: string, cantidad: number) => {
    setError(null)
    setActualizando(productoId)
    try {
      if (cantidad <= 0) {
        setCarrito(await carritoApi.eliminarItem(productoId))
      } else {
        setCarrito(await carritoApi.actualizar(productoId, cantidad))
      }
      await refrescar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el carrito')
    } finally {
      setActualizando(null)
    }
  }

  const eliminar = async (productoId: string) => {
    setActualizando(productoId)
    try {
      setCarrito(await carritoApi.eliminarItem(productoId))
      await refrescar()
    } finally {
      setActualizando(null)
      setItemAEliminar(null)
    }
  }

  if (cargando) {
    return (
      <div className="center-loading">
        <div className="spinner" />
      </div>
    )
  }

  const subtotalSel = Number(
    (carrito?.items.filter(seleccionado).reduce((acc, it) => acc + it.subtotal, 0) ?? 0).toFixed(2),
  )

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.375rem', marginBottom: '1.25rem' }}>Carrito de compras</h1>

      {!carrito || carrito.items.length === 0 ? (
        <div className="empty-state">
          <p>Tu carrito está vacío.</p>
          <Link to="/catalogo" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.items}>
            {error && <p className="error-text">{error}</p>}
            {carrito.items.map((item) => (
              <div key={item.productoId} className={`card ${styles.item}`}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={seleccionado(item)}
                  disabled={conProblema(item)}
                  onChange={() => alternar(item.productoId)}
                  aria-label={`Pagar ${item.nombre}`}
                  title={conProblema(item) ? 'No disponible: no se puede pagar ahora' : 'Incluir en el pago'}
                />
                <Link to={`/productos/${item.productoId}`} className={styles.itemLink}>
                  <div className={`${styles.thumb} ${item.tipo === 'producto' ? styles.blanco : ''}`}>
                    {item.imagenUrl ? (
                      <img
                        src={item.imagenUrl}
                        alt={item.nombre}
                        className={item.tipo === 'producto' ? styles.contain : styles.cover}
                      />
                    ) : (
                      <IconImage width={24} height={24} />
                    )}
                  </div>
                  <div className={styles.itemInfo}>
                    <p style={{ fontWeight: 700 }} title={item.nombre}>
                      {item.nombre}
                    </p>
                    <p className="muted" style={{ fontSize: '0.875rem' }}>
                      ${item.precio.toFixed(2)} c/u
                    </p>
                    {faltaStock(item) && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                        {item.stock === 0 ? 'Agotado' : `Solo quedan ${item.stock}`}
                      </p>
                    )}
                  </div>
                </Link>
                {item.tipo === 'servicio' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>
                      {item.cita ? `${formatFecha(item.cita.fecha)} · ${formatHora12h(item.cita.horaInicio)}` : 'Sin horario'}
                    </span>
                    {horarioVencido(item) ? (
                      <HorarioVencido productoId={item.productoId} />
                    ) : (
                      item.cita?.estado === 'retenida' &&
                      item.cita.expiraEn && <RetencionCita expiraEn={item.cita.expiraEn} productoId={item.productoId} />
                    )}
                  </div>
                ) : (
                  <div className={styles.qtyStepper}>
                    <button
                      type="button"
                      disabled={actualizando === item.productoId}
                      onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)}
                      aria-label="Restar"
                    >
                      <IconMinus width={14} height={14} />
                    </button>
                    <span>{item.cantidad}</span>
                    <button
                      type="button"
                      disabled={actualizando === item.productoId || (item.stock !== undefined && item.cantidad >= item.stock)}
                      onClick={() => cambiarCantidad(item.productoId, item.cantidad + 1)}
                      aria-label="Sumar"
                    >
                      <IconPlus width={14} height={14} />
                    </button>
                  </div>
                )}
                <span style={{ fontWeight: 800, width: '4.5rem', textAlign: 'right' }}>${item.subtotal.toFixed(2)}</span>
                <button
                  type="button"
                  className={styles.qtyStepper}
                  style={{ border: 'none', color: 'var(--color-danger)' }}
                  onClick={() => setItemAEliminar({ productoId: item.productoId, nombre: item.nombre })}
                  aria-label="Eliminar del carrito"
                  disabled={actualizando === item.productoId}
                >
                  <IconTrash width={18} height={18} />
                </button>
              </div>
            ))}
          </div>

          <div className={`card ${styles.summary}`}>
            <h2 style={{ fontSize: '1.0625rem' }}>Resumen</h2>
            <div className={styles.summaryRow}>
              <span className="muted">
                Subtotal ({carrito.items.filter(seleccionado).length} de {carrito.items.length})
              </span>
              <span>${subtotalSel.toFixed(2)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className="muted">Envío</span>
              <span>${carrito.envio.toFixed(2)}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>${(subtotalSel + carrito.envio).toFixed(2)}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={carrito.items.filter(seleccionado).length === 0}
              onClick={async () => {
                setError(null)
                // Se relee el carrito: el stock o los horarios pudieron cambiar mientras estaba abierto
                const fresco = await carritoApi.obtener().catch(() => carrito)
                setCarrito(fresco)
                const ids = fresco.items.filter((it) => !omitidos.has(it.productoId) && !conProblema(it)).map((it) => it.productoId)
                if (ids.length === 0) {
                  setError('No hay productos disponibles para pagar. Revisa tu selección.')
                  return
                }
                navigate(`/checkout?items=${ids.join(',')}`)
              }}
            >
              Proceder al pago
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        abierto={itemAEliminar !== null}
        titulo="Eliminar del carrito"
        mensaje={`¿Seguro que quieres quitar "${itemAEliminar?.nombre}" del carrito?`}
        textoConfirmar="Eliminar"
        peligro
        procesando={actualizando === itemAEliminar?.productoId}
        onConfirmar={() => itemAEliminar && eliminar(itemAEliminar.productoId)}
        onCancelar={() => setItemAEliminar(null)}
      />
    </div>
  )
}
