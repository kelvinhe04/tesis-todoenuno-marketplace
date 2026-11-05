import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  authApi,
  EVENTO_SESION_EXPIRADA,
  getToken,
  getUsuarioGuardado,
  guardarSesion,
  limpiarSesion,
  type ActualizarPerfilPayload,
  type LoginPayload,
  type RegistroPayload,
  type Usuario,
} from '../lib/api'

interface AuthContextValue {
  usuario: Usuario | null
  cargando: boolean
  login: (dto: LoginPayload) => Promise<Usuario>
  registrar: (dto: RegistroPayload) => Promise<Usuario>
  loginConGoogle: (credential: string) => Promise<Usuario>
  activarVendedor: () => Promise<Usuario>
  actualizarPerfil: (dto: ActualizarPerfilPayload) => Promise<Usuario>
  refrescarUsuario: () => Promise<Usuario | null>
  logout: () => void
  cerrarSesionEnTodos: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => getUsuarioGuardado())
  const [cargando, setCargando] = useState(false)

  // Token vencido/rechazado por el servidor: limpiar la sesión y dejar que ProtectedRoute lleve a /login
  useEffect(() => {
    const alExpirar = () => setUsuario(null)
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar)
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar)
  }, [])

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

  const loginConGoogle = async (credential: string) => {
    setCargando(true)
    try {
      const resp = await authApi.google(credential)
      guardarSesion(resp.token, resp.usuario)
      setUsuario(resp.usuario)
      return resp.usuario
    } finally {
      setCargando(false)
    }
  }

  const actualizarPerfil = async (dto: ActualizarPerfilPayload) => {
    const { token: tokenNuevo, ...u } = await authApi.actualizarPerfil(dto)
    // Al cambiar la contraseña el servidor cierra las demás sesiones y entrega un token nuevo
    const token = tokenNuevo ?? getToken()
    if (token) guardarSesion(token, u)
    setUsuario(u)
    return u
  }

  // Vuelve a leer el perfil (p. ej. tras verificar el correo en otra pestaña)
  const refrescarUsuario = async () => {
    try {
      const u = await authApi.me()
      const token = getToken()
      if (token) guardarSesion(token, u)
      setUsuario(u)
      return u
    } catch {
      return null
    }
  }

  const activarVendedor = async () => {
    const { token, usuario: u } = await authApi.activarVendedor()
    guardarSesion(token, u)
    setUsuario(u)
    return u
  }

  // Avisa al servidor para que REVOQUE el token (si no, seguiría valiendo hasta vencer); si falla igual se cierra aquí
  const logout = () => {
    authApi.logout().catch(() => undefined)
    limpiarSesion()
    setUsuario(null)
  }

  const cerrarSesionEnTodos = async () => {
    await authApi.logoutTodos().catch(() => undefined)
    limpiarSesion()
    setUsuario(null)
  }

  const value = useMemo(
    () => ({ usuario, cargando, login, registrar, loginConGoogle, activarVendedor, actualizarPerfil, refrescarUsuario, logout, cerrarSesionEnTodos }),
    [usuario, cargando],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
