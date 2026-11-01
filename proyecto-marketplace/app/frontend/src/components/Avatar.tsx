import { IconUser } from './icons'

interface Props {
  fotoUrl?: string | null
  nombre?: string
  size: number
}

// Foto de perfil (p. ej. la de Google); si no hay, muestra el icono genérico.
export function Avatar({ fotoUrl, nombre, size }: Props) {
  if (!fotoUrl) return <IconUser width={size} height={size} />
  return (
    <img
      src={fotoUrl}
      alt={nombre ? `Foto de ${nombre}` : 'Foto de perfil'}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
    />
  )
}
