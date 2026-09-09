import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ApiError, carritoApi, ordenesApi, pagosApi, type Carrito } from '../lib/api'
import { IconCheck } from '../components/icons'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatHora12h } from '../lib/estado'
import styles from './Checkout.module.css'

const PASOS = ['Carrito', 'Envío', 'Pago', 'Confirmación']

export default function Checkout() {
  const navigate = useNavigate()
  const { refrescar } = useCart()

  const [carrito, setCarrito] = useState<Carrito | null>(null)
  const [cargando, setCargando] = useState(true)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')

  const [metodo, setMetodo] = useState<'tarjeta' | 'paypal'>('tarjeta')
  const [numeroTarjeta, setNumeroTarjeta] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [cvv, setCvv] = useState('')

  const [pasoActual, setPasoActual] = useState(2)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ aprobado: boolean; motivo?: string } | null>(null)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

  useEffect(() => {
    carritoApi
      .obtener()
      .then((c) => {
        setCarrito(c)
        if (c.items.length === 0) navigate('/carrito')
      })
      .finally(() => setCargando(false))
  }, [navigate])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMostrarConfirmacion(true)
  }

  const confirmarYPagar = async () => {
    setProcesando(true)
    setPasoActual(3)
    try {
      const orden = await ordenesApi.crear({ nombre, telefono, direccion })
      await refrescar()
      const pago = await pagosApi.procesar(orden.id, {
        metodo,
        numeroTarjeta: metodo === 'tarjeta' ? numeroTarjeta.replace(/\s+/g, '') : undefined,
        vencimiento: metodo === 'tarjeta' ? vencimiento : undefined,
        cvv: metodo === 'tarjeta' ? cvv : undefined,
      })
      setPasoActual(4)
      setResultado({ aprobado: pago.estado === 'aprobado', motivo: pago.motivoRechazo })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo procesar la orden')
      setPasoActual(2)
    } finally {
      setProcesando(false)
      setMostrarConfirmacion(false)
    }
  }

  if (cargando || !carrito) {
    return (
      <div className="center-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (resultado) {
    return (
      <div className="container" style={{ maxWidth: '32rem', textAlign: 'center', paddingTop: '2rem' }}>
        <div
          style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            margin: '0 auto 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: resultado.aprobado ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
            color: resultado.aprobado ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          <IconCheck width={32} height={32} />
        </div>
        <h1 style={{ fontSize: '1.375rem', marginBottom: '0.5rem' }}>
          {resultado.aprobado ? 'Pago aprobado' : 'Pago rechazado'}
        </h1>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          {resultado.aprobado
            ? 'Tu orden fue creada y el pago quedó confirmado (entorno de prueba / sandbox).'
            : resultado.motivo || 'El pago no pudo procesarse. Puedes revisar el estado en Mis órdenes.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/ordenes')}>
          Ver mis órdenes
        </button>
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

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={`card ${styles.section}`}>
            <h2 style={{ fontSize: '1.0625rem' }}>Dirección de entrega</h2>
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
                  minLength={4}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="0000-0000"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="direccion">Dirección</label>
              <input
                id="direccion"
                className="input"
                required
                minLength={5}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, referencia"
              />
            </div>
            <p className="hint-text">
              Para servicios, esta dirección se usa según la modalidad indicada por el vendedor (a domicilio del
              cliente o en el local del vendedor).
            </p>
          </div>

          <div className={`card ${styles.section}`}>
            <h2 style={{ fontSize: '1.0625rem' }}>Método de pago</h2>
            <div className={styles.methodTabs}>
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
            </div>

            <p className={styles.sandboxNote}>
              Entorno de prueba (sandbox): ninguna transacción es real. Usa cualquier número de tarjeta; uno terminado
              en <strong>0002</strong> simula un rechazo del banco.
            </p>

            {metodo === 'tarjeta' && (
              <>
                <div className="field">
                  <label htmlFor="numeroTarjeta">Número de tarjeta</label>
                  <input
                    id="numeroTarjeta"
                    className="input"
                    required
                    inputMode="numeric"
                    value={numeroTarjeta}
                    onChange={(e) => setNumeroTarjeta(e.target.value)}
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
                      value={vencimiento}
                      onChange={(e) => setVencimiento(e.target.value)}
                      placeholder="MM/AA"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cvv">CVV</label>
                    <input id="cvv" className="input" required value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="123" />
                  </div>
                </div>
              </>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={procesando}>
            {procesando ? 'Procesando...' : `Confirmar pago de $${carrito.total.toFixed(2)}`}
          </button>
        </form>

        <div className={`card ${styles.summary}`}>
          <h2 style={{ fontSize: '1.0625rem' }}>Resumen del pedido</h2>
          {carrito.items.map((it) => (
            <div key={it.productoId} className={styles.miniItem}>
              <span>
                {it.nombre} {it.cita ? `· ${it.cita.fecha} ${formatHora12h(it.cita.horaInicio)}` : `× ${it.cantidad}`}
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
        titulo="Confirmar compra"
        mensaje={`Se enviará a "${nombre}" en "${direccion}" y se cobrará $${carrito.total.toFixed(2)} con ${metodo === 'tarjeta' ? 'tarjeta' : 'PayPal'} (sandbox). ¿Confirmas la compra?`}
        textoConfirmar="Sí, confirmar y pagar"
        procesando={procesando}
        onConfirmar={confirmarYPagar}
        onCancelar={() => setMostrarConfirmacion(false)}
      />
    </div>
  )
}
