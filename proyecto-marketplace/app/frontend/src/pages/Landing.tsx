import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { VistosRecientemente } from '../components/VistosRecientemente'
import { BotonVender } from '../components/BotonVender'
import { IconArrowRight, IconCpu, IconHome, IconShirt, IconSparkle, IconStar, IconWrench } from '../components/icons'
import { catalogoApi, type Producto } from '../lib/api'
import styles from './Landing.module.css'

const CATEGORIAS = [
  { nombre: 'Electrónica', icono: IconCpu },
  { nombre: 'Hogar', icono: IconHome },
  { nombre: 'Moda', icono: IconShirt },
  { nombre: 'Servicios profesionales', icono: IconWrench },
  { nombre: 'Belleza', icono: IconSparkle },
]

// Destacados de la última visita: al volver atrás se pintan al instante y se refrescan en segundo plano
let destacadosCache: Producto[] | null = null

export default function Landing() {
  const [productos, setProductos] = useState<Producto[]>(destacadosCache ?? [])
  const [cargando, setCargando] = useState(destacadosCache === null)

  useEffect(() => {
    // Destacados: los 4 productos y los 4 servicios mejor calificados, intercalados
    Promise.all([
      catalogoApi.listar({ tipo: 'producto', orden: 'mejor_calificados', limite: 4 }),
      catalogoApi.listar({ tipo: 'servicio', orden: 'mejor_calificados', limite: 4 }),
    ])
      .then(([prods, servs]) => {
        const mezcla: Producto[] = []
        for (let i = 0; i < 4; i++) {
          if (prods.items[i]) mezcla.push(prods.items[i])
          if (servs.items[i]) mezcla.push(servs.items[i])
        }
        destacadosCache = mezcla
        setProductos(mezcla)
      })
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
            <BotonVender texto="Vender en TodoEnUno" textoVendedor="Mi panel de vendedor" />
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
            <span>Hogar</span>
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
            Ver todo <IconArrowRight width={14} height={14} style={{ marginLeft: '0.25rem', verticalAlign: '-2px' }} />
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

      <section className={styles.bannerVender}>
        <div>
          <h2>¿Tienes algo que ofrecer?</h2>
          <p>
            Publica tus productos o servicios desde la misma cuenta con la que compras. Activarlo toma un clic y no
            tiene costo.
          </p>
        </div>
        <BotonVender className="btn btn-primary" texto="Quiero vender" textoVendedor="Ir a mi panel de vendedor" />
      </section>

      <VistosRecientemente />
    </div>
  )
}
