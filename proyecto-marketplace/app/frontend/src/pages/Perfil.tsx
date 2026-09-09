import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { notificacionesApi, type Notificacion } from '../lib/api'
import { IconUser } from '../components/icons'
import styles from './Perfil.module.css'

export default function Perfil() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)

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

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.375rem', marginBottom: '1.25rem' }}>Mi perfil</h1>

      <div className={styles.layout}>
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
