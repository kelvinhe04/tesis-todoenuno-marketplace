import { useState } from 'react'
import { aFechaISO } from '../lib/estado'
import styles from './SelectorFecha.module.css'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
// Semana empezando en domingo (el índice coincide con Date.getDay())
const SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface Props {
  value: string // AAAA-MM-DD
  min: string // AAAA-MM-DD, no se puede elegir antes
  diasPermitidos: Set<number> // Date.getDay() de los días en que hay atención
  onChange: (fecha: string) => void
  diasBloqueados?: Set<string> // fechas concretas sin atención (feriados, vacaciones): no se pueden elegir
  marcados?: Set<string> // modo multi-selección (vendedor): varios días resaltados a la vez
}

// Calendario mensual: los días sin atención (o pasados) salen en gris y no se pueden elegir.
export function SelectorFecha({ value, min, diasPermitidos, onChange, diasBloqueados, marcados }: Props) {
  const [anio, mes] = value.split('-').map(Number)
  const [mesVisible, setMesVisible] = useState({ anio, mes: mes - 1 })

  const primero = new Date(mesVisible.anio, mesVisible.mes, 1)
  const diasEnMes = new Date(mesVisible.anio, mesVisible.mes + 1, 0).getDate()
  const huecosInicio = primero.getDay() // domingo = 0
  const [minAnio, minMes] = min.split('-').map(Number)
  const esMesMinimo = mesVisible.anio === minAnio && mesVisible.mes === minMes - 1

  const moverMes = (delta: number) => {
    const d = new Date(mesVisible.anio, mesVisible.mes + delta, 1)
    setMesVisible({ anio: d.getFullYear(), mes: d.getMonth() })
  }

  return (
    <div className={styles.calendario}>
      <div className={styles.cabecera}>
        <button type="button" onClick={() => moverMes(-1)} disabled={esMesMinimo} aria-label="Mes anterior">
          ‹
        </button>
        <span className={styles.titulo}>
          {MESES[mesVisible.mes]} {mesVisible.anio}
        </span>
        <button type="button" onClick={() => moverMes(1)} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      <div className={styles.grilla}>
        {SEMANA.map((nombre) => (
          <span key={nombre} className={styles.diaSemana}>
            {nombre}
          </span>
        ))}
        {Array.from({ length: huecosInicio }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: diasEnMes }, (_, i) => {
          const dia = i + 1
          const fecha = aFechaISO(new Date(mesVisible.anio, mesVisible.mes, dia))
          const habilitado =
            fecha >= min &&
            diasPermitidos.has(new Date(mesVisible.anio, mesVisible.mes, dia).getDay()) &&
            !diasBloqueados?.has(fecha)
          const seleccionado = marcados ? marcados.has(fecha) : fecha === value
          return (
            <button
              type="button"
              key={dia}
              disabled={!habilitado}
              aria-pressed={seleccionado}
              onClick={() => onChange(fecha)}
              className={`${styles.dia} ${habilitado ? styles.habilitado : ''} ${seleccionado ? styles.seleccionado : ''}`}
            >
              {dia}
            </button>
          )
        })}
      </div>
    </div>
  )
}
