import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export function Footer() {
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
            <span>Publicar producto</span>
            <span>Publicar servicio</span>
          </div>
          <div className={styles.col}>
            <h4>Cuenta</h4>
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/registro">Crear cuenta</Link>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className="container">© 2026 TodoEnUno — prototipo de trabajo de graduación.</div>
      </div>
    </footer>
  )
}
