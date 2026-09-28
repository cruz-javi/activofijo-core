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
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { ResultadoAuditoria } from '../../../../shared/infrastructure/database/generated/core/enums.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AutenticarUsuarioUseCase) private readonly autenticarUsuario: AutenticarUsuarioUseCase,
    @Inject(RefrescarTokenUseCase) private readonly refrescarToken: RefrescarTokenUseCase,
    @Inject(CerrarSesionUseCase) private readonly cerrarSesion: CerrarSesionUseCase,
    @Inject(ObtenerPerfilUseCase) private readonly obtenerPerfil: ObtenerPerfilUseCase,
    @Inject(PrismaCoreService) private readonly prisma: PrismaCoreService,
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
  async logout(@Body('refreshToken') refreshToken: string, @Req() req: any) {
    let emailUsuario = 'usuario@uagrm.edu.bo';
    if (refreshToken) {
      const email = await this.cerrarSesion.execute(refreshToken);
      if (email) emailUsuario = email;
    }

    const clientIp = (req?.headers?.['x-forwarded-for'] as string) || req?.ip || '127.0.0.1';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'Browser';

    try {
      await this.prisma.authAuditoriaForense.create({
        data: {
          emailUsuario,
          accion: 'LOGOUT',
          modulo: 'AUTENTICACION',
          resultado: ResultadoAuditoria.EXITOSO,
          motivoRechazo: 'Cierre de sesión seguro',
          ipOrigen: clientIp,
          userAgent,
        },
      });
    } catch (e) {
      console.warn(`Error al registrar logout en bitácora: ${(e as Error).message}`);
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
