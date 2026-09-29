import { Injectable, Inject } from '@nestjs/common';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../domain/ports/usuario-repository.port.js';
import {
  DOS_FACTORES_REPOSITORY_PORT,
  DosFactoresRepositoryPort,
} from '../domain/ports/dos-factores-repository.port.js';
import { TOTP_PORT, TotpPort } from '../domain/ports/totp.port.js';
import { SECRETO_CIFRADO_PORT, SecretoCifradoPort } from '../domain/ports/secreto-cifrado.port.js';
import { CODIGOS_RESPALDO_PORT, CodigosRespaldoPort } from '../domain/ports/codigos-respaldo.port.js';
import { AUDITORIA_ACCESO_PORT, AuditoriaAccesoPort } from '../domain/ports/auditoria-acceso.port.js';
import { Usuario } from '../domain/entities/usuario.entity.js';

export type MetodoDosFactores = 'TOTP' | 'RESPALDO';

const FORMATO_CODIGO_TOTP = /^\d{6}$/;

@Injectable()
export class ValidadorCodigoDosFactoresService {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(DOS_FACTORES_REPOSITORY_PORT) private readonly dosFactoresRepo: DosFactoresRepositoryPort,
    @Inject(TOTP_PORT) private readonly totp: TotpPort,
    @Inject(SECRETO_CIFRADO_PORT) private readonly cifrado: SecretoCifradoPort,
    @Inject(CODIGOS_RESPALDO_PORT) private readonly codigosRespaldo: CodigosRespaldoPort,
    @Inject(AUDITORIA_ACCESO_PORT) private readonly auditoria: AuditoriaAccesoPort,
  ) {}

  async validar(usuario: Usuario, codigo: string, permitirRespaldo: boolean): Promise<MetodoDosFactores | null> {
    if (FORMATO_CODIGO_TOTP.test(codigo)) {
      return (await this.validarTotp(usuario, codigo)) ? 'TOTP' : null;
    }
    if (permitirRespaldo && (await this.consumirCodigoRespaldo(usuario.id, codigo))) {
      return 'RESPALDO';
    }
    return null;
  }

  // Devuelve true si el fallo dejó la cuenta bloqueada.
  async registrarFallo(
    usuario: Usuario,
    accion: string,
    contexto: { ipOrigen?: string; userAgent?: string },
  ): Promise<boolean> {
    usuario.registrarIntentoFallido();
    await this.usuarioRepo.save(usuario);

    const bloqueado = usuario.estaBloqueado();
    await this.auditoria.registrar({
      emailUsuario: usuario.email,
      accion,
      resultado: bloqueado ? 'BLOQUEADO_SEGURIDAD' : 'DENEGADO_SIN_PERMISO',
      detalle: bloqueado
        ? 'Bloqueo definitivo activado al alcanzar 5 intentos fallidos consecutivos'
        : `Código de verificación inválido, vencido o repetido (Intento ${usuario.intentosFallidos} de 5)`,
      usuarioId: usuario.id,
      ipOrigen: contexto.ipOrigen,
      userAgent: contexto.userAgent,
    });
    return bloqueado;
  }

  private async validarTotp(usuario: Usuario, codigo: string): Promise<boolean> {
    if (!usuario.twoFactorSecretCifrado) {
      return false;
    }
    const secreto = this.cifrado.descifrar(usuario.twoFactorSecretCifrado);
    const resultado = await this.totp.verificar(secreto, codigo, usuario.twoFactorUltimoPaso);
    if (!resultado.valido || resultado.paso === undefined) {
      return false;
    }
    return this.dosFactoresRepo.registrarPasoSiEsNuevo(usuario.id, resultado.paso);
  }

  private async consumirCodigoRespaldo(usuarioId: string, codigo: string): Promise<boolean> {
    const vigentes = await this.dosFactoresRepo.obtenerCodigosRespaldoVigentes(usuarioId);
    for (const vigente of vigentes) {
      if (await this.codigosRespaldo.verificar(codigo, vigente.codigoHash)) {
        return this.dosFactoresRepo.consumirCodigoRespaldo(vigente.id);
      }
    }
    return false;
  }
}
