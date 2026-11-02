import { UMBRAL_POCO_STOCK } from '../lib/estado'
import styles from './StockBadge.module.css'

interface Props {
  stock: number
  // En tarjetas solo interesa avisar cuando queda poco o se agotó
  soloAlertas?: boolean
}

// Indicador de disponibilidad para el comprador: nunca muestra la cantidad exacta.
export function StockBadge({ stock, soloAlertas = false }: Props) {
  if (stock <= 0) {
    return <span className={`${styles.badge} ${styles.agotado}`}>Agotado</span>
  }
  if (stock < UMBRAL_POCO_STOCK) {
    return (
      <span className={`${styles.badge} ${styles.poco}`} role="status">
        <span className={styles.punto} aria-hidden="true" />
        ¡Quedan pocos!
      </span>
    )
  }
  if (soloAlertas) return null
  return (
    <span className={`${styles.badge} ${styles.ok}`}>
      <span className={styles.punto} aria-hidden="true" />
      Disponible
    </span>
  )
}
