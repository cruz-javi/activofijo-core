import { Module, Global } from '@nestjs/common';
import { PrismaCoreService } from './prisma-core.service.js';
import { PrismaLegacyService } from './prisma-legacy.service.js';

@Global()
@Module({
  providers: [PrismaCoreService, PrismaLegacyService],
  exports: [PrismaCoreService, PrismaLegacyService],
})
export class DatabaseModule {}
