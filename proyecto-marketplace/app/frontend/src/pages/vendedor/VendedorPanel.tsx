import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { VendorLayout } from '../../components/VendorLayout'
import { useAuth } from '../../context/AuthContext'
import { catalogoApi, imagenPrincipal, ordenesApi, type Orden, type Producto } from '../../lib/api'
import { IconImage } from '../../components/icons'
import { Stars } from '../../components/Stars'
import styles from './Vendedor.module.css'

export default function VendedorPanel() {
  const { usuario } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [totalProductos, setTotalProductos] = useState(0)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) return
    Promise.all([
      catalogoApi.listar({ vendedorId: usuario.id, limite: 5 }),
      ordenesApi.listarVendedor(),
    ])
      .then(([pagina, listaOrdenes]) => {
        setProductos(pagina.items)
        setTotalProductos(pagina.total)
        setOrdenes(listaOrdenes)
      })
      .finally(() => setCargando(false))
  }, [usuario])

  if (!usuario) return null

  const ordenesPendientes = ordenes.filter((o) => o.estadoEntrega === 'pendiente').length

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const ventasDelMes = ordenes.reduce((acc, orden) => {
    if (orden.estadoPago !== 'pagada' || new Date(orden.creadoEn) < inicioMes) return acc
    const propios = orden.items.filter((it) => it.vendedorId === usuario.id)
    return acc + propios.reduce((s, it) => s + it.subtotal, 0)
  }, 0)

  return (
    <VendorLayout
      titulo="Panel de vendedor"
      acciones={
        <Link to="/vendedor/publicaciones/nueva" className="btn btn-primary btn-sm">
          + Nueva publicación
        </Link>
      }
    >
      {cargando ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className={styles.statsRow}>
            <div className={`card ${styles.statCard}`}>
              <span className={styles.statLabel}>Publicaciones activas</span>
              <span className={styles.statValue}>{totalProductos}</span>
            </div>
            <div className={`card ${styles.statCard}`}>
              <span className={styles.statLabel}>Órdenes pendientes</span>
              <span className={styles.statValue}>{ordenesPendientes}</span>
            </div>
            <div className={`card ${styles.statCard}`}>
              <span className={styles.statLabel}>Ventas del mes</span>
              <span className={styles.statValue}>${ventasDelMes.toFixed(2)}</span>
            </div>
          </div>

          <div className={styles.sectionHeading}>
            <h2 style={{ fontSize: '1.0625rem' }}>Publicaciones recientes</h2>
            <Link to="/vendedor/publicaciones" className="muted" style={{ fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Ver todas →
            </Link>
          </div>

          {productos.length === 0 ? (
            <div className="empty-state">
              <p>Todavía no tienes publicaciones.</p>
              <Link to="/vendedor/publicaciones/nueva" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Crear la primera
              </Link>
            </div>
          ) : (
            <div className={styles.table}>
              {productos.map((p) => (
                <div key={p._id} className={`card ${styles.tableRow}`}>
                  <div className={`${styles.thumb} ${p.tipo === 'producto' ? styles.blanco : ''}`}>
                    {imagenPrincipal(p) ? (
                      <img
                        src={imagenPrincipal(p)}
                        alt={p.nombre}
                        className={p.tipo === 'producto' ? styles.contain : styles.cover}
                      />
                    ) : (
                      <IconImage width={20} height={20} />
                    )}
                  </div>
                  <div className={styles.rowInfo}>
                    <p style={{ fontWeight: 700 }}>{p.nombre}</p>
                    <Stars valor={p.calificacionPromedio} size={12} />
                  </div>
                  <span style={{ fontWeight: 700 }}>${p.precio.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </VendorLayout>
  )
}
