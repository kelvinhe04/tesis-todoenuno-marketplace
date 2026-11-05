import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError, authApi } from '../lib/api'

// Franja bajo el header para cuentas con el correo sin verificar: sin verificar no se puede comprar
// ni activar el modo vendedor.
export function AvisoVerificacion() {
  const { usuario, refrescarUsuario } = useAuth()
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'enviado'>('inicial')
  const [error, setError] = useState<string | null>(null)

  if (!usuario || usuario.emailVerificado !== false) return null

  const reenviar = async () => {
    setEstado('enviando')
    setError(null)
    try {
      await authApi.reenviarVerificacion()
      setEstado('enviado')
    } catch (err) {
      setEstado('inicial')
      setError(err instanceof ApiError ? err.message : 'No se pudo reenviar el correo')
    }
  }

  return (
    <div
      role="status"
      style={{ background: '#fff4d6', borderBottom: '1px solid #ecd9a0', padding: '0.625rem 1rem', fontSize: '0.875rem' }}
    >
      <div className="container" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: '14rem' }}>
          <b>Verifica tu correo</b> para poder comprar y vender. Te enviamos un enlace a {usuario.email}.
          {error && <span className="error-text"> {error}</span>}
        </span>
        {estado === 'enviado' ? (
          <span className="muted">Enviado. Revisa tu bandeja.</span>
        ) : (
          <button type="button" className="btn btn-sm" onClick={reenviar} disabled={estado === 'enviando'}>
            {estado === 'enviando' ? 'Enviando...' : 'Reenviar enlace'}
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={() => void refrescarUsuario()}>
          Ya lo verifiqué
        </button>
        <Link to="/perfil" className="muted" style={{ fontSize: '0.8125rem' }}>
          Mi perfil
        </Link>
      </div>
    </div>
  )
}
