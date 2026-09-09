import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ApiError, carritoApi, type Carrito as CarritoType } from '../lib/api'
import { IconImage, IconMinus, IconPlus, IconTrash } from '../components/icons'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatHora12h } from '../lib/estado'
import styles from './Carrito.module.css'

export default function Carrito() {
  const navigate = useNavigate()
  const { refrescar } = useCart()
  const [carrito, setCarrito] = useState<CarritoType | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actualizando, setActualizando] = useState<string | null>(null)
  const [itemAEliminar, setItemAEliminar] = useState<{ productoId: string; nombre: string } | null>(null)

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
                  <p style={{ fontWeight: 700 }}>{item.nombre}</p>
                  <p className="muted" style={{ fontSize: '0.875rem' }}>
                    ${item.precio.toFixed(2)} c/u
                  </p>
                </div>
                {item.tipo === 'servicio' ? (
                  <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>
                    {item.cita ? `${item.cita.fecha} · ${formatHora12h(item.cita.horaInicio)}` : 'Cita agendada'}
                  </span>
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
                      disabled={actualizando === item.productoId}
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
            <Link to="/catalogo" className="hint-text" style={{ textDecoration: 'none' }}>
              ‹ Seguir comprando
            </Link>
          </div>

          <div className={`card ${styles.summary}`}>
            <h2 style={{ fontSize: '1.0625rem' }}>Resumen</h2>
            <div className={styles.summaryRow}>
              <span className="muted">Subtotal</span>
              <span>${carrito.subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className="muted">Envío</span>
              <span>${carrito.envio.toFixed(2)}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>${carrito.total.toFixed(2)}</span>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/checkout')}>
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
