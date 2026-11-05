import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../usuarios/usuario.entity';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { PayloadSesion, revocarSesionesAnteriores, revocarToken, sesiones } from './sesion-revocada';

const SALT_ROUNDS = 10;

// Limite de intentos de login fallidos (fuerza bruta): por correo y por IP, en una ventana de 15 minutos.
// Se desbloquea solo al vencer la ventana; un acierto reinicia el contador del correo.
const MAX_FALLOS_CORREO = 5;
const MAX_FALLOS_IP = 50;
const VENTANA_FALLOS_SEG = 15 * 60;

// Los enlaces de verificacion se firman con un secreto DISTINTO al de las sesiones: asi un token de
// verificacion nunca puede usarse como token de acceso en los demas servicios.
const SECRETO_VERIFICACION = (process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion') + ':verificar-correo';
const NOTIFICACIONES_URL = process.env.NOTIFICACIONES_URL || 'http://notificaciones:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const EXIGIR_VERIFICACION = process.env.EXIGIR_VERIFICACION_CORREO !== 'false';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
  ) {}

  // Los correos se guardan en minusculas y se comparan sin distinguir mayusculas:
  // "Ana@X.com" y "ana@x.com" son la misma cuenta.
  private normalizar(email: string) {
    return email.trim().toLowerCase();
  }

  private buscarPorEmail(email: string) {
    return this.usuarios
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: this.normalizar(email) })
      .getOne();
  }

  private firmarToken(usuario: Usuario) {
    const payload = { sub: usuario.id, email: usuario.email, rol: usuario.rol };
    return this.jwt.sign(payload, { jwtid: randomUUID() });
  }

  private aPublico(usuario: Usuario) {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      fotoUrl: usuario.fotoUrl ?? null,
      emailVerificado: usuario.emailVerificado,
    };
  }

  async registrar(dto: RegistroDto) {
    const existente = await this.buscarPorEmail(dto.email);
    if (existente) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const usuario = await this.usuarios.save(
      this.usuarios.create({ nombre: dto.nombre, email: this.normalizar(dto.email), passwordHash, rol: 'comprador', emailVerificado: false }),
    );
    void this.enviarVerificacion(usuario);
    return { token: this.firmarToken(usuario), usuario: this.aPublico(usuario) };
  }

  // ---- verificacion de correo ----

  private async enviarVerificacion(usuario: Usuario) {
    const token = this.jwt.sign({ sub: usuario.id, email: usuario.email, tipo: 'verificar-correo' }, { secret: SECRETO_VERIFICACION, expiresIn: '24h' });
    const enlace = `${FRONTEND_URL}/verificar-correo?token=${token}`;
    // Entorno de pruebas: el correo va a un buzon sandbox (Ethereal) y nadie lo lee, asi que el enlace
    // tambien queda en el log de este servicio.
    this.logger.log(`Enlace de verificación para ${usuario.email}: ${enlace}`);
    try {
      await fetch(`${NOTIFICACIONES_URL}/notificaciones/internal/correo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatario: usuario.email,
          asunto: 'Verifica tu correo en TodoEnUno',
          texto: `Hola ${usuario.nombre},\n\nConfirma tu correo electrónico entrando a este enlace (vale 24 horas):\n${enlace}\n\nSi no creaste la cuenta, ignora este mensaje.`,
        }),
      });
    } catch (err) {
      this.logger.warn(`No se pudo enviar el correo de verificación a ${usuario.email}: ${err}`);
    }
  }

  async verificarCorreo(token: string) {
    let payload: { sub: string; tipo?: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: SECRETO_VERIFICACION });
    } catch {
      throw new BadRequestException('El enlace de verificación no es válido o ya venció. Pide uno nuevo desde tu cuenta.');
    }
    if (payload.tipo !== 'verificar-correo') {
      throw new BadRequestException('El enlace de verificación no es válido');
    }
    const usuario = await this.usuarios.findOne({ where: { id: payload.sub } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!usuario.emailVerificado) {
      usuario.emailVerificado = true;
      await this.usuarios.save(usuario);
    }
    return { verificado: true, email: usuario.email };
  }

  async reenviarVerificacion(usuarioId: string) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');
    if (usuario.emailVerificado) throw new BadRequestException('Tu correo ya está verificado');
    try {
      const reciente = await sesiones.set(`verificacion:reenvio:${usuarioId}`, '1', 'EX', 60, 'NX');
      if (reciente === null) throw new HttpException('Espera un minuto antes de pedir otro correo', 429);
    } catch (err) {
      if (err instanceof HttpException) throw err;
    }
    await this.enviarVerificacion(usuario);
    return { enviado: true };
  }

  // ---- sesiones ----

  async cerrarSesion(payload: PayloadSesion) {
    await revocarToken(payload);
    return { cerrada: true };
  }

  async cerrarSesionEnTodos(usuarioId: string) {
    // +1: tambien vencen los tokens emitidos en este mismo segundo
    await revocarSesionesAnteriores(usuarioId, Math.floor(Date.now() / 1000) + 1);
    return { cerradas: true };
  }

  // ---- limite de intentos de login ----

  private async comprobarBloqueo(claveCorreo: string, claveIp: string) {
    try {
      const [fallosCorreo, fallosIp] = await sesiones.mget(claveCorreo, claveIp);
      const bloqueadoPorCorreo = Number(fallosCorreo) >= MAX_FALLOS_CORREO;
      if (bloqueadoPorCorreo || Number(fallosIp) >= MAX_FALLOS_IP) {
        const segundos = await sesiones.ttl(bloqueadoPorCorreo ? claveCorreo : claveIp);
        const minutos = Math.max(1, Math.ceil(segundos / 60));
        throw new HttpException(`Demasiados intentos fallidos. Vuelve a intentarlo en ${minutos} min.`, 429);
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
    }
  }

  private async registrarFallo(claveCorreo: string, claveIp: string) {
    try {
      for (const clave of [claveCorreo, claveIp]) {
        const n = await sesiones.incr(clave);
        if (n === 1) await sesiones.expire(clave, VENTANA_FALLOS_SEG);
      }
    } catch {
      // sin Redis no hay limite, pero el login sigue funcionando
    }
  }

  async login(dto: LoginDto, ip = 'desconocida') {
    const claveCorreo = `login:fallos:correo:${this.normalizar(dto.email)}`;
    const claveIp = `login:fallos:ip:${ip}`;
    await this.comprobarBloqueo(claveCorreo, claveIp);
    const usuario = await this.buscarPorEmail(dto.email);
    // Las cuentas creadas solo con Google no tienen contraseña (passwordHash null): mismo 401 genérico
    if (!usuario || !usuario.passwordHash || !(await bcrypt.compare(dto.password, usuario.passwordHash))) {
      await this.registrarFallo(claveCorreo, claveIp);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await sesiones.del(claveCorreo).catch(() => undefined);
    return { token: this.firmarToken(usuario), usuario: this.aPublico(usuario) };
  }

  async loginConGoogle(dto: GoogleLoginDto) {
    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google inválido');
    }
    if (!payload?.email) {
      throw new UnauthorizedException('No se pudo verificar la cuenta de Google');
    }

    let usuario = await this.buscarPorEmail(payload.email);
    if (!usuario) {
      usuario = await this.usuarios.save(
        this.usuarios.create({
          nombre: payload.name || payload.email.split('@')[0],
          email: this.normalizar(payload.email),
          passwordHash: null,
          fotoUrl: payload.picture ?? null,
          rol: 'comprador',
          emailVerificado: true,
        }),
      );
    } else if (payload.picture && usuario.fotoUrl !== payload.picture) {
      usuario.fotoUrl = payload.picture;
      await this.usuarios.save(usuario);
    }
    // Google ya comprobó que el correo es de esa persona
    if (payload.email_verified && !usuario.emailVerificado) {
      usuario.emailVerificado = true;
      await this.usuarios.save(usuario);
    }
    return { token: this.firmarToken(usuario), usuario: this.aPublico(usuario) };
  }

  // Toda cuenta nace como comprador; quien quiera publicar activa el modo vendedor aqui.
  // Es permanente (sus publicaciones, ordenes y reservas dependen de ello) y devuelve un token nuevo con el rol.
  async activarVendedor(usuarioId: string) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (usuario.rol !== 'vendedor') {
      if (EXIGIR_VERIFICACION && !usuario.emailVerificado) {
        throw new ForbiddenException('Verifica tu correo electrónico para activar el modo vendedor. Te enviamos un enlace al registrarte.');
      }
      usuario.rol = 'vendedor';
      await this.usuarios.save(usuario);
    }
    return { token: this.firmarToken(usuario), usuario: this.aPublico(usuario) };
  }

  async obtenerPerfil(usuarioId: string) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return this.aPublico(usuario);
  }

  async actualizarPerfil(usuarioId: string, dto: ActualizarPerfilDto) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (dto.nombre) {
      usuario.nombre = dto.nombre;
    }

    if (dto.passwordNueva) {
      if (usuario.passwordHash && !(await bcrypt.compare(dto.passwordActual, usuario.passwordHash))) {
        throw new UnauthorizedException('La contraseña actual no es correcta');
      }
      usuario.passwordHash = await bcrypt.hash(dto.passwordNueva, SALT_ROUNDS);
    }

    await this.usuarios.save(usuario);
    if (dto.passwordNueva) {
      // Cambiar la contraseña cierra todas las demás sesiones (por si alguien más la tenía abierta) y
      // devuelve un token nuevo para esta.
      await revocarSesionesAnteriores(usuario.id, Math.floor(Date.now() / 1000));
      return { ...this.aPublico(usuario), token: this.firmarToken(usuario) };
    }
    return this.aPublico(usuario);
  }

  async obtenerPerfilPublico(usuarioId: string) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return { id: usuario.id, nombre: usuario.nombre };
  }

  // Uso exclusivo de otros microservicios dentro de la red interna de Docker
  // (p. ej. Notificaciones para enviar correos) — no se expone en el API Gateway.
  async obtenerEmailInterno(usuarioId: string) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return { email: usuario.email, nombre: usuario.nombre, emailVerificado: usuario.emailVerificado };
  }
}
