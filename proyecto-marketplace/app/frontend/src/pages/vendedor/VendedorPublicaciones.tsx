import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { VendorLayout } from '../../components/VendorLayout'
import { useAuth } from '../../context/AuthContext'
import { catalogoApi, imagenPrincipal, type Producto } from '../../lib/api'
import { IconEdit, IconImage, IconTrash } from '../../components/icons'
import styles from './Vendedor.module.css'

export default function VendedorPublicaciones() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const cargar = () => {
    if (!usuario) return
    setCargando(true)
    catalogoApi
      .listar({ vendedorId: usuario.id, limite: 50 })
      .then((pagina) => setProductos(pagina.items))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [usuario])

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta publicación?')) return
    setEliminando(id)
    try {
      await catalogoApi.eliminar(id)
      setProductos((prev) => prev.filter((p) => p._id !== id))
    } finally {
      setEliminando(null)
    }
  }

  return (
    <VendorLayout
      titulo="Mis publicaciones"
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
      ) : productos.length === 0 ? (
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
                <p className="muted" style={{ fontSize: '0.8125rem' }}>
                  {p.tipo === 'producto' ? `Stock: ${p.stock}` : 'Servicio'} · {p.categoria}
                </p>
              </div>
              <span style={{ fontWeight: 700, minWidth: '4rem' }}>${p.precio.toFixed(2)}</span>
              <span className="badge badge-success">Activo</span>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Editar"
                  onClick={() => navigate(`/vendedor/publicaciones/${p._id}/editar`)}
                >
                  <IconEdit width={16} height={16} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Eliminar"
                  disabled={eliminando === p._id}
                  onClick={() => eliminar(p._id)}
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </VendorLayout>
  )
}
