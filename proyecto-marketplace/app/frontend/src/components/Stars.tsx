import { IconStar } from './icons'

// Estrellas con relleno parcial: 4.5 pinta cuatro completas y la quinta a la mitad, 4.2 al 20 %, etc.
// Con `resenas` (cantidad) muestra además el puntaje y el total: "4.5 (9)" o "Sin reseñas".
export function Stars({ valor, size = 15, resenas }: { valor: number; size?: number; resenas?: number }) {
  const estrellas = (
    <div
      style={{ display: 'inline-flex', gap: 2, color: 'oklch(70% 0.15 75)' }}
      aria-label={`${valor.toFixed(1)} de 5 estrellas`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const llena = Math.min(1, Math.max(0, valor - i))
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
            <span style={{ color: 'var(--color-border-strong)', display: 'inline-flex' }}>
              <IconStar width={size} height={size} filled />
            </span>
            {llena > 0 && (
              <span style={{ position: 'absolute', inset: 0, width: `${llena * 100}%`, overflow: 'hidden', display: 'inline-flex' }}>
                <IconStar width={size} height={size} filled style={{ flex: 'none' }} />
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
  if (resenas === undefined) return estrellas
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
      {estrellas}
      {resenas > 0 ? (
        <span>
          <b style={{ color: 'var(--color-text)', fontWeight: 700 }}>{valor.toFixed(1)}</b> ({resenas})
        </span>
      ) : (
        <span>Sin reseñas</span>
      )}
    </div>
  )
}
