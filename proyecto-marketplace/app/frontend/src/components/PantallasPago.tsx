import { IconCheck, IconClose } from './icons'
import styles from '../pages/Checkout.module.css'

// Pantallas de "Confirmando pago" y de resultado, compartidas por el checkout y la vuelta de PayU

export function PantallaConfirmando({ pasarela }: { pasarela: string }) {
  return (
    <div className={styles.confirmando} role="status" aria-live="polite">
      <div className={styles.anillo} />
      <h1 style={{ fontSize: '1.375rem', marginBottom: '0.5rem' }}>Confirmando tu pago…</h1>
      <p className="muted">Estamos verificando la aprobación con {pasarela}. No cierres esta ventana.</p>
    </div>
  )
}

export function PantallaResultado({ aprobado, motivo, onVerOrdenes }: { aprobado: boolean; motivo?: string; onVerOrdenes: () => void }) {
  return (
    <div className={styles.resultado}>
      <div
        className={styles.resultadoIcono}
        style={{
          background: aprobado ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
          color: aprobado ? 'var(--color-success)' : 'var(--color-danger)',
        }}
      >
        {aprobado ? <IconCheck width={32} height={32} /> : <IconClose width={30} height={30} />}
      </div>
      <h1 className={styles.resultadoTitulo} style={{ fontSize: '1.375rem', marginBottom: '0.5rem' }}>
        {aprobado ? 'Pago aprobado' : 'Pago rechazado'}
      </h1>
      <p className={`muted ${styles.resultadoTexto}`} style={{ marginBottom: '1.5rem' }}>
        {aprobado
          ? 'Tu orden fue creada y el pago quedó confirmado (entorno de prueba / sandbox).'
          : motivo || 'El pago no pudo procesarse. Puedes revisar el estado en Mis órdenes.'}
      </p>
      <button type="button" className={`btn btn-primary ${styles.resultadoBoton}`} onClick={onVerOrdenes}>
        Ver mis órdenes
      </button>
    </div>
  )
}
