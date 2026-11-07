import { useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  // Tercer botón opcional (p. ej. "Guardar" junto a "Descartar" y "Seguir editando")
  textoExtra?: string
  onExtra?: () => void
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
  textoExtra,
  onExtra,
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

  // En un portal para no heredar estilos (p. ej. texto blanco) del contenedor donde se use
  return createPortal(
    <div className={styles.overlay} onClick={onCancelar}>
      <div
        className={styles.modal}
        style={textoExtra ? { maxWidth: '31rem' } : undefined}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className={styles.titulo}>
          {titulo}
        </h2>
        <p className={styles.mensaje}>{mensaje}</p>
        <div className={styles.acciones} style={textoExtra ? { justifyContent: 'center' } : undefined}>
          <button type="button" className="btn" onClick={onCancelar} disabled={procesando}>
            {textoCancelar}
          </button>
          {textoExtra && onExtra && (
            <button type="button" className="btn btn-primary" onClick={onExtra} disabled={procesando}>
              {procesando ? 'Guardando...' : textoExtra}
            </button>
          )}
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
    </div>,
    document.body,
  )
}
