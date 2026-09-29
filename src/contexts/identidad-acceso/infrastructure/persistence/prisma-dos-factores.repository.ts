import { Injectable, Inject } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import {
  DosFactoresRepositoryPort,
  CodigoRespaldoVigente,
} from '../../domain/ports/dos-factores-repository.port.js';

@Injectable()
export class PrismaDosFactoresRepository implements DosFactoresRepositoryPort {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async guardarSecretoPendiente(usuarioId: string, secretoCifrado: string): Promise<void> {
    await this.prisma.authUsuario.update({
      where: { id: usuarioId },
      data: { twoFactorSecret: secretoCifrado, twoFactorHabilitado: false },
    });
  }

  async activar(usuarioId: string, paso: number, hashesCodigosRespaldo: string[]): Promise<void> {
    const ahora = new Date();
    await this.prisma.$transaction([
      this.prisma.authCodigoRespaldo.updateMany({
        where: { usuarioId, usadoEn: null },
        data: { usadoEn: ahora },
      }),
      this.prisma.authCodigoRespaldo.createMany({
        data: hashesCodigosRespaldo.map((codigoHash) => ({ usuarioId, codigoHash })),
      }),
      this.prisma.authUsuario.update({
        where: { id: usuarioId },
        data: {
          twoFactorHabilitado: true,
          twoFactorActivadoEn: ahora,
          twoFactorUltimoPaso: BigInt(paso),
        },
      }),
    ]);
  }

  async reiniciar(usuarioId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.authCodigoRespaldo.updateMany({
        where: { usuarioId, usadoEn: null },
        data: { usadoEn: new Date() },
      }),
      this.prisma.authUsuario.update({
        where: { id: usuarioId },
        data: {
          twoFactorHabilitado: false,
          twoFactorSecret: null,
          twoFactorUltimoPaso: null,
          twoFactorActivadoEn: null,
        },
      }),
    ]);
  }

  // UPDATE condicional: dos solicitudes simultáneas con el mismo código no pueden ganar ambas.
  async registrarPasoSiEsNuevo(usuarioId: string, paso: number): Promise<boolean> {
    const actualizados = await this.prisma.authUsuario.updateMany({
      where: {
        id: usuarioId,
        OR: [{ twoFactorUltimoPaso: null }, { twoFactorUltimoPaso: { lt: BigInt(paso) } }],
      },
      data: { twoFactorUltimoPaso: BigInt(paso) },
    });
    return actualizados.count === 1;
  }

  async obtenerCodigosRespaldoVigentes(usuarioId: string): Promise<CodigoRespaldoVigente[]> {
    return this.prisma.authCodigoRespaldo.findMany({
      where: { usuarioId, usadoEn: null },
      select: { id: true, codigoHash: true },
    });
  }

  async consumirCodigoRespaldo(codigoId: string): Promise<boolean> {
    const actualizados = await this.prisma.authCodigoRespaldo.updateMany({
      where: { id: codigoId, usadoEn: null },
      data: { usadoEn: new Date() },
    });
    return actualizados.count === 1;
  }
}
