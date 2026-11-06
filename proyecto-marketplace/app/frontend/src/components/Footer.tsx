import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Footer.module.css'

export function Footer() {
  const { usuario } = useAuth()
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            Todo<span>En</span>Uno
          </div>
          <p className={styles.tagline}>
            Un marketplace para vendedores y compradores independientes. Prototipo académico construido sobre una
            arquitectura de microservicios.
          </p>
        </div>

        <div className={styles.cols}>
          <div className={styles.col}>
            <h4>Comprar</h4>
            <Link to="/catalogo">Explorar catálogo</Link>
            <Link to="/ordenes">Mis órdenes</Link>
            <Link to="/carrito">Mi carrito</Link>
          </div>
          <div className={styles.col}>
            <h4>Vender</h4>
            <Link to="/vendedor">Panel de vendedor</Link>
            <Link to="/vendedor/publicaciones/nueva">Publicar producto</Link>
            <Link to="/vendedor/publicaciones/nueva?tipo=servicio">Publicar servicio</Link>
          </div>
          <div className={styles.col}>
            <h4>Cuenta</h4>
            {usuario ? (
              <Link to="/perfil">Mi perfil</Link>
            ) : (
              <>
                <Link to="/login">Iniciar sesión</Link>
                <Link to="/registro">Crear cuenta</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className="container">© 2026 TodoEnUno · prototipo de trabajo de graduación.</div>
      </div>
    </footer>
  )
}
