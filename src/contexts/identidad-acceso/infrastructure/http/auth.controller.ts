import {
  Controller,
  Inject,
  Post,
  Get,
  Body,
  UsePipes,
  Req,
} from '@nestjs/common';
import { AutenticarUsuarioUseCase } from '../../application/use-cases/autenticar-usuario.use-case.js';
import { RefrescarTokenUseCase } from '../../application/use-cases/refrescar-token.use-case.js';
import { CerrarSesionUseCase } from '../../application/use-cases/cerrar-sesion.use-case.js';
import { ObtenerPerfilUseCase } from '../../application/use-cases/obtener-perfil.use-case.js';
import { LoginSchema, LoginDto, RefreshSchema, RefreshDto } from '../../application/dto/auth.dto.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/pipes/zod-validation.pipe.js';
import { Public } from '../security/public.decorator.js';
import { UnauthorizedException } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AutenticarUsuarioUseCase) private readonly autenticarUsuario: AutenticarUsuarioUseCase,
    @Inject(RefrescarTokenUseCase) private readonly refrescarToken: RefrescarTokenUseCase,
    @Inject(CerrarSesionUseCase) private readonly cerrarSesion: CerrarSesionUseCase,
    @Inject(ObtenerPerfilUseCase) private readonly obtenerPerfil: ObtenerPerfilUseCase,
  ) {}

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() body: LoginDto, @Req() req: any) {
    const result = await this.autenticarUsuario.execute({
      identificador: body.identificador || body.email,
      passwordRaw: body.password,
      deviceId: body.deviceId,
      ipOrigen: req.ip,
    });

    if (result.isFailure) {
      throw new UnauthorizedException(result.error?.message);
    }
    return result.getValue();
  }

  @Public()
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  async refresh(@Body() body: RefreshDto, @Req() req: any) {
    const result = await this.refrescarToken.execute({
      rawToken: body.refreshToken,
      deviceId: body.deviceId,
      ipOrigen: req.ip,
    });

    if (result.isFailure) {
      throw new UnauthorizedException(result.error?.message);
    }
    return result.getValue();
  }

  @Public()
  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    if (refreshToken) {
      await this.cerrarSesion.execute(refreshToken);
    }
    return { success: true };
  }

  @Get('me')
  async me(@Req() req: any) {
    const result = await this.obtenerPerfil.execute(req.user.sub);
    if (result.isFailure) {
      throw new UnauthorizedException(result.error?.message);
    }
    return result.getValue();
  }
}
