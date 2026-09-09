import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (resp: { credential: string }) => void
          }) => void
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let scriptCargado: Promise<void> | null = null

function cargarScript(): Promise<void> {
  if (scriptCargado) return scriptCargado
  scriptCargado = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'))
    document.head.appendChild(script)
  })
  return scriptCargado
}

export function GoogleLoginButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelado = false

    cargarScript()
      .then(() => {
        if (cancelado || !contenedorRef.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => onCredential(resp.credential),
        })
        window.google.accounts.id.renderButton(contenedorRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: String(contenedorRef.current.offsetWidth || 336),
        })
      })
      .catch(() => {
        // Si falla la carga del script, el botón simplemente no aparece.
      })

    return () => {
      cancelado = true
    }
  }, [onCredential])

  if (!CLIENT_ID) return null

  return <div ref={contenedorRef} style={{ display: 'flex', justifyContent: 'center' }} />
}
