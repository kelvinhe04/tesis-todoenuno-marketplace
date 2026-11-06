import type { Resena } from '../lib/api'
import { Stars } from './Stars'
import styles from './ResumenResenas.module.css'

interface Props {
  resenas: Resena[]
  // Filtro por estrellas: si hay una seleccionada, solo se listan las reseñas con esa calificación
  seleccion: number | null
  onSeleccionar: (estrellas: number | null) => void
}

// Resumen tipo marketplace: promedio grande + cuántas reseñas tiene cada cantidad de estrellas (cada fila filtra la lista).
export function ResumenResenas({ resenas, seleccion, onSeleccionar }: Props) {
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
          <li key={n}>
            <button
              type="button"
              className={`${styles.fila} ${seleccion === n ? styles.activa : ''}`}
              disabled={cantidad === 0}
              aria-pressed={seleccion === n}
              title={cantidad === 0 ? 'No hay reseñas con esta calificación' : `Ver solo las de ${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
              onClick={() => onSeleccionar(seleccion === n ? null : n)}
            >
              <span className={styles.estrella}>{n} ★</span>
              <span className={styles.pista}>
                <span className={styles.relleno} style={{ width: `${(cantidad / total) * 100}%` }} />
              </span>
              <span className={styles.cantidad}>{cantidad}</span>
            </button>
          </li>
        ))}
      </ul>
      {seleccion !== null && (
        <button type="button" className={styles.quitar} onClick={() => onSeleccionar(null)}>
          Quitar filtro
        </button>
      )}
    </aside>
  )
}
