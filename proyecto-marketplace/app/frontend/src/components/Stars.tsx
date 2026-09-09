import { IconStar } from './icons'

export function Stars({ valor, size = 15 }: { valor: number; size?: number }) {
  const redondeado = Math.round(valor)
  return (
    <div
      style={{ display: 'inline-flex', gap: 2, color: 'oklch(70% 0.15 75)' }}
      aria-label={`${valor.toFixed(1)} de 5 estrellas`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar key={i} width={size} height={size} filled={i < redondeado} />
      ))}
    </div>
  )
}
