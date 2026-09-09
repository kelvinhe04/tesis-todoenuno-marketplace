import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { notificacionesApi } from '../lib/api'
import { IconBell, IconCart, IconClose, IconMenu, IconSearch, IconUser } from './icons'
import styles from './Header.module.css'

export function Header() {
  const { usuario, logout } = useAuth()
  const { cantidadItems } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const enCatalogo = location.pathname === '/catalogo'
  const [searchParams, setSearchParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState(() => (enCatalogo ? searchParams.get('buscar') || '' : ''))
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [notificacionesSinLeer, setNotificacionesSinLeer] = useState(0)
  const escribiendoRef = useRef(false)

  // Si el filtro cambia por fuera (limpiar filtros, navegar a una categoría, etc.), refleja el valor en la caja.
  useEffect(() => {
    if (enCatalogo && !escribiendoRef.current) {
      setBusqueda(searchParams.get('buscar') || '')
    }
    escribiendoRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCatalogo, searchParams])

  // Filtra en vivo mientras se escribe, solo si ya estamos en el catálogo.
  useEffect(() => {
    if (!enCatalogo) return
    const actual = searchParams.get('buscar') || ''
    if (busqueda === actual) return
    const handle = setTimeout(() => {
      escribiendoRef.current = true
      const next = new URLSearchParams(searchParams)
      if (busqueda) next.set('buscar', busqueda)
      else next.delete('buscar')
      next.delete('pagina')
      setSearchParams(next, { replace: true })
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, enCatalogo])

  useEffect(() => {
    if (!usuario) {
      setNotificacionesSinLeer(0)
      return
    }
    notificacionesApi
      .listar()
      .then((lista) => setNotificacionesSinLeer(lista.filter((n) => !n.leida).length))
      .catch(() => setNotificacionesSinLeer(0))
  }, [usuario])

  const buscar = (e: FormEvent) => {
    e.preventDefault()
    if (enCatalogo) {
      const next = new URLSearchParams(searchParams)
      if (busqueda) next.set('buscar', busqueda)
      else next.delete('buscar')
      next.delete('pagina')
      setSearchParams(next)
    } else {
      navigate(busqueda ? `/catalogo?buscar=${encodeURIComponent(busqueda)}` : '/catalogo')
    }
    setMenuAbierto(false)
  }

  const cerrarSesion = () => {
    logout()
    setMenuAbierto(false)
    navigate('/')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) => `${styles.navLink} ${isActive ? styles.active : ''}`

  return (
    <header className={styles.header}>
      <div className="container">
        <div className={styles.bar}>
          <button
            type="button"
            className={styles.menuToggle}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuAbierto((v) => !v)}
          >
            {menuAbierto ? <IconClose /> : <IconMenu />}
          </button>

          <NavLink to="/" className={styles.logo}>
            Todo<span>En</span>Uno
          </NavLink>

          <form className={styles.searchForm} onSubmit={buscar} role="search">
            <div className={styles.searchBox}>
              <IconSearch width={18} height={18} />
              <input
                type="search"
                placeholder="Buscar productos y servicios..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </form>

          <nav className={styles.navDesktop} aria-label="Principal">
            <NavLink to="/catalogo" className={linkClass}>
              Categorías
            </NavLink>
            {usuario && (
              <NavLink to="/ordenes" className={linkClass}>
                Mis órdenes
              </NavLink>
            )}
            {usuario?.rol === 'vendedor' && (
              <NavLink to="/vendedor" className={linkClass}>
                Panel de vendedor
              </NavLink>
            )}
          </nav>

          <div className={styles.actions}>
            {usuario ? (
              <>
                <NavLink to="/perfil" className={styles.iconBtn} aria-label="Notificaciones">
                  <IconBell />
                  {notificacionesSinLeer > 0 && <span className={styles.badge}>{notificacionesSinLeer}</span>}
                </NavLink>
                <NavLink to="/carrito" className={styles.iconBtn} aria-label="Carrito">
                  <IconCart />
                  {cantidadItems > 0 && <span className={styles.badge}>{cantidadItems}</span>}
                </NavLink>
                <NavLink to="/perfil" className={styles.iconBtn} aria-label="Mi perfil">
                  <IconUser />
                </NavLink>
                <button type="button" className="btn btn-sm" onClick={cerrarSesion}>
                  Salir
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="btn btn-sm">
                  Iniciar sesión
                </NavLink>
                <NavLink to="/registro" className="btn btn-sm btn-primary">
                  Crear cuenta
                </NavLink>
              </>
            )}
          </div>
        </div>

        {menuAbierto && (
          <div className={styles.mobilePanel}>
            <form className={styles.mobileSearch} onSubmit={buscar} role="search">
              <div className={styles.searchBox} style={{ maxWidth: 'none' }}>
                <IconSearch width={18} height={18} />
                <input
                  type="search"
                  placeholder="Buscar productos y servicios..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </form>
            <NavLink to="/catalogo" className={styles.mobileNavLink} onClick={() => setMenuAbierto(false)}>
              Categorías
            </NavLink>
            {usuario && (
              <NavLink to="/ordenes" className={styles.mobileNavLink} onClick={() => setMenuAbierto(false)}>
                Mis órdenes
              </NavLink>
            )}
            {usuario?.rol === 'vendedor' && (
              <>
                <NavLink to="/vendedor" className={styles.mobileNavLink} onClick={() => setMenuAbierto(false)}>
                  Panel de vendedor
                </NavLink>
                <NavLink to="/vendedor/ordenes" className={styles.mobileNavLink} onClick={() => setMenuAbierto(false)}>
                  Órdenes recibidas
                </NavLink>
              </>
            )}
            <NavLink to="/perfil" className={styles.mobileNavLink} onClick={() => setMenuAbierto(false)}>
              Mi perfil
            </NavLink>
          </div>
        )}
      </div>
    </header>
  )
}
