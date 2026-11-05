import Redis from 'ioredis';

// Sesiones revocadas. Los JWT son sin estado (cada servicio los valida solo con el secreto), asi que
// "cerrar sesion" no los invalidaba: seguian sirviendo hasta vencer (1 dia). Para poder revocarlos, auth
// escribe en Redis y TODOS los servicios consultan aqui antes de aceptar un token:
//   sesion:revocada:<jti>        -> ese token concreto se cerro (expira junto con el token)
//   sesion:valida-desde:<userId> -> los tokens emitidos antes de ese instante ya no valen
//                                   (cambio de contrasena o "cerrar sesion en todos los dispositivos")
// Si Redis no responde NO se bloquea a nadie (disponibilidad antes que revocacion inmediata).
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
redis.on('error', () => undefined);

export const sesiones = redis;

export interface PayloadSesion {
  sub: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export async function sesionRevocada(p: PayloadSesion): Promise<boolean> {
  try {
    const [porToken, desde] = await redis.mget(`sesion:revocada:${p.jti ?? '-'}`, `sesion:valida-desde:${p.sub}`);
    if (porToken) return true;
    if (desde && p.iat !== undefined && p.iat < Number(desde)) return true;
    return false;
  } catch {
    return false;
  }
}

export async function revocarToken(p: PayloadSesion): Promise<void> {
  if (!p.jti) return;
  const ttl = Math.max(1, (p.exp ?? Math.floor(Date.now() / 1000) + 86400) - Math.floor(Date.now() / 1000));
  await redis.set(`sesion:revocada:${p.jti}`, '1', 'EX', ttl);
}

// Invalida todos los tokens emitidos ANTES de `desdeSegundos` (los emitidos en ese segundo o despues valen)
export async function revocarSesionesAnteriores(userId: string, desdeSegundos: number): Promise<void> {
  await redis.set(`sesion:valida-desde:${userId}`, String(desdeSegundos), 'EX', 2 * 86400);
}
