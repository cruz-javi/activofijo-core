import { Injectable, Inject } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import crypto from 'crypto';

@Injectable()
export class CerrarSesionUseCase {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async execute(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRecord = await this.prisma.authRefreshToken.findUnique({ where: { tokenHash } });
    if (tokenRecord) {
      await this.prisma.authRefreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { revocado: true, reemplazadoPor: 'LOGOUT' },
      });
    }
  }
}
