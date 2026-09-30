import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
  ) {}

  private firmarToken(usuario: Usuario) {
    const payload = { sub: usuario.id, email: usuario.email, rol: usuario.rol };
    return this.jwt.sign(payload);
  }

  private aPublico(usuario: Usuario) {
    return { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
  }

  async registrar(dto: RegistroDto) {
    const existente = await this.usuarios.findOne({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const usuario = await this.usuarios.save(
      this.usuarios.create({ nombre: dto.nombre, email: dto.email, passwordHash, rol: dto.rol }),
    );
    return { token: this.firmarToken(usuario), usuario: this.aPublico(usuario) };
  }

  async login(dto: LoginDto) {
    const usuario = await this.usuarios.findOne({ where: { email: dto.email } });
    if (!usuario || !(await bcrypt.compare(dto.password, usuario.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
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

    let usuario = await this.usuarios.findOne({ where: { email: payload.email } });
    if (!usuario) {
      if (!dto.rol) {
        return { requiereRol: true, nombre: payload.name || payload.email.split('@')[0], email: payload.email };
      }
      usuario = await this.usuarios.save(
        this.usuarios.create({
          nombre: payload.name || payload.email.split('@')[0],
          email: payload.email,
          passwordHash: null,
          rol: dto.rol,
        }),
      );
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
    return { email: usuario.email, nombre: usuario.nombre };
  }
}
