import { IconCheck } from './icons'
import styles from './AuthExito.module.css'

export function AuthExito({ mostrar, mensaje }: { mostrar: boolean; mensaje: string }) {
  if (!mostrar) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.tarjeta}>
        <div className={styles.check}>
          <IconCheck width={30} height={30} />
        </div>
        <p>{mensaje}</p>
      </div>
    </div>
  )
}
