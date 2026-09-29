import {
  Controller,
  Inject,
  Post,
  Get,
  Body,
  Header,
  UsePipes,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AutenticarUsuarioUseCase } from '../../application/use-cases/autenticar-usuario.use-case.js';
import { RefrescarTokenUseCase } from '../../application/use-cases/refrescar-token.use-case.js';
import { CerrarSesionUseCase } from '../../application/use-cases/cerrar-sesion.use-case.js';
import { ObtenerPerfilUseCase } from '../../application/use-cases/obtener-perfil.use-case.js';
import { VerificarDosFactoresUseCase } from '../../application/use-cases/verificar-dos-factores.use-case.js';
import { ConfigurarDosFactoresUseCase } from '../../application/use-cases/configurar-dos-factores.use-case.js';
import { ActivarDosFactoresUseCase } from '../../application/use-cases/activar-dos-factores.use-case.js';
import { DesactivarDosFactoresUseCase } from '../../application/use-cases/desactivar-dos-factores.use-case.js';
import { LoginSchema, LoginDto, RefreshSchema, RefreshDto } from '../../application/dto/auth.dto.js';
import { VerificarDosFactoresSchema, VerificarDosFactoresDto } from '../../application/dto/verificar-2fa.dto.js';
import { ActivarDosFactoresSchema, ActivarDosFactoresDto } from '../../application/dto/activar-2fa.dto.js';
import {
  ConfigurarDosFactoresInicialSchema,
  ConfigurarDosFactoresInicialDto,
  ActivarDosFactoresInicialSchema,
  ActivarDosFactoresInicialDto,
  DesactivarDosFactoresSchema,
  DesactivarDosFactoresDto,
} from '../../application/dto/dos-factores.dto.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/pipes/zod-validation.pipe.js';
import { Public } from '../security/public.decorator.js';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { ResultadoAuditoria } from '../../../../shared/infrastructure/database/generated/core/enums.js';
import { mapearErrorDominio } from './mapear-error-dominio.js';
import { SolicitudAutenticada, obtenerContextoSolicitud } from './solicitud-autenticada.js';
import type { Request } from 'express';
import argon2 from 'argon2';

// Los intentos también se bloquean por cuenta (5 fallos); este límite frena la fuerza bruta desde una misma IP.
const LIMITE_AUTENTICACION = { default: { limit: 10, ttl: 60_000 } };
const LIMITE_RENOVACION = { default: { limit: 30, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AutenticarUsuarioUseCase) private readonly autenticarUsuario: AutenticarUsuarioUseCase,
    @Inject(RefrescarTokenUseCase) private readonly refrescarToken: RefrescarTokenUseCase,
    @Inject(CerrarSesionUseCase) private readonly cerrarSesion: CerrarSesionUseCase,
    @Inject(ObtenerPerfilUseCase) private readonly obtenerPerfil: ObtenerPerfilUseCase,
    @Inject(VerificarDosFactoresUseCase) private readonly verificarDosFactores: VerificarDosFactoresUseCase,
    @Inject(ConfigurarDosFactoresUseCase) private readonly configurarDosFactores: ConfigurarDosFactoresUseCase,
    @Inject(ActivarDosFactoresUseCase) private readonly activarDosFactores: ActivarDosFactoresUseCase,
    @Inject(DesactivarDosFactoresUseCase) private readonly desactivarDosFactores: DesactivarDosFactoresUseCase,
    @Inject(PrismaCoreService) private readonly prisma: PrismaCoreService,
  ) {}

  @Public()
  @Throttle(LIMITE_AUTENTICACION)
  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() body: LoginDto, @Req() req: Request) {
    const result = await this.autenticarUsuario.execute({
      identificador: body.identificador || body.email,
      passwordRaw: body.password,
      deviceId: body.deviceId,
      ...obtenerContextoSolicitud(req),
    });

    if (result.isFailure) {
      throw new UnauthorizedException(result.error?.message);
    }
    return result.getValue();
  }

  @Public()
  @Throttle(LIMITE_AUTENTICACION)
  @Post('2fa/verificar')
  async verificar(
    @Body(new ZodValidationPipe(VerificarDosFactoresSchema)) body: VerificarDosFactoresDto,
    @Req() req: Request,
  ) {
    const result = await this.verificarDosFactores.execute({
      desafioToken: body.desafioToken,
      codigo: body.codigo,
      ...obtenerContextoSolicitud(req),
    });

    if (result.isFailure) {
      throw mapearErrorDominio(result.error);
    }
    return result.getValue();
  }

  @Public()
  @Throttle(LIMITE_AUTENTICACION)
  @Header('Cache-Control', 'no-store')
  @Post('2fa/inicial/configurar')
  async configurarInicial(
    @Body(new ZodValidationPipe(ConfigurarDosFactoresInicialSchema)) body: ConfigurarDosFactoresInicialDto,
  ) {
    const result = await this.configurarDosFactores.execute({ desafioToken: body.desafioToken });
    if (result.isFailure) {
      throw mapearErrorDominio(result.error);
    }
    return result.getValue();
  }

  @Public()
  @Throttle(LIMITE_AUTENTICACION)
  @Header('Cache-Control', 'no-store')
  @Post('2fa/inicial/activar')
  async activarInicial(
    @Body(new ZodValidationPipe(ActivarDosFactoresInicialSchema)) body: ActivarDosFactoresInicialDto,
    @Req() req: Request,
  ) {
    const result = await this.activarDosFactores.execute({
      identidad: { desafioToken: body.desafioToken },
      codigo: body.codigo,
      ...obtenerContextoSolicitud(req),
    });

    if (result.isFailure) {
      throw mapearErrorDominio(result.error);
    }
    return result.getValue();
  }

  @Throttle(LIMITE_AUTENTICACION)
  @Header('Cache-Control', 'no-store')
  @Post('2fa/configurar')
  async configurar(@Req() req: SolicitudAutenticada) {
    const result = await this.configurarDosFactores.execute({ usuarioId: req.user.sub });
    if (result.isFailure) {
      throw mapearErrorDominio(result.error);
    }
    return result.getValue();
  }

  @Throttle(LIMITE_AUTENTICACION)
  @Header('Cache-Control', 'no-store')
  @Post('2fa/activar')
  async activar(
    @Body(new ZodValidationPipe(ActivarDosFactoresSchema)) body: ActivarDosFactoresDto,
    @Req() req: SolicitudAutenticada,
  ) {
    const result = await this.activarDosFactores.execute({
      identidad: { usuarioId: req.user.sub },
      codigo: body.codigo,
      ...obtenerContextoSolicitud(req),
    });

    if (result.isFailure) {
      throw mapearErrorDominio(result.error);
    }
    return result.getValue();
  }

  @Throttle(LIMITE_AUTENTICACION)
  @Post('2fa/desactivar')
  async desactivar(
    @Body(new ZodValidationPipe(DesactivarDosFactoresSchema)) body: DesactivarDosFactoresDto,
    @Req() req: SolicitudAutenticada,
  ) {
    const result = await this.desactivarDosFactores.execute({
      usuarioId: req.user.sub,
      password: body.password,
      codigo: body.codigo,
      ...obtenerContextoSolicitud(req),
    });

    if (result.isFailure) {
      throw mapearErrorDominio(result.error);
    }
    return { success: true };
  }

  @Public()
  @Throttle(LIMITE_RENOVACION)
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  async refresh(@Body() body: RefreshDto, @Req() req: Request) {
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
  async logout(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
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
  async me(@Req() req: SolicitudAutenticada) {
    const result = await this.obtenerPerfil.execute(req.user.sub);
    if (result.isFailure) {
      throw new UnauthorizedException(result.error?.message);
    }
    return result.getValue();
  }

  @Throttle(LIMITE_AUTENTICACION)
  @Post('verify-password')
  async verifyPassword(@Body('password') password: string, @Req() req: SolicitudAutenticada) {
    if (!password) {
      throw new UnauthorizedException('La contraseña es requerida');
    }
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Sesión no identificada');
    }
    const user = await this.prisma.authUsuario.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, email: true, activo: true, estado: true },
    });
    if (!user || !user.activo || user.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Usuario no válido o bloqueado');
    }
    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      throw new UnauthorizedException('Contraseña institucional incorrecta');
    }
    return { valid: true, email: user.email };
  }
}
