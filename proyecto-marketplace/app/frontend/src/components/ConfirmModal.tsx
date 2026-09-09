import { useEffect } from 'react'
import styles from './ConfirmModal.module.css'

interface Props {
  abierto: boolean
  titulo: string
  mensaje: string
  textoConfirmar?: string
  textoCancelar?: string
  peligro?: boolean
  procesando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export function ConfirmModal({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligro = false,
  procesando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  useEffect(() => {
    if (!abierto) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abierto, onCancelar])

  if (!abierto) return null

  return (
    <div className={styles.overlay} onClick={onCancelar}>
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className={styles.titulo}>
          {titulo}
        </h2>
        <p className={styles.mensaje}>{mensaje}</p>
        <div className={styles.acciones}>
          <button type="button" className="btn" onClick={onCancelar} disabled={procesando}>
            {textoCancelar}
          </button>
          <button
            type="button"
            className={peligro ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirmar}
            disabled={procesando}
          >
            {procesando ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
