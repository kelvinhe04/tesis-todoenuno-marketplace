import type { Resena } from '../lib/api'
import { Stars } from './Stars'
import styles from './ResumenResenas.module.css'

// Resumen tipo marketplace: promedio grande + cuántas reseñas tiene cada cantidad de estrellas.
export function ResumenResenas({ resenas }: { resenas: Resena[] }) {
  const total = resenas.length
  if (total === 0) return null
  const promedio = resenas.reduce((acc, r) => acc + r.calificacion, 0) / total
  const conteo = [5, 4, 3, 2, 1].map((n) => ({ n, cantidad: resenas.filter((r) => r.calificacion === n).length }))

  return (
    <aside className={`card ${styles.resumen}`} aria-label="Resumen de calificaciones">
      <p className={styles.promedio}>{promedio.toFixed(1)}</p>
      <Stars valor={promedio} size={18} />
      <p className={styles.total}>
        {total} {total === 1 ? 'reseña' : 'reseñas'}
      </p>
      <ul className={styles.barras}>
        {conteo.map(({ n, cantidad }) => (
          <li key={n} className={styles.fila}>
            <span className={styles.estrella}>{n} ★</span>
            <span className={styles.pista}>
              <span className={styles.relleno} style={{ width: `${(cantidad / total) * 100}%` }} />
            </span>
            <span className={styles.cantidad}>{cantidad}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
