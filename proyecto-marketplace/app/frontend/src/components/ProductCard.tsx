import { Link } from 'react-router-dom'
import { imagenPrincipal, type Producto } from '../lib/api'
import { IconImage } from './icons'
import { Stars } from './Stars'
import styles from './ProductCard.module.css'

const TONOS = ['thumb1', 'thumb2', 'thumb3', 'thumb4', 'thumb5', 'thumb6']

function tonoPara(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return TONOS[hash % TONOS.length]
}

export function ProductCard({ producto }: { producto: Producto }) {
  const imagen = imagenPrincipal(producto)
  const esProducto = producto.tipo === 'producto'
  return (
    <Link to={`/productos/${producto._id}`} className={`card ${styles.card}`}>
      <div className={`${styles.imageWrap} ${imagen && esProducto ? styles.blanco : styles[tonoPara(producto._id)]}`}>
        {imagen ? (
          <img
            src={imagen}
            alt={producto.nombre}
            className={`${styles.thumb} ${esProducto ? styles.contain : styles.cover}`}
          />
        ) : (
          <IconImage width={40} height={40} />
        )}
      </div>
      <div className={styles.body}>
        <span className={`badge badge-neutral ${styles.tipoBadge}`}>
          {producto.tipo === 'producto' ? 'Producto' : 'Servicio'}
        </span>
        {producto.marca && <span className={styles.marca}>{producto.marca}</span>}
        <h3 className={styles.nombre}>{producto.nombre}</h3>
        <Stars valor={producto.calificacionPromedio} />
        <div className={styles.footer}>
          <span className={styles.precio}>${producto.precio.toFixed(2)}</span>
          {producto.tipo === 'producto' && producto.stock <= 3 && producto.stock > 0 && (
            <span className="hint-text">¡Últimas {producto.stock}!</span>
          )}
          {producto.tipo === 'producto' && producto.stock === 0 && (
            <span className="badge badge-danger">Agotado</span>
          )}
        </div>
      </div>
    </Link>
  )
}
