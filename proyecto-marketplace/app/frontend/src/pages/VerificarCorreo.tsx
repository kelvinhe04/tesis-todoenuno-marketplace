import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError, authApi } from '../lib/api'

// Destino del enlace del correo de verificación: /verificar-correo?token=...
export default function VerificarCorreo() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { usuario, refrescarUsuario } = useAuth()
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'error'>(token ? 'verificando' : 'error')
  const [mensaje, setMensaje] = useState(token ? '' : 'Falta el enlace de verificación.')
  const yaIntentado = useRef(false)

  useEffect(() => {
    if (!token || yaIntentado.current) return
    yaIntentado.current = true
    authApi
      .verificarCorreo(token)
      .then(async (r) => {
        setMensaje(`Listo: ${r.email} quedó verificado.`)
        setEstado('ok')
        if (usuario) await refrescarUsuario()
      })
      .catch((err) => {
        setMensaje(err instanceof ApiError ? err.message : 'No se pudo verificar el correo.')
        setEstado('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="container" style={{ maxWidth: '36rem', padding: '3rem 0', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
        {estado === 'verificando' ? 'Verificando tu correo...' : estado === 'ok' ? '¡Correo verificado!' : 'No se pudo verificar'}
      </h1>
      {estado === 'verificando' ? <div className="spinner" style={{ margin: '1rem auto' }} /> : <p className={estado === 'error' ? 'error-text' : 'muted'}>{mensaje}</p>}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">
          Ir al inicio
        </Link>
        {estado === 'error' && usuario && (
          <Link to="/perfil" className="btn">
            Pedir otro enlace
          </Link>
        )}
      </div>
    </div>
  )
}
