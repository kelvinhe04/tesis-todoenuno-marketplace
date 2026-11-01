import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ApiError, carritoApi, ordenesApi, pagosApi, type Carrito } from '../lib/api'
import { IconCheck } from '../components/icons'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatFecha, formatHora12h } from '../lib/estado'
import styles from './Checkout.module.css'

// Envío y pago son un solo formulario: al confirmar se crea la orden y se cobra de una vez
const PASOS = ['Carrito', 'Envío y pago', 'Confirmación']

// Solo dígitos (máx. 19), agrupados de 4 en 4: "4242424242424242" -> "4242 4242 4242 4242"
function formatearNumeroTarjeta(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}

// "0229" -> "02/29"; la "/" aparece al escribir el 3.er dígito, así que se puede borrar sin trabarse
function formatearVencimiento(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`
}

// "69963888" -> "6996-3888"; el guion aparece al escribir el 5.º dígito (se puede borrar sin trabarse)
function formatearTelefono(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`
}

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
    if (telefono.replace(/\D/g, '').length < 7) {
      setError('El teléfono debe tener 7 u 8 dígitos')
      return
    }
    // Validar la tarjeta ANTES de crear la orden: crearla vacía el carrito, y si el pago
    // falla después queda una orden pendiente y el carrito vacío.
    if (metodo === 'tarjeta') {
      if (!/^\d{13,19}$/.test(numeroTarjeta.replace(/\s+/g, ''))) {
        setError('El número de tarjeta debe tener entre 13 y 19 dígitos')
        return
      }
      if (!/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(vencimiento.trim())) {
        setError('El vencimiento debe tener el formato MM/AA')
        return
      }
      if (!/^\d{3,4}$/.test(cvv.trim())) {
        setError('El CVV debe tener 3 o 4 dígitos')
        return
      }
    }
    setMostrarConfirmacion(true)
  }

  const confirmarYPagar = async () => {
    setProcesando(true)
    try {
      const orden = await ordenesApi.crear({ nombre, telefono, direccion })
      await refrescar()
      const pago = await pagosApi.procesar(orden.id, {
        metodo,
        numeroTarjeta: metodo === 'tarjeta' ? numeroTarjeta.replace(/\s+/g, '') : undefined,
        vencimiento: metodo === 'tarjeta' ? vencimiento : undefined,
        cvv: metodo === 'tarjeta' ? cvv : undefined,
      })
      setPasoActual(3)
      setResultado({ aprobado: pago.estado === 'aprobado', motivo: pago.motivoRechazo })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo procesar la orden')
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
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                    />
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
