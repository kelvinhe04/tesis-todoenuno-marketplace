import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError, type Rol, type Usuario } from '../lib/api'
import { IconEye, IconEyeOff } from '../components/icons'
import { GoogleLoginButton } from '../components/GoogleLoginButton'
import { AuthExito } from '../components/AuthExito'
import styles from './Auth.module.css'

const RETRASO_EXITO_MS = 900

export default function Registro() {
  const { registrar, loginConGoogle, cargando } = useAuth()
  const navigate = useNavigate()

  const [rol, setRol] = useState<Rol>('comprador')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const entrarConExito = (usuario: Usuario) => {
    setMensajeExito(`¡Cuenta creada, ${usuario.nombre}!`)
    setTimeout(() => navigate(usuario.rol === 'vendedor' ? '/vendedor' : '/'), RETRASO_EXITO_MS)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    try {
      const usuario = await registrar({ nombre, email, password, rol })
      entrarConExito(usuario)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
    }
  }

  const onCredencialGoogle = async (credential: string) => {
    setError(null)
    try {
      const resp = await loginConGoogle(credential, rol)
      if ('requiereRol' in resp) return
      entrarConExito(resp)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta con Google')
    }
  }

  return (
    <div className={styles.split}>
      <div className={styles.brand}>
        <Link to="/" className={styles.logo}>
          Todo<span>En</span>Uno
        </Link>
        <div className={styles.brandMid}>
          <h2>Publica lo que haces, vende a tu manera.</h2>
          <p>
            Únete a talleres, estudios y profesionales que ya venden productos y servicios en TodoEnUno, con pago
            protegido y sin comisiones ocultas.
          </p>
        </div>
        <div className={styles.quote}>
          "Publiqué mi primer producto en cinco minutos y ya tenía mi primera orden esa semana."
          <b>— Ana Ríos, Taller Barro Fino</b>
        </div>
      </div>

      <div className={styles.formSide}>
        <form className={styles.formCard} onSubmit={onSubmit}>
          <Link to="/" className={styles.logoMobile}>
            Todo<span>En</span>Uno
          </Link>

          <h1>Crea tu cuenta</h1>
          <p className={styles.subtitle}>Es gratis y toma menos de un minuto.</p>

          <div className={styles.rolTabs} role="tablist" aria-label="Tipo de cuenta">
            <button
              type="button"
              role="tab"
              aria-selected={rol === 'comprador'}
              className={`${styles.rolTab} ${rol === 'comprador' ? styles.active : ''}`}
              onClick={() => setRol('comprador')}
            >
              Quiero comprar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rol === 'vendedor'}
              className={`${styles.rolTab} ${rol === 'vendedor' ? styles.active : ''}`}
              onClick={() => setRol('vendedor')}
            >
              Quiero vender
            </button>
          </div>

          <div className={styles.field}>
            <label htmlFor="nombre">Nombre completo</label>
            <input
              id="nombre"
              className="input"
              required
              minLength={2}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre y apellido"
            />
          </div>

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
            <label htmlFor="password">Contraseña</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={mostrarPassword ? 'text' : 'password'}
                className="input"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
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

          <div className={styles.field}>
            <label htmlFor="confirmar">Confirmar contraseña</label>
            <div className={styles.passwordWrap}>
              <input
                id="confirmar"
                type={mostrarConfirmar ? 'text' : 'password'}
                className="input"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repite tu contraseña"
              />
              <button
                type="button"
                className={styles.eyeToggle}
                onClick={() => setMostrarConfirmar((v) => !v)}
                aria-label={mostrarConfirmar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarConfirmar ? <IconEye width={18} height={18} /> : <IconEyeOff width={18} height={18} />}
              </button>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className={styles.btnPrimary} disabled={cargando}>
            {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <div className={styles.divider}>o</div>
          <GoogleLoginButton onCredential={onCredencialGoogle} />

          <p className={styles.terms}>
            Al crear tu cuenta aceptas los Términos de servicio y la Política de privacidad de TodoEnUno.
          </p>
          <p className={styles.switch}>
            ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
          </p>
        </form>
      </div>

      <AuthExito mostrar={mensajeExito !== null} mensaje={mensajeExito || ''} />
    </div>
  )
}
