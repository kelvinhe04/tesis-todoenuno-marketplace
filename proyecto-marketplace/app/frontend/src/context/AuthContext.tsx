import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  authApi,
  getUsuarioGuardado,
  guardarSesion,
  limpiarSesion,
  type LoginPayload,
  type RegistroPayload,
  type RequiereRolRespuesta,
  type Rol,
  type Usuario,
} from '../lib/api'

interface AuthContextValue {
  usuario: Usuario | null
  cargando: boolean
  login: (dto: LoginPayload) => Promise<Usuario>
  registrar: (dto: RegistroPayload) => Promise<Usuario>
  loginConGoogle: (credential: string, rol?: Rol) => Promise<Usuario | RequiereRolRespuesta>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => getUsuarioGuardado())
  const [cargando, setCargando] = useState(false)

  const login = async (dto: LoginPayload) => {
    setCargando(true)
    try {
      const { token, usuario: u } = await authApi.login(dto)
      guardarSesion(token, u)
      setUsuario(u)
      return u
    } finally {
      setCargando(false)
    }
  }

  const registrar = async (dto: RegistroPayload) => {
    setCargando(true)
    try {
      const { token, usuario: u } = await authApi.registro(dto)
      guardarSesion(token, u)
      setUsuario(u)
      return u
    } finally {
      setCargando(false)
    }
  }

  const loginConGoogle = async (credential: string, rol?: Rol) => {
    setCargando(true)
    try {
      const resp = await authApi.google(credential, rol)
      if ('requiereRol' in resp) {
        return resp
      }
      guardarSesion(resp.token, resp.usuario)
      setUsuario(resp.usuario)
      return resp.usuario
    } finally {
      setCargando(false)
    }
  }

  const logout = () => {
    limpiarSesion()
    setUsuario(null)
  }

  const value = useMemo(
    () => ({ usuario, cargando, login, registrar, loginConGoogle, logout }),
    [usuario, cargando],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
