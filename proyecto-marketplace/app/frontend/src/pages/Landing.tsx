import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { VistosRecientemente } from '../components/VistosRecientemente'
import { IconCpu, IconHome, IconShirt, IconSparkle, IconStar, IconWrench } from '../components/icons'
import { catalogoApi, type Producto } from '../lib/api'
import styles from './Landing.module.css'

const CATEGORIAS = [
  { nombre: 'Electrónica', icono: IconCpu },
  { nombre: 'Hogar', icono: IconHome },
  { nombre: 'Moda', icono: IconShirt },
  { nombre: 'Servicios profesionales', icono: IconWrench },
  { nombre: 'Belleza', icono: IconSparkle },
]

export default function Landing() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    catalogoApi
      .listar({ limite: 8 })
      .then((pagina) => setProductos(pagina.items))
      .finally(() => setCargando(false))
  }, [])

  return (
    <div className="container">
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Productos y servicios de vendedores independientes</span>
          <h1>Compra y vende productos y servicios en un solo lugar</h1>
          <p>
            TodoEnUno reúne a vendedores y profesionales independientes en un solo lugar: compra productos o
            contrata un servicio, con pago seguro y todo en un mismo carrito.
          </p>
          <div className={styles.heroActions}>
            <Link to="/catalogo" className="btn btn-primary">
              Explorar catálogo
            </Link>
            <Link to="/registro" className="btn">
              Vender en TodoEnUno
            </Link>
          </div>
        </div>

        <div className={styles.stage} aria-hidden="true">
          <div className={styles.stageBlob} />
          <div className={styles.stageBadge}>
            <IconStar filled width={13} height={13} />
            4.9
          </div>
          <div className={styles.stageCardA}>
            <IconHome width={34} height={34} />
            <span>Cerámica artesanal</span>
          </div>
          <div className={styles.stagePrice}>$38.00</div>
          <div className={styles.stageCardB}>
            <IconWrench width={30} height={30} />
            <span>Servicios</span>
          </div>
        </div>
      </section>

      <div className={styles.cats}>
        {CATEGORIAS.map(({ nombre, icono: Icono }) => (
          <Link key={nombre} to={`/catalogo?categoria=${encodeURIComponent(nombre)}`} className={styles.catCard}>
            <span className={styles.catIcon}>
              <Icono width={22} height={22} />
            </span>
            {nombre}
          </Link>
        ))}
      </div>

      <section>
        <div className={styles.sectionHeading}>
          <h2 style={{ fontSize: '1.25rem' }}>Productos y servicios destacados</h2>
          <Link to="/catalogo" className="muted" style={{ fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            Ver todo →
          </Link>
        </div>

        {cargando ? (
          <div className="center-loading">
            <div className="spinner" />
          </div>
        ) : productos.length === 0 ? (
          <div className="empty-state">Todavía no hay publicaciones. ¡Sé el primer vendedor!</div>
        ) : (
          <div className={styles.grid}>
            {productos.map((p) => (
              <ProductCard key={p._id} producto={p} />
            ))}
          </div>
        )}
      </section>

      <VistosRecientemente />
    </div>
  )
}
