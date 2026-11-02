import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, guardadosApi, type TarjetaGuardada } from '../lib/api'
import {
  estaVencida,
  formatearNumeroTarjeta,
  formatearVencimiento,
  marcaTarjeta,
  validarNumeroTarjeta,
  validarVencimiento,
} from '../lib/formatos'
import { ConfirmModal } from './ConfirmModal'
import styles from './Guardados.module.css'

// Mi perfil: métodos de pago guardados. Del número escrito solo se envían marca, últimos 4 y
// vencimiento; el número completo se descarta en el navegador y el CVV nunca se pide aquí.
export function TarjetasGuardadas() {
  const [tarjetas, setTarjetas] = useState<TarjetaGuardada[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [numero, setNumero] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState<TarjetaGuardada | null>(null)

  const cargar = () =>
    guardadosApi
      .tarjetas()
      .then(setTarjetas)
      .catch(() => setError('No se pudieron cargar tus tarjetas.'))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const abrirForm = () => {
    setNumero('')
    setVencimiento('')
    setError(null)
    setFormAbierto(true)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const digitos = numero.replace(/\s+/g, '')
    const errorNumero = validarNumeroTarjeta(digitos)
    if (errorNumero) {
      setError(errorNumero)
      return
    }
    const errorVencimiento = validarVencimiento(vencimiento)
    if (errorVencimiento) {
      setError(errorVencimiento)
      return
    }
    setGuardando(true)
    try {
      await guardadosApi.crearTarjeta({ marca: marcaTarjeta(digitos), ultimos4: digitos.slice(-4), vencimiento })
      setNumero('')
      setFormAbierto(false)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la tarjeta')
    } finally {
      setGuardando(false)
    }
  }

  const hacerPredeterminada = async (id: string) => {
    await guardadosApi.hacerTarjetaPredeterminada(id)
    await cargar()
  }

  const eliminar = async () => {
    if (!aEliminar) return
    await guardadosApi.eliminarTarjeta(aEliminar.id)
    setAEliminar(null)
    await cargar()
  }

  return (
    <div className={styles.seccion}>
      <div className={styles.encabezado}>
        <h2 style={{ fontSize: '1.0625rem' }}>Mis métodos de pago</h2>
        {!formAbierto && (
          <button type="button" className="btn btn-sm" onClick={abrirForm}>
            + Agregar tarjeta
          </button>
        )}
      </div>

      {formAbierto && (
        <form className={`card ${styles.form}`} onSubmit={guardar}>
          <div className="field">
            <label className="requerido" htmlFor="tj-numero">Número de tarjeta</label>
            <input
              id="tj-numero"
              className="input"
              required
              inputMode="numeric"
              autoComplete="off"
              value={numero}
              onChange={(e) => setNumero(formatearNumeroTarjeta(e.target.value))}
              placeholder="0000 0000 0000 0000"
            />
          </div>
          <div className={styles.fila2}>
            <div className="field">
              <label className="requerido" htmlFor="tj-venc">Vencimiento</label>
              <input
                id="tj-venc"
                className="input"
                required
                inputMode="numeric"
                autoComplete="off"
                value={vencimiento}
                onChange={(e) => setVencimiento(formatearVencimiento(e.target.value))}
                placeholder="MM/AA"
              />
            </div>
          </div>
          <p className={styles.nota}>
            Por seguridad solo guardamos la marca, los últimos 4 dígitos y el vencimiento. Nunca guardamos el número
            completo ni el CVV: al pagar con una tarjeta guardada te pediremos solo el CVV. (Entorno de prueba: no se
            hace ningún cobro real.)
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className={styles.acciones}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar tarjeta'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setFormAbierto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : tarjetas.length === 0 && !formAbierto ? (
        <div className="empty-state">
          Todavía no tienes tarjetas guardadas. Agrega una y la podrás usar al instante en el checkout.
        </div>
      ) : (
        <div className={styles.lista}>
          {tarjetas.map((t) => (
            <div key={t.id} className={`card ${styles.item} ${t.predeterminada ? styles.predeterminada : ''}`}>
              <span className={styles.marca}>{t.marca === 'American Express' ? 'Amex' : t.marca}</span>
              <div className={styles.info}>
                <p className={styles.titulo}>
                  •••• {t.ultimos4}
                  {t.predeterminada && <span className="badge badge-neutral">Predeterminada</span>}
                </p>
                <p className={styles.detalle}>
                  {estaVencida(t.vencimiento) ? (
                    <span className="badge badge-danger">Vencida · {t.vencimiento}</span>
                  ) : (
                    <>Vence {t.vencimiento}</>
                  )}
                </p>
              </div>
              <div className={styles.acciones}>
                {!t.predeterminada && (
                  <button type="button" className="btn btn-sm" onClick={() => hacerPredeterminada(t.id)}>
                    Hacer predeterminada
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setAEliminar(t)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        abierto={aEliminar !== null}
        titulo="Eliminar tarjeta"
        mensaje={`¿Seguro que quieres eliminar la tarjeta terminada en ${aEliminar?.ultimos4}?`}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={eliminar}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}
