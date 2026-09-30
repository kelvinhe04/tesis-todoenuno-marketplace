import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError, notificacionesApi, type Notificacion } from '../lib/api'
import { IconEdit, IconEye, IconEyeOff, IconUser } from '../components/icons'
import styles from './Perfil.module.css'

export default function Perfil() {
  const { usuario, actualizarPerfil, logout } = useAuth()
  const navigate = useNavigate()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)

  const [editando, setEditando] = useState(false)
  const [nombreEdit, setNombreEdit] = useState(usuario?.nombre || '')
  const [cambiarPassword, setCambiarPassword] = useState(false)
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)
  const [exitoEdicion, setExitoEdicion] = useState<string | null>(null)

  useEffect(() => {
    notificacionesApi
      .listar()
      .then(setNotificaciones)
      .finally(() => setCargando(false))
  }, [])

  const marcarLeida = async (id: string) => {
    const actualizada = await notificacionesApi.marcarLeida(id)
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? actualizada : n)))
  }

  if (!usuario) return null

  const abrirEdicion = () => {
    setNombreEdit(usuario.nombre)
    setCambiarPassword(false)
    setPasswordActual('')
    setPasswordNueva('')
    setErrorEdicion(null)
    setEditando(true)
  }

  const guardarEdicion = async (e: FormEvent) => {
    e.preventDefault()
    setErrorEdicion(null)
    setGuardando(true)
    try {
      await actualizarPerfil({
        nombre: nombreEdit !== usuario.nombre ? nombreEdit : undefined,
        ...(cambiarPassword ? { passwordActual, passwordNueva } : {}),
      })
      setEditando(false)
      setExitoEdicion('Perfil actualizado.')
      setTimeout(() => setExitoEdicion(null), 4000)
    } catch (err) {
      setErrorEdicion(err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.375rem', marginBottom: '1.25rem' }}>Mi perfil</h1>

      <div className={styles.layout}>
        {exitoEdicion && <p className="hint-text">{exitoEdicion}</p>}

        {editando ? (
          <form className={`card ${styles.profileCard} ${styles.profileEditCard}`} onSubmit={guardarEdicion}>
            <div className={styles.avatar}>
              <IconUser width={26} height={26} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="field">
                <label htmlFor="nombre-perfil">Nombre</label>
                <input
                  id="nombre-perfil"
                  className="input"
                  required
                  minLength={2}
                  value={nombreEdit}
                  onChange={(e) => setNombreEdit(e.target.value)}
                />
              </div>

              {cambiarPassword ? (
                <>
                  <div className="field">
                    <label htmlFor="password-actual">Contraseña actual</label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="password-actual"
                        type={mostrarPassword ? 'text' : 'password'}
                        className="input"
                        required
                        value={passwordActual}
                        onChange={(e) => setPasswordActual(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.eyeToggle}
                        onClick={() => setMostrarPassword((v) => !v)}
                        aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {mostrarPassword ? <IconEye width={18} height={18} /> : <IconEyeOff width={18} height={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="password-nueva">Contraseña nueva</label>
                    <input
                      id="password-nueva"
                      type={mostrarPassword ? 'text' : 'password'}
                      className="input"
                      required
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                      value={passwordNueva}
                      onChange={(e) => setPasswordNueva(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="muted"
                    style={{ fontSize: '0.8125rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setCambiarPassword(false)}
                  >
                    Cancelar cambio de contraseña
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="muted"
                  style={{ fontSize: '0.8125rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => setCambiarPassword(true)}
                >
                  Cambiar contraseña
                </button>
              )}

              {errorEdicion && <p className="error-text">{errorEdicion}</p>}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" className="btn" onClick={() => setEditando(false)} disabled={guardando}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className={`card ${styles.profileCard}`}>
            <div className={styles.avatar}>
              <IconUser width={26} height={26} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{usuario.nombre}</p>
              <p className="muted" style={{ fontSize: '0.875rem' }}>
                {usuario.email}
              </p>
              <span className="badge badge-neutral" style={{ marginTop: '0.375rem' }}>
                {usuario.rol === 'vendedor' ? 'Vendedor' : 'Comprador'}
              </span>
            </div>
            <button type="button" className="btn" onClick={abrirEdicion} aria-label="Editar perfil">
              <IconEdit width={16} height={16} />
              Editar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              Cerrar sesión
            </button>
          </div>
        )}

        <div>
          <h2 style={{ fontSize: '1.0625rem', marginBottom: '0.75rem' }}>Notificaciones</h2>

          {cargando ? (
            <div className="center-loading">
              <div className="spinner" />
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="empty-state">Todavía no tienes notificaciones.</div>
          ) : (
            <div className={styles.notifList}>
              {notificaciones.map((n) => (
                <div key={n.id} className={`card ${styles.notifItem}`}>
                  {!n.leida && <span className={styles.notifDot} />}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.9375rem' }}>{n.mensaje}</p>
                    <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {new Date(n.creadoEn).toLocaleString('es-PA')}
                    </p>
                  </div>
                  {!n.leida && (
                    <button type="button" className="btn btn-sm" onClick={() => marcarLeida(n.id)}>
                      Marcar leída
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
