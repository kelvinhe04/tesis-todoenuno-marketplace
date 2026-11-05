import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { VerificarCorreoDto } from './dto/verificar-correo.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

// IP del cliente: el gateway (KrakenD) la manda en X-Forwarded-For
function ipDe(request: any): string {
  const reenviada = request.headers['x-forwarded-for'];
  const primera = (Array.isArray(reenviada) ? reenviada[0] : reenviada)?.split(',')[0]?.trim();
  return primera || request.ip || 'desconocida';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  registrar(@Body() dto: RegistroDto) {
    return this.authService.registrar(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: any) {
    return this.authService.login(dto, ipDe(request));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() request: any) {
    return this.authService.cerrarSesion(request.usuario);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-todos')
  logoutTodos(@Req() request: any) {
    return this.authService.cerrarSesionEnTodos(request.usuario.sub);
  }

  @Post('verificar-correo')
  verificarCorreo(@Body() dto: VerificarCorreoDto) {
    return this.authService.verificarCorreo(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reenviar-verificacion')
  reenviarVerificacion(@Req() request: any) {
    return this.authService.reenviarVerificacion(request.usuario.sub);
  }

  @Post('google')
  loginConGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginConGoogle(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: any) {
    return this.authService.obtenerPerfil(request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/vendedor')
  activarVendedor(@Req() request: any) {
    return this.authService.activarVendedor(request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  actualizarPerfil(@Req() request: any, @Body() dto: ActualizarPerfilDto) {
    return this.authService.actualizarPerfil(request.usuario.sub, dto);
  }

  @Get('usuarios/:id')
  perfilPublico(@Param('id') id: string) {
    return this.authService.obtenerPerfilPublico(id);
  }

  // Uso exclusivo de otros microservicios (no se expone en el API Gateway).
  @Get('internal/email/:id')
  emailInterno(@Param('id') id: string) {
    return this.authService.obtenerEmailInterno(id);
  }
}
