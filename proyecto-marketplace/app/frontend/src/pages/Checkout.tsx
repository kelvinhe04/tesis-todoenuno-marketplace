import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import {
  ApiError,
  carritoApi,
  guardadosApi,
  ordenesApi,
  pagosApi,
  type Carrito,
  type DireccionGuardada,
  type TarjetaGuardada,
} from '../lib/api'
import { PantallaConfirmando, PantallaResultado } from '../components/PantallasPago'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatFecha, formatHora12h } from '../lib/estado'
import {
  estaVencida,
  formatearNumeroTarjeta,
  formatearTelefono,
  formatearVencimiento,
  marcaTarjeta,
  validarCvv,
  formatearCvv,
  validarNumeroTarjeta,
  validarVencimiento,
} from '../lib/formatos'
import styles from './Checkout.module.css'
import guardados from '../components/Guardados.module.css'

// Envío y pago son un solo formulario: al confirmar se crea la orden y se cobra de una vez
const PASOS = ['Carrito', 'Envío y pago', 'Confirmación']

export default function Checkout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ordenParam = searchParams.get('orden') // entrada desde "Mis órdenes" -> Reintentar pago
  // Ítems del carrito que se van a pagar (el resto se queda en el carrito); sin parámetro = todo
  const itemsParam = searchParams.get('items')
  const idsSeleccionados = itemsParam ? itemsParam.split(',').filter(Boolean) : null
  const { refrescar } = useCart()

  const [carrito, setCarrito] = useState<Carrito | null>(null)
  const [cargando, setCargando] = useState(true)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')

  const [metodo, setMetodo] = useState<'tarjeta' | 'paypal' | 'payu' | 'efectivo'>('tarjeta')
  const [numeroTarjeta, setNumeroTarjeta] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [cvv, setCvv] = useState('')

  const [pasoActual, setPasoActual] = useState(2)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ aprobado: boolean; motivo?: string; enLugar?: boolean } | null>(null)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [payuActivo, setPayuActivo] = useState(false) // PayU Latam sandbox configurado en el servidor
  const capturaIniciada = useRef(false)
  const [confirmandoPaypal, setConfirmandoPaypal] = useState(() => searchParams.get('paypal') === 'ok' && !!searchParams.get('token'))

  // Si el pago se rechaza la orden ya existe: el siguiente intento la reutiliza (no crea otra ni pide la dirección de nuevo)
  const [ordenReintento, setOrdenReintento] = useState<string | null>(ordenParam)
  const [direccionOrden, setDireccionOrden] = useState<{ nombre: string; telefono: string; direccion: string } | null>(null)

  // Direcciones y tarjetas guardadas en Mi perfil ('nueva' = escribir otra)
  const [dirGuardadas, setDirGuardadas] = useState<DireccionGuardada[]>([])
  const [tarjetasGuardadas, setTarjetasGuardadas] = useState<TarjetaGuardada[]>([])
  const [dirElegida, setDirElegida] = useState('nueva')
  const [tarjetaElegida, setTarjetaElegida] = useState('nueva')
  const [guardarDireccion, setGuardarDireccion] = useState(false)
  const [guardarTarjeta, setGuardarTarjeta] = useState(false)

  // Qué necesita el pedido según lo que hay en el carrito: los productos y los servicios a domicilio
  // necesitan una dirección del cliente; un servicio en el local del vendedor no (el cliente va allá).
  const itemsCarrito = carrito?.items ?? []
  const hayProductos = itemsCarrito.some((it) => it.tipo === 'producto')
  const serviciosLocal = itemsCarrito.filter((it) => it.tipo === 'servicio' && it.modalidadEntrega === 'local_vendedor')
  const hayDomicilio = itemsCarrito.some((it) => it.tipo === 'servicio' && it.modalidadEntrega !== 'local_vendedor')
  const soloLocal = itemsCarrito.length > 0 && !hayProductos && !hayDomicilio
  const dirSel = soloLocal ? undefined : dirGuardadas.find((d) => d.id === dirElegida)
  // Pago en el lugar (efectivo): solo cuando TODO el pedido son servicios
  const permiteEfectivo = itemsCarrito.length > 0 && !hayProductos
  const etiquetaEfectivo = soloLocal ? 'Pagar en el local' : serviciosLocal.length === 0 ? 'Pagar al llegar' : 'Pagar en el lugar'
  const cuandoPaga = soloLocal ? 'cuando llegues al local' : serviciosLocal.length === 0 ? 'cuando el profesional llegue a tu domicilio' : 'en el lugar de cada cita'
  // Con servicios, el pago en el lugar es la opción por defecto (no tiene sentido pagar por adelantado a la fuerza)
  const efectivoPorDefecto = useRef(false)
  useEffect(() => {
    if (permiteEfectivo && !ordenParam && !efectivoPorDefecto.current) {
      efectivoPorDefecto.current = true
      setMetodo('efectivo')
    }
  }, [permiteEfectivo, ordenParam])
  const tarjetaSel = tarjetasGuardadas.find((t) => t.id === tarjetaElegida)

  useEffect(() => {
    pagosApi
      .config()
      .then((c) => {
        setPayuActivo(c.payu === 'sandbox')
      })
      .catch(() => undefined)
  }, [])

  // Regreso desde PayPal (?orden=...&paypal=ok&token=...): se captura el pago y se muestra el resultado
  useEffect(() => {
    const retorno = searchParams.get('paypal')
    const paypalOrderId = searchParams.get('token')
    if (!ordenParam || !retorno || capturaIniciada.current) return
    capturaIniciada.current = true
    if (retorno === 'cancelado') {
      setError('Cancelaste el pago en PayPal. Tu orden sigue pendiente: puedes intentarlo de nuevo.')
      return
    }
    if (!paypalOrderId) return
    setProcesando(true)
    const pausa = new Promise((r) => setTimeout(r, 1100)) // que "Confirmando…" se alcance a ver
    pagosApi
      .paypalCapturar(ordenParam, paypalOrderId)
      .then(async (pago) => {
        await pausa
        if (pago.estado === 'aprobado') {
          setPasoActual(3)
          setResultado({ aprobado: true })
        } else {
          setMetodo('paypal')
          setError(`Pago rechazado: ${pago.motivoRechazo || 'PayPal no aprobó el pago'}. Puedes intentarlo de nuevo.`)
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el pago con PayPal'))
      .finally(() => {
        setProcesando(false)
        setConfirmandoPaypal(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // La predeterminada (o la más reciente) llega ya elegida: se puede pagar sin escribir nada
    guardadosApi
      .direcciones()
      .then((lista) => {
        setDirGuardadas(lista)
        const elegida = lista.find((d) => d.predeterminada) ?? lista[0]
        if (elegida) setDirElegida(elegida.id)
      })
      .catch(() => undefined)
    guardadosApi
      .tarjetas()
      .then((lista) => {
        setTarjetasGuardadas(lista)
        const vigentes = lista.filter((t) => !estaVencida(t.vencimiento))
        const elegida = vigentes.find((t) => t.predeterminada) ?? vigentes[0]
        if (elegida) setTarjetaElegida(elegida.id)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (ordenParam) {
      ordenesApi
        .obtener(ordenParam)
        .then((o) => {
          if (o.estadoPago !== 'pendiente' && o.estadoPago !== 'rechazada') {
            navigate('/ordenes')
            return
          }
          setDireccionOrden(o.direccion)
          setCarrito({ items: o.items, subtotal: o.subtotal, envio: o.envio, total: o.total } as unknown as Carrito)
        })
        .catch(() => navigate('/ordenes'))
        .finally(() => setCargando(false))
      return
    }
    carritoApi
      .obtener()
      .then((c) => {
        const items = idsSeleccionados ? c.items.filter((it) => idsSeleccionados.includes(it.productoId)) : c.items
        const subtotal = Number(items.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2))
        setCarrito({ items, subtotal, envio: c.envio, total: Number((subtotal + c.envio).toFixed(2)) })
        if (items.length === 0) navigate('/carrito')
      })
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, ordenParam, itemsParam])

  // Cuenta regresiva de la retención de los horarios de citas (vence la primera reserva retenida)
  const vencimientoCita = carrito?.items
    .filter((it) => it.cita?.estado === 'retenida' && it.cita.expiraEn)
    .map((it) => new Date(it.cita!.expiraEn!).getTime())
    .reduce<number | null>((min, t) => (min === null || t < min ? t : min), null)
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!vencimientoCita) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [vencimientoCita])
  const segundosRestantes = vencimientoCita ? Math.max(0, Math.floor((vencimientoCita - ahora) / 1000)) : null
  const citaVencida = segundosRestantes === 0

  // Si el tiempo se acaba con el modal de confirmación abierto, se cierra: ya no se puede pagar
  useEffect(() => {
    if (citaVencida) setMostrarConfirmacion(false)
  }, [citaVencida])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (citaVencida) {
      setError('Tu horario ya no está retenido. Vuelve al carrito y elige un horario de nuevo.')
      return
    }
    if (!ordenReintento && !dirSel && telefono.replace(/\D/g, '').length < 7) {
      setError('El teléfono debe tener 7 u 8 dígitos')
      return
    }
    // Validar la tarjeta ANTES de crear la orden: crearla vacía el carrito, y si el pago
    // falla después queda una orden pendiente y el carrito vacío.
    if (metodo === 'tarjeta') {
      // Con una tarjeta guardada solo se pide el CVV (el número completo nunca se guarda)
      if (!tarjetaSel) {
        const errorNumero = validarNumeroTarjeta(numeroTarjeta)
        if (errorNumero) {
          setError(errorNumero)
          return
        }
        const errorVencimiento = validarVencimiento(vencimiento)
        if (errorVencimiento) {
          setError(errorVencimiento)
          return
        }
      }
      const errorCvv = validarCvv(cvv, tarjetaSel ? tarjetaSel.marca : marcaTarjeta(numeroTarjeta))
      if (errorCvv) {
        setError(errorCvv)
        return
      }
    }
    setMostrarConfirmacion(true)
  }

  // Datos de envío efectivos: la dirección guardada elegida o lo escrito en el formulario
  const envio =
    ordenReintento && direccionOrden
      ? direccionOrden
      : dirSel
        ? { nombre: dirSel.nombre, telefono: dirSel.telefono, direccion: dirSel.direccion }
        : soloLocal
          ? { nombre, telefono, direccion: `Cita en el local del vendedor: ${serviciosLocal.map((it) => it.direccionLocal).filter(Boolean).join(' · ') || 'ver detalle del servicio'}` }
          : { nombre, telefono, direccion }

  const detalleLocales = (
    <div className={styles.localLista}>
      {serviciosLocal.map((it) => (
        <div key={it.productoId} className={styles.localItem}>
          <strong>{it.nombre}</strong>
          {it.cita && (
            <span>
              {formatFecha(it.cita.fecha)} · {formatHora12h(it.cita.horaInicio)}
            </span>
          )}
          <span className="muted">{it.direccionLocal ?? 'Dirección en el detalle del servicio'}</span>
        </div>
      ))}
    </div>
  )

  const tituloDireccion = hayProductos ? 'Dirección de entrega' : 'Dirección del servicio'
  const notaDireccion = hayProductos
    ? hayDomicilio
      ? 'Se usa para enviar tus productos y para los servicios a domicilio.'
      : serviciosLocal.length > 0
        ? 'Se usa para enviar tus productos. Tus servicios en el local no la necesitan: se prestan en la dirección del vendedor.'
        : null
    : 'El profesional irá a esta dirección en la fecha y hora de tu cita.'

  const confirmarYPagar = async () => {
    setProcesando(true)
    try {
      let ordenId: string
      if (ordenReintento) {
        // Reintento: se reabre la misma orden (vuelve a retener los horarios de sus citas)
        await ordenesApi.reabrir(ordenReintento)
        ordenId = ordenReintento
      } else {
        const orden = await ordenesApi.crear(envio, idsSeleccionados ?? undefined)
        ordenId = orden.id
        setOrdenReintento(orden.id)
        setDireccionOrden(envio)
        await refrescar()
        // Guardar la dirección nueva para próximas compras (si lo pidió); no bloquea la compra si falla
        if (!soloLocal && !dirSel && guardarDireccion) await guardadosApi.crearDireccion(envio).catch(() => undefined)
      }
      if (metodo === 'efectivo') {
        await ordenesApi.pagarEnLugar(ordenId)
        setPasoActual(3)
        setResultado({ aprobado: true, enLugar: true })
        return
      }
      if (metodo === 'payu') {
        const payu = await pagosApi.payuCrear(ordenId)
        if (payu.modo === 'sandbox') {
          // POST a la página de PayU (WebCheckout); al volver, /checkout/payu valida la firma y confirma el pago
          const form = document.createElement('form')
          form.method = 'POST'
          form.action = payu.actionUrl
          Object.entries(payu.campos).forEach(([nombre, valor]) => {
            const input = document.createElement('input')
            input.type = 'hidden'
            input.name = nombre
            input.value = valor
            form.appendChild(input)
          })
          document.body.appendChild(form)
          form.submit()
          return
        }
        throw new ApiError(400, 'PayU no está configurado en el servidor')
      }
      if (metodo === 'paypal') {
        const paypal = await pagosApi.paypalCrear(ordenId)
        if (paypal.modo === 'sandbox') {
          // Se sale a PayPal Sandbox a aprobar; al volver, el efecto de arriba captura el pago
          window.location.href = paypal.aprobacionUrl
          return
        }
        // modo "simulado": sigue abajo con el simulador local
      }
      const digitos = numeroTarjeta.replace(/\s+/g, '')
      const pago = await pagosApi.procesar(
        ordenId,
        metodo !== 'tarjeta'
          ? { metodo }
          : tarjetaSel
            ? { metodo, tarjetaUltimos4: tarjetaSel.ultimos4, vencimiento: tarjetaSel.vencimiento, cvv }
            : { metodo, numeroTarjeta: digitos, vencimiento, cvv },
      )
      // Solo se guarda una tarjeta nueva si el pago fue aprobado; únicamente marca, últimos 4 y vencimiento
      if (metodo === 'tarjeta' && !tarjetaSel && guardarTarjeta && pago.estado === 'aprobado') {
        await guardadosApi
          .crearTarjeta({ marca: marcaTarjeta(digitos), ultimos4: digitos.slice(-4), vencimiento: vencimiento.trim() })
          .catch(() => undefined)
      }
      if (pago.estado !== 'aprobado') {
        // Rechazado: no se cambia de pantalla; se explica y se deja corregir y reintentar aquí mismo
        setError(`Pago rechazado: ${pago.motivoRechazo || 'el banco no aprobó la tarjeta'}. Revisa los datos o usa otra tarjeta y vuelve a intentarlo.`)
        setCvv('')
        return
      }
      setPasoActual(3)
      setResultado({ aprobado: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo procesar la orden')
    } finally {
      setProcesando(false)
      setMostrarConfirmacion(false)
    }
  }

  // Vuelta desde PayPal: mientras el servidor captura el pago se muestra esta pantalla (no el formulario)
  if (confirmandoPaypal) return <PantallaConfirmando pasarela="PayPal" />

  if (resultado) {
    return <PantallaResultado aprobado={resultado.aprobado} motivo={resultado.motivo} enLugar={resultado.enLugar} onVerOrdenes={() => navigate('/ordenes')} />
  }

  if (cargando || !carrito) {
    return (
      <div className="center-loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.375rem' }}>Checkout</h1>

      <div className={styles.steps}>
        {PASOS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className={`${styles.step} ${pasoActual === i + 1 ? styles.active : ''}`}>
              <span className={styles.stepDot}>{i + 1}</span>
              {label}
            </div>
            {i < PASOS.length - 1 && <div className={styles.divider} />}
          </div>
        ))}
      </div>

      {segundosRestantes !== null && (
        <div
          className="card"
          role="timer"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: citaVencida || segundosRestantes < 120 ? 'var(--color-danger-soft)' : 'var(--color-accent-soft)',
          }}
        >
          {citaVencida ? (
            <>
              <strong>Tu horario ya no está retenido.</strong> Vuelve al servicio y elige un horario de nuevo.{' '}
              <button type="button" className="btn" onClick={() => navigate('/carrito')}>
                Ir al carrito
              </button>
            </>
          ) : (
            <>
              Tu horario está retenido por{' '}
              <strong>
                {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
              </strong>
              . Completa el pago antes de que termine.
            </>
          )}
        </div>
      )}

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={onSubmit}>
          {ordenReintento && direccionOrden && (
            <div className={`card ${styles.section}`}>
              <h2 style={{ fontSize: '1.0625rem' }}>Dirección de entrega</h2>
              <p>
                <strong>{direccionOrden.nombre}</strong> · Tel. {direccionOrden.telefono}
                <br />
                <span className="muted">{direccionOrden.direccion}</span>
              </p>
              <p className="hint-text">Tu orden ya está creada; solo falta completar el pago.</p>
            </div>
          )}
          {soloLocal && !ordenReintento && (
            <div className={`card ${styles.section}`}>
              <h2 style={{ fontSize: '1.0625rem' }}>Tu cita en el local</h2>
              {detalleLocales}
              <p className="hint-text">No necesitas dar una dirección: acudes al local del vendedor en la fecha y hora elegidas. Solo dejamos tus datos de contacto.</p>
              <div className={styles.row2}>
                <div className="field">
                  <label htmlFor="nombre">Nombre</label>
                  <input id="nombre" className="input" required minLength={2} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="telefono">Teléfono</label>
                  <input
                    id="telefono"
                    className="input"
                    required
                    inputMode="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(formatearTelefono(e.target.value))}
                    placeholder="0000-0000"
                  />
                </div>
              </div>
            </div>
          )}
          {!soloLocal && (
          <div className={`card ${styles.section}`} style={ordenReintento ? { display: 'none' } : undefined}>
            <h2 style={{ fontSize: '1.0625rem' }}>{tituloDireccion}</h2>
            {dirGuardadas.length > 0 && (
              <div className={guardados.opciones}>
                {dirGuardadas.map((d) => (
                  <label key={d.id} className={`${guardados.opcion} ${dirElegida === d.id ? guardados.activa : ''}`}>
                    <input type="radio" name="dir" checked={dirElegida === d.id} onChange={() => setDirElegida(d.id)} />
                    <span>
                      <strong>{d.nombre}</strong>
                      {d.predeterminada && <span className="badge badge-neutral" style={{ marginLeft: '0.5rem' }}>Predeterminada</span>}
                      <br />
                      <span className="muted" style={{ fontSize: '0.875rem' }}>
                        {d.direccion} · Tel. {d.telefono}
                      </span>
                    </span>
                  </label>
                ))}
                <label className={`${guardados.opcion} ${dirElegida === 'nueva' ? guardados.activa : ''}`}>
                  <input type="radio" name="dir" checked={dirElegida === 'nueva'} onChange={() => setDirElegida('nueva')} />
                  <span>Usar otra dirección</span>
                </label>
              </div>
            )}
            {!dirSel && (<>
            <div className={styles.row2}>
              <div className="field">
                <label htmlFor="nombre">Nombre</label>
                <input id="nombre" className="input" required={!ordenReintento} minLength={2} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  id="telefono"
                  className="input"
                  required={!ordenReintento}
                  inputMode="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(formatearTelefono(e.target.value))}
                  placeholder="0000-0000"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="direccion">Dirección</label>
              <input
                id="direccion"
                className="input"
                required={!ordenReintento}
                minLength={5}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, referencia"
              />
            </div>
            <label className={guardados.check}>
              <input type="checkbox" checked={guardarDireccion} onChange={(e) => setGuardarDireccion(e.target.checked)} />
              Guardar esta dirección para próximas compras
            </label>
            </>)}
            {notaDireccion && <p className="hint-text">{notaDireccion}</p>}
          </div>
          )}
          {!soloLocal && serviciosLocal.length > 0 && !ordenReintento && (
            <div className={`card ${styles.section}`}>
              <h2 style={{ fontSize: '1.0625rem' }}>{serviciosLocal.length === 1 ? 'Tu cita en el local' : 'Tus citas en el local'}</h2>
              {detalleLocales}
            </div>
          )}

          <div className={`card ${styles.section}`}>
            <h2 style={{ fontSize: '1.0625rem' }}>Método de pago</h2>
            <div className={styles.methodTabs}>
              {permiteEfectivo && (
                <button
                  type="button"
                  className={`${styles.methodTab} ${metodo === 'efectivo' ? styles.active : ''}`}
                  onClick={() => setMetodo('efectivo')}
                >
                  {etiquetaEfectivo}
                </button>
              )}
              <button
                type="button"
                className={`${styles.methodTab} ${metodo === 'tarjeta' ? styles.active : ''}`}
                onClick={() => setMetodo('tarjeta')}
              >
                Tarjeta
              </button>
              <button
                type="button"
                className={`${styles.methodTab} ${metodo === 'paypal' ? styles.active : ''}`}
                onClick={() => setMetodo('paypal')}
              >
                PayPal
              </button>
              {payuActivo && (
                <button
                  type="button"
                  className={`${styles.methodTab} ${metodo === 'payu' ? styles.active : ''}`}
                  onClick={() => setMetodo('payu')}
                >
                  PayU
                </button>
              )}
            </div>


            {metodo === 'efectivo' && (
              <p className="hint-text">
                Pagarás ${carrito.total.toFixed(2)} en efectivo {cuandoPaga}. Puedes cancelar la cita hasta 2 horas antes sin costo.
              </p>
            )}

            {metodo === 'tarjeta' && tarjetasGuardadas.length > 0 && (
              <div className={guardados.opciones}>
                {tarjetasGuardadas.map((t) => (
                  <label
                    key={t.id}
                    className={`${guardados.opcion} ${tarjetaElegida === t.id ? guardados.activa : ''} ${estaVencida(t.vencimiento) ? guardados.deshabilitada : ''}`}
                  >
                    <input
                      type="radio"
                      name="tarjeta"
                      disabled={estaVencida(t.vencimiento)}
                      checked={tarjetaElegida === t.id}
                      onChange={() => setTarjetaElegida(t.id)}
                    />
                    <span>
                      <strong>
                        {t.marca} •••• {t.ultimos4}
                      </strong>
                      {t.predeterminada && <span className="badge badge-neutral" style={{ marginLeft: '0.5rem' }}>Predeterminada</span>}
                      <br />
                      {estaVencida(t.vencimiento) ? (
                        <span className="badge badge-danger">Vencida · {t.vencimiento}</span>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.875rem' }}>Vence {t.vencimiento}</span>
                      )}
                    </span>
                  </label>
                ))}
                <label className={`${guardados.opcion} ${tarjetaElegida === 'nueva' ? guardados.activa : ''}`}>
                  <input type="radio" name="tarjeta" checked={tarjetaElegida === 'nueva'} onChange={() => setTarjetaElegida('nueva')} />
                  <span>Usar otra tarjeta</span>
                </label>
              </div>
            )}

            {metodo === 'tarjeta' && tarjetaSel && (
              <div className="field" style={{ maxWidth: '12rem' }}>
                <label htmlFor="cvv">CVV</label>
                <input
                  id="cvv"
                  className="input"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={cvv}
                  onChange={(e) => setCvv(formatearCvv(e.target.value, tarjetaSel.marca))}
                  placeholder="123"
                />
              </div>
            )}

            {metodo === 'tarjeta' && !tarjetaSel && (
              <>
                <div className="field">
                  <label htmlFor="numeroTarjeta">Número de tarjeta</label>
                  <input
                    id="numeroTarjeta"
                    className="input"
                    required
                    inputMode="numeric"
                    value={numeroTarjeta}
                    onChange={(e) => setNumeroTarjeta(formatearNumeroTarjeta(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                  />
                </div>
                <div className={styles.row2}>
                  <div className="field">
                    <label htmlFor="vencimiento">Vencimiento</label>
                    <input
                      id="vencimiento"
                      className="input"
                      required
                      inputMode="numeric"
                      value={vencimiento}
                      onChange={(e) => setVencimiento(formatearVencimiento(e.target.value))}
                      placeholder="MM/AA"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cvv">CVV</label>
                    <input
                      id="cvv"
                      className="input"
                      required
                      inputMode="numeric"
                      value={cvv}
                      onChange={(e) => setCvv(formatearCvv(e.target.value, marcaTarjeta(numeroTarjeta)))}
                      placeholder="123"
                    />
                  </div>
                </div>
                <label className={guardados.check}>
                  <input type="checkbox" checked={guardarTarjeta} onChange={(e) => setGuardarTarjeta(e.target.checked)} />
                  Guardar esta tarjeta para próximas compras (solo marca, últimos 4 dígitos y vencimiento)
                </label>
              </>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={procesando || citaVencida}>
            {procesando ? 'Procesando...' : metodo === 'efectivo' ? 'Confirmar cita' : `Confirmar pago de $${carrito.total.toFixed(2)}`}
          </button>
        </form>

        <div className={`card ${styles.summary}`}>
          <h2 style={{ fontSize: '1.0625rem' }}>Resumen del pedido</h2>
          {carrito.items.map((it) => (
            <div key={it.productoId} className={styles.miniItem}>
              <span>
                {it.nombre} {it.cita ? `· ${formatFecha(it.cita.fecha)} ${formatHora12h(it.cita.horaInicio)}` : `× ${it.cantidad}`}
              </span>
              <span>${it.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div className={styles.summaryTotal}>
            <span>Total</span>
            <span>${carrito.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <ConfirmModal
        abierto={mostrarConfirmacion}
        titulo={metodo === 'efectivo' ? 'Confirmar cita' : 'Confirmar compra'}
        mensaje={`${soloLocal ? 'Tu cita será en el local del vendedor' : hayProductos ? `Se enviará a "${envio.nombre}" en "${envio.direccion}"` : `El servicio se prestará en "${envio.direccion}"`} ${
          metodo === 'efectivo'
            ? `y pagarás $${carrito.total.toFixed(2)} en efectivo ${cuandoPaga}. ¿Confirmas la cita?`
            : `y se cobrará $${carrito.total.toFixed(2)} con ${metodo === 'tarjeta' ? (tarjetaSel ? `la tarjeta terminada en ${tarjetaSel.ultimos4}` : 'tarjeta') : metodo === 'payu' ? 'PayU' : 'PayPal'} (sandbox). ¿Confirmas la compra?`
        }`}
        textoConfirmar={metodo === 'efectivo' ? 'Sí, agendar cita' : 'Sí, confirmar y pagar'}
        procesando={procesando}
        onConfirmar={confirmarYPagar}
        onCancelar={() => setMostrarConfirmacion(false)}
      />
    </div>
  )
}
