import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  registrar(@Body() dto: RegistroDto) {
    return this.authService.registrar(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
