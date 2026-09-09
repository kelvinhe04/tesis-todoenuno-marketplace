import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { IconDashboard, IconList, IconLogout, IconOrders } from './icons'
import styles from './VendorLayout.module.css'

const links = [
  { to: '/vendedor', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/vendedor/publicaciones', label: 'Publicaciones', icon: IconList, end: true },
  { to: '/vendedor/ordenes', label: 'Órdenes recibidas', icon: IconOrders, end: true },
]

export function VendorLayout({ titulo, acciones, children }: { titulo: string; acciones?: ReactNode; children: ReactNode }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink to="/" className={styles.brand}>
          <span>VENDEDOR</span>
        </NavLink>

        <div className={styles.mobileTabs}>
          {links.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.active : ''}`}>
              {label}
            </NavLink>
          ))}
        </div>

        <nav className={styles.navLinks} aria-label="Panel de vendedor">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
              <Icon width={18} height={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.spacer} />

        <button
          type="button"
          className={styles.logout}
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          <IconLogout width={18} height={18} />
          Cerrar sesión
        </button>
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <h1 style={{ fontSize: '1.375rem' }}>{titulo}</h1>
          {acciones}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
