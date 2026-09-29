import { Injectable, Inject } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { RefreshTokenRepositoryPort, NuevoRefreshToken } from '../../domain/ports/refresh-token-repository.port.js';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepositoryPort {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async crear(token: NuevoRefreshToken): Promise<void> {
    await this.prisma.authRefreshToken.create({ data: token });
  }
}
