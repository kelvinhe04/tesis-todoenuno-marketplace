import { IconStar } from './icons'

// Estrellas con relleno parcial: 4.5 pinta cuatro completas y la quinta a la mitad, 4.2 al 20 %, etc.
export function Stars({ valor, size = 15 }: { valor: number; size?: number }) {
  return (
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
}
