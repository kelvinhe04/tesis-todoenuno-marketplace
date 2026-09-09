import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Rol } from '../lib/api'

export function ProtectedRoute({ children, rol }: { children: ReactNode; rol?: Rol }) {
  const { usuario } = useAuth()

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (rol && usuario.rol !== rol) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
