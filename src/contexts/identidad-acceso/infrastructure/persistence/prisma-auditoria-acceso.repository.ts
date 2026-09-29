import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { AuditoriaAccesoPort, RegistroAuditoriaAcceso } from '../../domain/ports/auditoria-acceso.port.js';

@Injectable()
export class PrismaAuditoriaAccesoRepository implements AuditoriaAccesoPort {
  private readonly logger = new Logger(PrismaAuditoriaAccesoRepository.name);

  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async registrar(registro: RegistroAuditoriaAcceso): Promise<void> {
    try {
      await this.prisma.authAuditoriaForense.create({
        data: {
          emailUsuario: registro.emailUsuario,
          accion: registro.accion,
          modulo: 'IDENTIDAD_ACCESO',
          entidadId: registro.entidadId,
          resultado: registro.resultado,
          motivoRechazo: registro.detalle,
          usuarioId: registro.usuarioId,
          ipOrigen: registro.ipOrigen || '127.0.0.1',
          userAgent: registro.userAgent,
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar la auditoría de acceso: ${(error as Error).message}`);
    }
  }
}
