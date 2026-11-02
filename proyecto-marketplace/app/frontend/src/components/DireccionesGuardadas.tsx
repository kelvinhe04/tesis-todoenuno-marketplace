import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, guardadosApi, type DireccionGuardada } from '../lib/api'
import { formatearTelefono } from '../lib/formatos'
import { ConfirmModal } from './ConfirmModal'
import styles from './Guardados.module.css'

// Mi perfil: direcciones de entrega guardadas (se usan en el checkout sin volver a escribirlas)
export function DireccionesGuardadas() {
  const [direcciones, setDirecciones] = useState<DireccionGuardada[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState<DireccionGuardada | null>(null)

  const cargar = () =>
    guardadosApi
      .direcciones()
      .then(setDirecciones)
      .catch(() => setError('No se pudieron cargar tus direcciones.'))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const abrirNueva = () => {
    setEditandoId(null)
    setNombre('')
    setTelefono('')
    setDireccion('')
    setError(null)
    setFormAbierto(true)
  }

  const abrirEdicion = (d: DireccionGuardada) => {
    setEditandoId(d.id)
    setNombre(d.nombre)
    setTelefono(d.telefono)
    setDireccion(d.direccion)
    setError(null)
    setFormAbierto(true)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (telefono.replace(/\D/g, '').length < 7) {
      setError('El teléfono debe tener 7 u 8 dígitos')
      return
    }
    setGuardando(true)
    try {
      if (editandoId) await guardadosApi.actualizarDireccion(editandoId, { nombre, telefono, direccion })
      else await guardadosApi.crearDireccion({ nombre, telefono, direccion })
      setFormAbierto(false)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la dirección')
    } finally {
      setGuardando(false)
    }
  }

  const hacerPredeterminada = async (id: string) => {
    await guardadosApi.actualizarDireccion(id, { predeterminada: true })
    await cargar()
  }

  const eliminar = async () => {
    if (!aEliminar) return
    await guardadosApi.eliminarDireccion(aEliminar.id)
    setAEliminar(null)
    await cargar()
  }

  return (
    <div className={styles.seccion}>
      <div className={styles.encabezado}>
        <h2 style={{ fontSize: '1.0625rem' }}>Mis direcciones</h2>
        {!formAbierto && (
          <button type="button" className="btn btn-sm" onClick={abrirNueva}>
            + Agregar dirección
          </button>
        )}
      </div>

      {formAbierto && (
        <form className={`card ${styles.form}`} onSubmit={guardar}>
          <div className={styles.fila2}>
            <div className="field">
              <label className="requerido" htmlFor="dir-nombre">Nombre de quien recibe</label>
              <input id="dir-nombre" className="input" required minLength={2} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="field">
              <label className="requerido" htmlFor="dir-telefono">Teléfono</label>
              <input
                id="dir-telefono"
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
            <label className="requerido" htmlFor="dir-direccion">Dirección</label>
            <input
              id="dir-direccion"
              className="input"
              required
              minLength={5}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle, número, referencia"
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className={styles.acciones}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar dirección'}
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
      ) : direcciones.length === 0 && !formAbierto ? (
        <div className="empty-state">
          Todavía no tienes direcciones guardadas. Agrega una y la podrás usar al instante en el checkout.
        </div>
      ) : (
        <div className={styles.lista}>
          {direcciones.map((d) => (
            <div key={d.id} className={`card ${styles.item} ${d.predeterminada ? styles.predeterminada : ''}`}>
              <div className={styles.info}>
                <p className={styles.titulo}>
                  {d.nombre}
                  {d.predeterminada && <span className="badge badge-neutral">Predeterminada</span>}
                </p>
                <p className={styles.detalle}>{d.direccion}</p>
                <p className={styles.detalle}>Tel. {d.telefono}</p>
              </div>
              <div className={styles.acciones}>
                {!d.predeterminada && (
                  <button type="button" className="btn btn-sm" onClick={() => hacerPredeterminada(d.id)}>
                    Hacer predeterminada
                  </button>
                )}
                <button type="button" className="btn btn-sm" onClick={() => abrirEdicion(d)}>
                  Editar
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setAEliminar(d)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        abierto={aEliminar !== null}
        titulo="Eliminar dirección"
        mensaje={`¿Seguro que quieres eliminar la dirección de "${aEliminar?.nombre}"?`}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={eliminar}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}
