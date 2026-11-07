import { createHash } from 'crypto';
// sharp se carga con require: sus tipos (ESM) no coinciden con el módulo CommonJS de este servicio
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as (entrada: Buffer) => any;

// Las fotos viven en Mongo como data-URI base64 (cada una pesa 200-500 KB). Las respuestas del catálogo ya no
// las incluyen: mandan una URL por foto y el navegador las pide aparte (con caché y, si hace falta, miniatura).

export const RUTA_IMAGEN = (id: string, n: number | string) => `/api/catalogo/${id}/imagen/${n}`;
const PATRON_URL_PROPIA = /^\/api\/catalogo\/[^/]+\/imagen\/(\d+|u)(\?.*)?$/;

export const esDataUri = (s?: string): s is string => !!s && s.startsWith('data:');

// Documento de Mongo -> objeto que se manda al cliente, con URLs en lugar de base64.
// `todas`: false = solo la foto principal (listados); true = todas (detalle).
export function aVista(doc: { toObject: () => any }, todas: boolean) {
  const o = doc.toObject();
  const id = String(o._id);
  const hayImagenes = !!o.imagenes?.length;
  const fotos: string[] = hayImagenes ? o.imagenes : o.imagenUrl ? [o.imagenUrl] : [];
  const vistas = fotos.map((img, i) => (esDataUri(img) ? RUTA_IMAGEN(id, hayImagenes ? i : 'u') : img));
  o.imagenes = todas ? vistas : vistas.slice(0, 1);
  delete o.imagenUrl;
  return o;
}

// Si el vendedor guarda de nuevo una publicación, el formulario devuelve las URLs que recibió: se vuelven a
// convertir en la imagen original guardada (las fotos nuevas siguen llegando como data-URI y pasan tal cual).
export function restaurarOriginales(entradas: string[] | undefined, actuales: string[] | undefined, imagenUrl?: string) {
  if (!entradas) return entradas;
  return entradas.flatMap((e) => {
    const m = PATRON_URL_PROPIA.exec(e);
    if (!m) return [e];
    const original = m[1] === 'u' ? imagenUrl : actuales?.[Number(m[1])];
    return original ? [original] : [];
  });
}

// ---- Servir una foto (original o miniatura) ----
const cache = new Map<string, Buffer>();
const MAX_CACHE = 300;

export function etagDe(id: string, clave: string, img: string, ancho?: number) {
  const huella = createHash('md5').update(`${img.length}:${img.slice(-64)}`).digest('hex').slice(0, 16);
  return `"${id}-${clave}-${ancho ?? 'o'}-${huella}"`;
}

export async function prepararFoto(dataUri: string, ancho: number | undefined, claveCache: string) {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/is.exec(dataUri);
  if (!m) return null;
  const original = Buffer.from(m[2], 'base64');
  if (!ancho) return { tipo: m[1], cuerpo: original };
  const guardada = cache.get(claveCache);
  if (guardada) return { tipo: 'image/jpeg', cuerpo: guardada };
  const cuerpo = await sharp(original)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: ancho, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(claveCache, cuerpo);
  return { tipo: 'image/jpeg', cuerpo };
}
