// Formateadores y validadores de campos de formulario, compartidos por el checkout y Mi perfil.

export type MarcaTarjeta = 'Visa' | 'Mastercard' | 'American Express' | 'Otra'

// Marca según el primer dígito (suficiente para el sandbox)
export function marcaTarjeta(numero: string): MarcaTarjeta {
  const d = numero.replace(/\D/g, '')
  if (d.startsWith('4')) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'American Express'
  return 'Otra'
}

// American Express tiene 15 dígitos; el resto (Visa, Mastercard y demás) 16
export function largoTarjeta(numero: string): number {
  return marcaTarjeta(numero) === 'American Express' ? 15 : 16
}

// Solo dígitos, con el largo máximo de la marca, agrupados como en la tarjeta:
// "4242424242424242" -> "4242 4242 4242 4242"; Amex "378282246310005" -> "3782 822463 10005"
export function formatearNumeroTarjeta(valor: string): string {
  const todos = valor.replace(/\D/g, '')
  const d = todos.slice(0, largoTarjeta(todos))
  if (largoTarjeta(todos) === 15) return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' ')
  return d.replace(/(\d{4})(?=\d)/g, '$1 ')
}

// null = válido; si no, el mensaje de error
export function validarNumeroTarjeta(valor: string): string | null {
  const d = valor.replace(/\D/g, '')
  const largo = largoTarjeta(d)
  if (d.length !== largo) {
    return `El número de tarjeta debe tener ${largo} dígitos${largo === 15 ? ' (American Express)' : ''}`
  }
  return null
}

// "0229" -> "02/29"; la "/" aparece al escribir el 3.er dígito, así que se puede borrar sin trabarse.
// Un mes que empieza en 2-9 se completa solo ("3" -> "03") y no deja escribir meses mayores a 12.
export function formatearVencimiento(valor: string): string {
  let d = valor.replace(/\D/g, '')
  if (d.length >= 1 && d[0] > '1') d = '0' + d
  if (d.length >= 2 && Number(d.slice(0, 2)) > 12) d = d[0] + d.slice(2)
  if (d.length >= 2 && d.slice(0, 2) === '00') d = d[0] + d.slice(2)
  d = d.slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`
}

const ANIOS_MAXIMOS_VENCIMIENTO = 20

// Fecha de vencimiento MM/AA: mes real (01-12), no vencida (una tarjeta vale hasta el último día
// de su mes) y no absurdamente lejana. null = válido; si no, el mensaje de error.
export function validarVencimiento(valor: string, hoy: Date = new Date()): string | null {
  const m = valor.trim().match(/^(\d{2})\/(\d{2})$/)
  if (!m) return 'El vencimiento debe tener el formato MM/AA'
  const mes = Number(m[1])
  const anio = 2000 + Number(m[2])
  if (mes < 1 || mes > 12) return 'El mes del vencimiento debe estar entre 01 y 12'
  const mesActual = hoy.getFullYear() * 12 + hoy.getMonth()
  const mesTarjeta = anio * 12 + (mes - 1)
  if (mesTarjeta < mesActual) return 'La tarjeta está vencida'
  if (mesTarjeta > mesActual + ANIOS_MAXIMOS_VENCIMIENTO * 12) return 'El año de vencimiento no es válido'
  return null
}

// Para tarjetas ya guardadas: ¿ya venció?
export function estaVencida(vencimiento: string, hoy: Date = new Date()): boolean {
  const error = validarVencimiento(vencimiento, hoy)
  return error === 'La tarjeta está vencida'
}

// "69963888" -> "6996-3888"; el guion aparece al escribir el 5.º dígito (se puede borrar sin trabarse)
export function formatearTelefono(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`
}

// CVV: 4 dígitos en American Express, 3 en las demás
export function largoCvv(marca: MarcaTarjeta): number {
  return marca === 'American Express' ? 4 : 3
}

// Solo dígitos y sin pasar del largo de la marca (se recorta al escribir de más)
export function formatearCvv(valor: string, marca: MarcaTarjeta): string {
  return valor.replace(/\D/g, '').slice(0, largoCvv(marca))
}

export function validarCvv(cvv: string, marca: MarcaTarjeta): string | null {
  const largo = largoCvv(marca)
  return /^\d+$/.test(cvv.trim()) && cvv.trim().length === largo ? null : `El CVV debe tener ${largo} dígitos`
}
