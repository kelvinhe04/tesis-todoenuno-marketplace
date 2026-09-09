import type { Rol } from '../lib/api'
import { IconCart, IconWrench } from './icons'
import styles from './RolGoogleModal.module.css'

interface Props {
  abierto: boolean
  nombre: string
  procesando: boolean
  onElegir: (rol: Rol) => void
}

export function RolGoogleModal({ abierto, nombre, procesando, onElegir }: Props) {
  if (!abierto) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="rol-google-title">
        <h2 id="rol-google-title" className={styles.titulo}>
          ¡Hola, {nombre}!
        </h2>
        <p className={styles.mensaje}>Es tu primera vez con esta cuenta de Google. ¿Cómo quieres usar TodoEnUno?</p>
        <div className={styles.opciones}>
          <button type="button" className={styles.opcion} disabled={procesando} onClick={() => onElegir('comprador')}>
            <IconCart width={24} height={24} />
            Quiero comprar
          </button>
          <button type="button" className={styles.opcion} disabled={procesando} onClick={() => onElegir('vendedor')}>
            <IconWrench width={24} height={24} />
            Quiero vender
          </button>
        </div>
        {procesando && <p className={styles.procesando}>Creando tu cuenta...</p>}
      </div>
    </div>
  )
}
