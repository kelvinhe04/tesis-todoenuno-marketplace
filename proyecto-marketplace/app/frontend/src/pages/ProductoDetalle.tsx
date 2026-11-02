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
  type SlotDisponible,
} from '../lib/api'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconImage,
  IconMinus,
  IconPlus,
  IconSearch,
  IconStar,
  IconUser,
} from '../components/icons'
import { Stars } from '../components/Stars'
import { Select } from '../components/Select'
import { MapaLocal } from '../components/MapaLocal'
import { VistosRecientemente } from '../components/VistosRecientemente'
import { SelectorFecha } from '../components/SelectorFecha'
import { StockBadge } from '../components/StockBadge'
import { urlGoogleMaps } from '../lib/ubicacion'
import {
  ahoraPanama,
  formatFecha,
  formatHora12h,
  NOMBRES_DIA,
  primeraFechaDisponible,
  quedanHorariosHoy,
  sumarDiasFecha,
  textoStock,
} from '../lib/estado'
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

// "lunes y miércoles: 9:00 a. m. – 12:00 p. m." (agrupa los días que comparten horario)
function resumenAtencion(reglas: { diaSemana: number; horaInicio: string; horaFin: string }[]): string[] {
  const grupos = new Map<string, number[]>()
  for (const r of reglas) {
    const clave = `${formatHora12h(r.horaInicio)} – ${formatHora12h(r.horaFin)}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), r.diaSemana])
  }
  return [...grupos.entries()].map(([horario, dias]) => {
    const ordenados = [...new Set(dias)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => NOMBRES_DIA[d])
    const lista = ordenados.length > 1 ? `${ordenados.slice(0, -1).join(', ')} y ${ordenados[ordenados.length - 1]}` : ordenados[0]
    return `${lista[0].toUpperCase()}${lista.slice(1)}: ${horario}`
  })
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
  const [zoomAbierto, setZoomAbierto] = useState(false)
  const [vendedorNombre, setVendedorNombre] = useState<string | null>(null)

  const ahora = ahoraPanama()
  const hoy = ahora.fecha
  const [fecha, setFecha] = useState(hoy)
  const [slots, setSlots] = useState<SlotDisponible[]>([])
  const [cargandoSlots, setCargandoSlots] = useState(false)
  // Solo se ELIGE el horario; se retiene (15 min) recién al agregar al carrito o comprar
  const [slotElegido, setSlotElegido] = useState<string | null>(null)
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
        // Para servicios, arrancar en el primer día con atención (no en un día sin horarios)
        if (p.tipo === 'servicio' && p.disponibilidad?.reglas.length) {
          setFecha(primeraFechaDisponible(p.disponibilidad.reglas, p.disponibilidad.duracionMinutos))
        }
        setImagenActiva(0)
        setZoomAbierto(false)
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
    setSlotElegido(null)
    disponibilidadApi
      .obtener(id, fecha)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setCargandoSlots(false))
  }, [id, fecha, producto])

  useEffect(() => {
    if (!zoomAbierto) return
    const total = producto?.imagenes?.length || (producto?.imagenUrl ? 1 : 0)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomAbierto(false)
      if (total > 1 && e.key === 'ArrowRight') setImagenActiva((i) => (i + 1) % total)
      if (total > 1 && e.key === 'ArrowLeft') setImagenActiva((i) => (i - 1 + total) % total)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomAbierto, producto])

  const elegirSlot = (slot: SlotDisponible) => {
    setErrorReserva(null)
    setSlotElegido(slot.horaInicio)
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
  const imagenes =
    producto.imagenes && producto.imagenes.length > 0
      ? producto.imagenes
      : producto.imagenUrl
        ? [producto.imagenUrl]
        : []
  const tieneImagen = imagenes.length > 0

  const agregarAlCarrito = async (irACheckout: boolean) => {
    if (!usuario) {
      navigate('/login')
      return
    }
    if (esServicio && !slotElegido) {
      setMensaje('Elige un horario disponible antes de agregar este servicio')
      return
    }
    setAgregando(true)
    setMensaje(null)
    try {
      let reservaId: string | undefined
      if (esServicio) {
        // Aquí recién se retiene el horario; si alguien lo tomó mientras tanto, se avisa y se refresca la lista
        try {
          reservaId = (await reservasApi.crear(id!, fecha, slotElegido!))._id
        } catch (err) {
          setMensaje(err instanceof ApiError ? err.message : 'No se pudo reservar ese horario')
          setSlotElegido(null)
          disponibilidadApi.obtener(id!, fecha).then(setSlots)
          return
        }
      }
      try {
        await carritoApi.agregar(id!, esServicio ? 1 : cantidad, reservaId)
      } catch (err) {
        if (reservaId) await reservasApi.cancelar(id!, reservaId).catch(() => undefined)
        throw err
      }
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
          <div
            className={`${styles.mainImage} ${!esServicio ? `${styles.blanco} ${styles.padded}` : ''} ${tieneImagen ? styles.zoomable : ''}`}
            onClick={() => tieneImagen && setZoomAbierto(true)}
          >
            {tieneImagen ? (
              <>
                {/* Todas las fotos van apiladas y se hace fundido entre ellas al cambiar (suave, sin parpadeo) */}
                <div className={styles.capas}>
                  {imagenes.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={idx === imagenActiva ? producto.nombre : ''}
                      aria-hidden={idx !== imagenActiva}
                      className={`${!esServicio ? styles.contain : styles.cover} ${styles.capa} ${idx === imagenActiva ? styles.capaActiva : ''}`}
                    />
                  ))}
                </div>
                <span className={styles.zoomHint}>
                  <IconSearch width={16} height={16} />
                </span>
              </>
            ) : (
              <IconImage width={56} height={56} />
            )}
          </div>
          {imagenes.length > 1 && (
            <div className={styles.thumbStrip}>
              {imagenes.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.thumbBtn} ${!esServicio ? `${styles.blanco} ${styles.padded}` : ''} ${idx === imagenActiva ? styles.active : ''}`}
                  onMouseEnter={() => setImagenActiva(idx)}
                  onFocus={() => setImagenActiva(idx)}
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
            <div>
              <MapaLocal lat={producto.ubicacion.lat} lng={producto.ubicacion.lng} altura="12rem" />
              <a
                href={urlGoogleMaps(producto.ubicacion)}
                target="_blank"
                rel="noopener noreferrer"
                className="hint-text"
                style={{ display: 'inline-block', marginTop: '0.375rem', fontWeight: 600 }}
              >
                Abrir en Google Maps ↗
              </a>
            </div>
          )}

          {!esServicio && (
            <div className={styles.qtyRow}>
              <div className={styles.qtyStepper}>
                <button
                  type="button"
                  disabled={cantidad <= 1}
                  onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                  aria-label="Restar"
                >
                  <IconMinus width={16} height={16} />
                </button>
                <span>{cantidad}</span>
                <button
                  type="button"
                  disabled={cantidad >= producto.stock}
                  onClick={() => setCantidad((c) => Math.min(producto.stock, c + 1))}
                  aria-label="Sumar"
                >
                  <IconPlus width={16} height={16} />
                </button>
              </div>
              <StockBadge stock={producto.stock} />
            </div>
          )}

          {esServicio && !producto.disponibilidad && (
            <p className="hint-text">Este vendedor todavía no configuró horarios para agendar este servicio.</p>
          )}

          {esServicio && producto.disponibilidad && (
            <div className="field">
              <label>Elige una fecha</label>
              <p className="muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Atiende: {resumenAtencion(producto.disponibilidad.reglas).join(' · ')}
              </p>
              <SelectorFecha
                key={id}
                value={fecha}
                min={
                  quedanHorariosHoy(producto.disponibilidad.reglas, producto.disponibilidad.duracionMinutos, ahora)
                    ? hoy
                    : sumarDiasFecha(hoy, 1)
                }
                diasPermitidos={new Set(producto.disponibilidad.reglas.map((r) => r.diaSemana))}
                onChange={setFecha}
              />
              <p style={{ fontSize: '0.875rem', fontWeight: 700, marginTop: '0.5rem' }}>Fecha elegida: {formatFecha(fecha)}</p>

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
                    const seleccionado = slotElegido === slot.horaInicio
                    return (
                      <button
                        type="button"
                        key={slot.horaInicio}
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

              {slotElegido && (
                <p className="hint-text" style={{ marginTop: '0.5rem' }}>
                  Horario elegido: {formatFecha(fecha)} a las {formatHora12h(slotElegido).replace(/\.$/, '')}. Se reserva al continuar y lo retenemos unos minutos para que completes el pago.
                </p>
              )}
              {errorReserva && <p className="error-text">{errorReserva}</p>}
            </div>
          )}

          <div className={styles.actionsRow}>
            {esServicio ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={agregando || !slotElegido}
                onClick={() => agregarAlCarrito(true)}
              >
                {agregando ? 'Reservando...' : 'Reservar cita y pagar'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={sinStock || agregando}
                  onClick={() => agregarAlCarrito(false)}
                >
                  {agregando ? 'Agregando...' : 'Agregar al carrito'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={sinStock || agregando}
                  onClick={() => agregarAlCarrito(true)}
                >
                  Comprar ahora
                </button>
              </>
            )}
          </div>

          {mensaje && <p className={mensaje.includes('agregó') ? 'hint-text' : 'error-text'}>{mensaje}</p>}
        </div>
      </div>

      {zoomAbierto && tieneImagen && (
        <div className={styles.zoomOverlay} onClick={() => setZoomAbierto(false)}>
          <button type="button" className={styles.zoomClose} onClick={() => setZoomAbierto(false)} aria-label="Cerrar">
            <IconClose width={20} height={20} />
          </button>
          {imagenes.length > 1 && (
            <button
              type="button"
              className={`${styles.zoomNav} ${styles.zoomNavLeft}`}
              onClick={(e) => {
                e.stopPropagation()
                setImagenActiva((i) => (i - 1 + imagenes.length) % imagenes.length)
              }}
              aria-label="Imagen anterior"
            >
              <IconChevronLeft width={22} height={22} />
            </button>
          )}
          <img
            src={imagenes[imagenActiva] ?? imagenes[0]}
            alt={producto.nombre}
            className={styles.zoomImg}
            onClick={(e) => e.stopPropagation()}
          />
          {imagenes.length > 1 && (
            <button
              type="button"
              className={`${styles.zoomNav} ${styles.zoomNavRight}`}
              onClick={(e) => {
                e.stopPropagation()
                setImagenActiva((i) => (i + 1) % imagenes.length)
              }}
              aria-label="Imagen siguiente"
            >
              <IconChevronRight width={22} height={22} />
            </button>
          )}
        </div>
      )}

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
              <dd>{textoStock(producto.stock)}</dd>
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
