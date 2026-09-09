import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import {
  ApiError,
  authApi,
  carritoApi,
  catalogoApi,
  disponibilidadApi,
  ordenesApi,
  reservasApi,
  resenasApi,
  type Orden,
  type Producto,
  type Resena,
  type Reserva,
  type SlotDisponible,
} from '../lib/api'
import { IconImage, IconMinus, IconPlus, IconStar, IconUser } from '../components/icons'
import { Stars } from '../components/Stars'
import { Select } from '../components/Select'
import { MapaLocal } from '../components/MapaLocal'
import { VistosRecientemente } from '../components/VistosRecientemente'
import { formatHora12h } from '../lib/estado'
import { registrarVisto } from '../lib/vistosRecientemente'
import styles from './ProductoDetalle.module.css'

function StarInput({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, color: 'oklch(70% 0.15 75)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}
          aria-label={`${i + 1} estrellas`}
        >
          <IconStar filled={i < valor} width={22} height={22} />
        </button>
      ))}
    </div>
  )
}

export default function ProductoDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { refrescar } = useCart()

  const [producto, setProducto] = useState<Producto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [imagenActiva, setImagenActiva] = useState(0)
  const [vendedorNombre, setVendedorNombre] = useState<string | null>(null)

  const hoy = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(hoy)
  const [slots, setSlots] = useState<SlotDisponible[]>([])
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [reservaActual, setReservaActual] = useState<Reserva | null>(null)
  const [reservando, setReservando] = useState(false)
  const [errorReserva, setErrorReserva] = useState<string | null>(null)

  const [resenas, setResenas] = useState<Resena[]>([])
  const [ordenesElegibles, setOrdenesElegibles] = useState<Orden[]>([])
  const [ordenParaResena, setOrdenParaResena] = useState('')
  const [calificacionNueva, setCalificacionNueva] = useState(0)
  const [comentarioNuevo, setComentarioNuevo] = useState('')
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [errorResena, setErrorResena] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setCargando(true)
    catalogoApi
      .obtener(id)
      .then((p) => {
        setProducto(p)
        setImagenActiva(0)
        setVendedorNombre(null)
        registrarVisto(p._id)
        authApi
          .perfilPublico(p.vendedorId)
          .then((v) => setVendedorNombre(v.nombre))
          .catch(() => setVendedorNombre(null))
      })
      .catch(() => setError('No se encontró la publicación'))
      .finally(() => setCargando(false))
    resenasApi.listar(id).then(setResenas)
  }, [id])

  useEffect(() => {
    if (!id || !usuario) {
      setOrdenesElegibles([])
      return
    }
    ordenesApi.listar().then((ordenes) => {
      const compradas = ordenes.filter((o) => o.estadoPago === 'pagada' && o.items.some((it) => it.productoId === id))
      const yaResenadas = new Set(resenas.filter((r) => r.compradorId === usuario.id).map((r) => r.ordenId))
      const elegibles = compradas.filter((o) => !yaResenadas.has(o.id))
      setOrdenesElegibles(elegibles)
      setOrdenParaResena(elegibles.length === 1 ? elegibles[0].id : '')
    })
  }, [id, usuario, resenas])

  useEffect(() => {
    if (!id || !producto || producto.tipo !== 'servicio' || !producto.disponibilidad) {
      setSlots([])
      return
    }
    setCargandoSlots(true)
    setReservaActual(null)
    disponibilidadApi
      .obtener(id, fecha)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setCargandoSlots(false))
  }, [id, fecha, producto])

  const elegirSlot = async (slot: SlotDisponible) => {
    if (!id) return
    setReservando(true)
    setErrorReserva(null)
    try {
      if (reservaActual) {
        await reservasApi.cancelar(id, reservaActual._id).catch(() => undefined)
      }
      const reserva = await reservasApi.crear(id, fecha, slot.horaInicio)
      setReservaActual(reserva)
    } catch (err) {
      setErrorReserva(err instanceof ApiError ? err.message : 'No se pudo reservar ese horario')
      disponibilidadApi.obtener(id, fecha).then(setSlots)
    } finally {
      setReservando(false)
    }
  }

  const enviarResena = async () => {
    if (!id || !ordenParaResena || calificacionNueva === 0) return
    setEnviandoResena(true)
    setErrorResena(null)
    try {
      const actualizadas = await resenasApi.crear(id, {
        ordenId: ordenParaResena,
        calificacion: calificacionNueva,
        comentario: comentarioNuevo || undefined,
      })
      setResenas(actualizadas)
      setProducto((p) =>
        p
          ? {
              ...p,
              calificacionPromedio: actualizadas.reduce((acc, r) => acc + r.calificacion, 0) / actualizadas.length,
              numResenas: actualizadas.length,
            }
          : p,
      )
      setCalificacionNueva(0)
      setComentarioNuevo('')
      setOrdenParaResena('')
    } catch (err) {
      setErrorResena(err instanceof ApiError ? err.message : 'No se pudo enviar la reseña')
    } finally {
      setEnviandoResena(false)
    }
  }

  if (cargando) {
    return (
      <div className="center-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (error || !producto) {
    return <div className="container empty-state">{error || 'No se encontró la publicación'}</div>
  }

  const esServicio = producto.tipo === 'servicio'
  const sinStock = !esServicio && producto.stock <= 0

  const agregarAlCarrito = async (irACheckout: boolean) => {
    if (!usuario) {
      navigate('/login')
      return
    }
    if (esServicio && !reservaActual) {
      setMensaje('Elige un horario disponible antes de agregar este servicio')
      return
    }
    setAgregando(true)
    setMensaje(null)
    try {
      await carritoApi.agregar(id!, esServicio ? 1 : cantidad, esServicio ? reservaActual!._id : undefined)
      await refrescar()
      if (irACheckout) {
        navigate('/carrito')
      } else {
        setMensaje('Se agregó al carrito.')
      }
    } catch (err) {
      setMensaje(err instanceof ApiError ? err.message : 'No se pudo agregar al carrito')
    } finally {
      setAgregando(false)
    }
  }

  return (
    <div className="container">
      <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
        <span onClick={() => navigate('/catalogo')} style={{ cursor: 'pointer' }}>
          Catálogo
        </span>{' '}
        / {producto.categoria} / {producto.nombre}
      </p>

      <div className={styles.layout}>
        <div className={styles.gallery}>
          <div className={`${styles.mainImage} ${!esServicio ? styles.blanco : ''}`}>
            {producto.imagenes && producto.imagenes.length > 0 ? (
              <img
                src={producto.imagenes[imagenActiva] ?? producto.imagenes[0]}
                alt={producto.nombre}
                className={!esServicio ? styles.contain : styles.cover}
              />
            ) : producto.imagenUrl ? (
              <img src={producto.imagenUrl} alt={producto.nombre} className={!esServicio ? styles.contain : styles.cover} />
            ) : (
              <IconImage width={56} height={56} />
            )}
          </div>
          {producto.imagenes && producto.imagenes.length > 1 && (
            <div className={styles.thumbStrip}>
              {producto.imagenes.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.thumbBtn} ${!esServicio ? styles.blanco : ''} ${idx === imagenActiva ? styles.active : ''}`}
                  onClick={() => setImagenActiva(idx)}
                >
                  <img src={img} alt={`${producto.nombre} ${idx + 1}`} className={!esServicio ? styles.contain : styles.cover} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <span className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>
            {esServicio ? 'Servicio' : 'Producto'}
          </span>
          {producto.marca && <span className={styles.marca}>{producto.marca}</span>}
          <h1 style={{ fontSize: '1.5rem' }}>{producto.nombre}</h1>

          <div className={styles.ratingRow}>
            <Stars valor={producto.calificacionPromedio} />
            <span className="muted" style={{ fontSize: '0.875rem' }}>
              {producto.numResenas > 0 ? `${producto.calificacionPromedio.toFixed(1)} (${producto.numResenas} reseñas)` : 'Sin reseñas aún'}
            </span>
          </div>

          <span className={styles.precio}>${producto.precio.toFixed(2)}</span>

          <div className={`card ${styles.vendorBox}`}>
            <div className={styles.vendorAvatar}>
              <IconUser width={22} height={22} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{vendedorNombre || 'Vendedor verificado'}</p>
              <p className="muted" style={{ fontSize: '0.8125rem' }}>
                {esServicio
                  ? producto.modalidadEntrega === 'domicilio_cliente'
                    ? 'Se presta a domicilio del cliente'
                    : 'Se presta en el local del vendedor'
                  : 'Publicación de producto'}
              </p>
              {esServicio && producto.modalidadEntrega === 'local_vendedor' && producto.direccionLocal && (
                <p className="muted" style={{ fontSize: '0.8125rem' }}>📍 {producto.direccionLocal}</p>
              )}
            </div>
          </div>

          {esServicio && producto.modalidadEntrega === 'local_vendedor' && producto.ubicacion && (
            <MapaLocal lat={producto.ubicacion.lat} lng={producto.ubicacion.lng} altura="12rem" />
          )}

          {!esServicio && (
            <div className={styles.qtyRow}>
              <div className={styles.qtyStepper}>
                <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Restar">
                  <IconMinus width={16} height={16} />
                </button>
                <span>{cantidad}</span>
                <button
                  type="button"
                  onClick={() => setCantidad((c) => Math.min(producto.stock, c + 1))}
                  aria-label="Sumar"
                >
                  <IconPlus width={16} height={16} />
                </button>
              </div>
              <span className="muted" style={{ fontSize: '0.875rem' }}>
                {sinStock ? 'Agotado' : `${producto.stock} disponibles`}
              </span>
            </div>
          )}

          {esServicio && !producto.disponibilidad && (
            <p className="hint-text">Este vendedor todavía no configuró horarios para agendar este servicio.</p>
          )}

          {esServicio && producto.disponibilidad && (
            <div className="field">
              <label htmlFor="fecha-cita">Elige una fecha</label>
              <input
                id="fecha-cita"
                type="date"
                className="input"
                min={hoy}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />

              {cargandoSlots ? (
                <p className="muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Buscando horarios...
                </p>
              ) : slots.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  No hay horarios disponibles ese día. Prueba con otra fecha.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {slots.map((slot) => {
                    const seleccionado = reservaActual?.horaInicio === slot.horaInicio && reservaActual?.fecha === fecha
                    return (
                      <button
                        type="button"
                        key={slot.horaInicio}
                        disabled={reservando}
                        onClick={() => elegirSlot(slot)}
                        style={{
                          minHeight: '2.25rem',
                          padding: '0 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1.5px solid var(--color-border-strong)',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          background: seleccionado ? 'var(--color-text)' : 'var(--color-surface)',
                          color: seleccionado ? '#fff' : 'var(--color-text)',
                        }}
                      >
                        {formatHora12h(slot.horaInicio)}
                      </button>
                    )
                  })}
                </div>
              )}

              {reservaActual && (
                <p className="hint-text" style={{ marginTop: '0.5rem' }}>
                  Horario retenido: {fecha} a las {formatHora12h(reservaActual.horaInicio)}. Tienes unos minutos para completar la compra.
                </p>
              )}
              {errorReserva && <p className="error-text">{errorReserva}</p>}
            </div>
          )}

          <div className={styles.actionsRow}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={sinStock || agregando || (esServicio && !reservaActual)}
              onClick={() => agregarAlCarrito(false)}
            >
              {agregando ? 'Agregando...' : 'Agregar al carrito'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={sinStock || agregando || (esServicio && !reservaActual)}
              onClick={() => agregarAlCarrito(true)}
            >
              Comprar ahora
            </button>
          </div>

          {mensaje && <p className={mensaje.includes('agregó') ? 'hint-text' : 'error-text'}>{mensaje}</p>}
        </div>
      </div>

      <div className={styles.section}>
        <h2>Descripción</h2>
        <p style={{ maxWidth: '65ch' }}>{producto.descripcion}</p>
      </div>

      <div className={styles.section}>
        <h2>Detalles</h2>
        <dl className={styles.specs}>
          {producto.marca && (
            <div className={styles.specRow}>
              <dt>Marca</dt>
              <dd>{producto.marca}</dd>
            </div>
          )}
          <div className={styles.specRow}>
            <dt>Categoría</dt>
            <dd>{producto.categoria}</dd>
          </div>
          <div className={styles.specRow}>
            <dt>Tipo</dt>
            <dd>{esServicio ? 'Servicio' : 'Producto'}</dd>
          </div>
          {esServicio ? (
            <>
              <div className={styles.specRow}>
                <dt>Modalidad</dt>
                <dd>{producto.modalidadEntrega === 'domicilio_cliente' ? 'A domicilio del cliente' : 'En el local del vendedor'}</dd>
              </div>
              {producto.modalidadEntrega === 'local_vendedor' && producto.direccionLocal && (
                <div className={styles.specRow}>
                  <dt>Dirección</dt>
                  <dd>{producto.direccionLocal}</dd>
                </div>
              )}
              {producto.disponibilidad && (
                <div className={styles.specRow}>
                  <dt>Duración de la cita</dt>
                  <dd>{producto.disponibilidad.duracionMinutos} min</dd>
                </div>
              )}
            </>
          ) : (
            <div className={styles.specRow}>
              <dt>Disponibilidad</dt>
              <dd>{sinStock ? 'Agotado' : `${producto.stock} en stock`}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className={styles.section}>
        <h2>Reseñas {producto.numResenas > 0 && `(${producto.numResenas})`}</h2>

        {ordenesElegibles.length > 0 && (
          <div className="card card-pad stack" style={{ maxWidth: '32rem', marginBottom: '1.5rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Compraste este producto — déjanos tu reseña</p>
            {ordenesElegibles.length > 1 && (
              <div className="field">
                <label htmlFor="orden-resena">Orden</label>
                <Select
                  id="orden-resena"
                  value={ordenParaResena}
                  onChange={setOrdenParaResena}
                  placeholder="Selecciona una orden"
                  options={ordenesElegibles.map((o) => ({
                    value: o.id,
                    label: `#${o.id.slice(0, 8)} — ${new Date(o.creadoEn).toLocaleDateString()}`,
                  }))}
                />
              </div>
            )}
            <StarInput valor={calificacionNueva} onChange={setCalificacionNueva} />
            <textarea
              className="input"
              placeholder="Comentario (opcional)"
              value={comentarioNuevo}
              onChange={(e) => setComentarioNuevo(e.target.value)}
              rows={3}
            />
            {errorResena && <p className="error-text">{errorResena}</p>}
            <button
              type="button"
              className="btn btn-primary"
              disabled={enviandoResena || calificacionNueva === 0 || !ordenParaResena}
              onClick={enviarResena}
            >
              {enviandoResena ? 'Enviando...' : 'Publicar reseña'}
            </button>
          </div>
        )}

        {resenas.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.875rem' }}>
            Todavía no hay reseñas para esta publicación.
          </p>
        ) : (
          <div className="stack" style={{ maxWidth: '40rem' }}>
            {resenas.map((r) => (
              <div key={r._id} className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <Stars valor={r.calificacion} />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    {new Date(r.creadoEn).toLocaleDateString()}
                  </span>
                </div>
                <p className="muted" style={{ fontSize: '0.75rem', marginBottom: r.comentario ? '0.375rem' : 0 }}>
                  {r.compradorEmail}
                </p>
                {r.comentario && <p style={{ fontSize: '0.875rem' }}>{r.comentario}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <VistosRecientemente excluirId={producto._id} />
    </div>
  )
}
