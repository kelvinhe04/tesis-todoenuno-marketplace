import { useEffect, useRef, useState } from 'react'
import { IconChevronDown } from './icons'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  id?: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  size?: 'md' | 'sm'
  width?: string
}

export function Select({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Selecciona...',
  size = 'md',
  width,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const raizRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)

  const seleccionado = options.find((o) => o.value === value)

  useEffect(() => {
    if (!abierto) return

    const onMouseDown = (e: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [abierto])

  const abrir = () => {
    if (disabled) return
    const idx = options.findIndex((o) => o.value === value)
    setActivo(idx >= 0 ? idx : 0)
    setAbierto(true)
  }

  const elegir = (idx: number) => {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    setAbierto(false)
    botonRef.current?.focus()
  }

  const onKeyDownBoton = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      abrir()
      return
    }
    if (abierto) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActivo((i) => Math.min(i + 1, options.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActivo((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        elegir(activo)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setAbierto(false)
      } else if (e.key === 'Tab') {
        setAbierto(false)
      }
    }
  }

  return (
    <div className={styles.wrap} ref={raizRef} style={width ? { width } : undefined}>
      <button
        ref={botonRef}
        id={id}
        type="button"
        className={`${styles.trigger} ${size === 'sm' ? styles.sm : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={onKeyDownBoton}
      >
        <span className={styles.label}>{seleccionado?.label || placeholder}</span>
        <IconChevronDown width={16} height={16} className={`${styles.chevron} ${abierto ? styles.chevronOpen : ''}`} />
      </button>

      {abierto && (
        <ul className={styles.listbox} role="listbox" tabIndex={-1}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.option} ${i === activo ? styles.active : ''} ${opt.value === value ? styles.selected : ''}`}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
