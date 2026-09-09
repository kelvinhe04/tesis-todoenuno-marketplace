import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError, type Rol, type Usuario } from '../lib/api'
import { IconEye, IconEyeOff } from '../components/icons'
import { GoogleLoginButton } from '../components/GoogleLoginButton'
import { RolGoogleModal } from '../components/RolGoogleModal'
import { AuthExito } from '../components/AuthExito'
import styles from './Auth.module.css'

const RETRASO_EXITO_MS = 900

export default function Login() {
  const { login, loginConGoogle, cargando } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [credencialGoogle, setCredencialGoogle] = useState<string | null>(null)
  const [nombreGoogle, setNombreGoogle] = useState('')
  const [creandoCuentaGoogle, setCreandoCuentaGoogle] = useState(false)

  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const entrarConExito = (usuario: Usuario) => {
    setCredencialGoogle(null)
    setMensajeExito(`¡Bienvenido, ${usuario.nombre}!`)
    setTimeout(() => navigate(usuario.rol === 'vendedor' ? '/vendedor' : '/'), RETRASO_EXITO_MS)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const usuario = await login({ email, password })
      entrarConExito(usuario)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    }
  }

  const onCredencialGoogle = async (credential: string) => {
    setError(null)
    try {
      const resp = await loginConGoogle(credential)
      if ('requiereRol' in resp) {
        setCredencialGoogle(credential)
        setNombreGoogle(resp.nombre)
        return
      }
      entrarConExito(resp)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión con Google')
    }
  }

  const elegirRolGoogle = async (rol: Rol) => {
    if (!credencialGoogle) return
    setError(null)
    setCreandoCuentaGoogle(true)
    try {
      const resp = await loginConGoogle(credencialGoogle, rol)
      if ('requiereRol' in resp) return
      entrarConExito(resp)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
    } finally {
      setCreandoCuentaGoogle(false)
    }
  }

  return (
    <div className={styles.split}>
      <div className={styles.brand}>
        <Link to="/" className={styles.logo}>
          Todo<span>En</span>Uno
        </Link>
        <div className={styles.brandMid}>
          <h2>Bienvenido de vuelta.</h2>
          <p>Revisa tus órdenes, sigue tus compras y descubre nuevas publicaciones de tus vendedores favoritos.</p>
        </div>
        <div className={styles.quote}>
          "Encontré una diseñadora de logos increíble en menos de diez minutos."
          <b>— Roberto Sanjur, comprador</b>
        </div>
      </div>

      <div className={styles.formSide}>
        <form className={styles.formCard} onSubmit={onSubmit}>
          <Link to="/" className={styles.logoMobile}>
            Todo<span>En</span>Uno
          </Link>

          <h1>Inicia sesión</h1>
          <p className={styles.subtitle}>Ingresa tus datos para continuar.</p>

          <div className={styles.field}>
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <div className={styles.field}>
            <div className={styles.fieldRow}>
              <label htmlFor="password">Contraseña</label>
            </div>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={mostrarPassword ? 'text' : 'password'}
                className="input"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
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

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className={styles.btnPrimary} disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>

          <div className={styles.divider}>o</div>
          <GoogleLoginButton onCredential={onCredencialGoogle} />

          <p className={styles.switch}>
            ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
          </p>
        </form>
      </div>

      <RolGoogleModal
        abierto={credencialGoogle !== null}
        nombre={nombreGoogle}
        procesando={creandoCuentaGoogle}
        onElegir={elegirRolGoogle}
      />
      <AuthExito mostrar={mensajeExito !== null} mensaje={mensajeExito || ''} />
    </div>
  )
}
