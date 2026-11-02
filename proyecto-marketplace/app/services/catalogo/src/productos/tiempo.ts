// Fecha y hora "de ahora" en la zona horaria del negocio. Los contenedores corren en UTC
// (5 horas adelante de Panamá), así que no se puede usar new Date() directo para decidir
// qué día es hoy ni qué horarios ya pasaron.
export const ZONA_NEGOCIO = process.env.TZ_NEGOCIO || 'America/Panama';

export function ahoraEnNegocio(instante: Date = new Date()): { fecha: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
  };
}

// '14:30' -> 870
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// ¿Ese horario ya pasó? Un día anterior a hoy pasó entero; hoy pasa lo que empezó a la hora actual o antes.
export function yaPaso(fecha: string, horaInicio: string, ahora: { fecha: string; minutos: number }): boolean {
  if (fecha < ahora.fecha) return true;
  return fecha === ahora.fecha && aMinutos(horaInicio) <= ahora.minutos;
}
