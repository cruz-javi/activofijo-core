import { Controller, Inject, Get, Query } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { Roles } from '../security/roles.decorator.js';
import { ResultadoAuditoria } from '../../../../shared/infrastructure/database/generated/core/enums.js';

@Controller('auditoria')
@Roles('ADMINISTRADOR')
export class AuditoriaController {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  @Get()
  async getBitacora(
    @Query('search') search?: string,
    @Query('accion') accion?: string,
    @Query('modulo') modulo?: string,
    @Query('resultado') resultado?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const where: any = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { emailUsuario: { contains: q, mode: 'insensitive' } },
        { accion: { contains: q, mode: 'insensitive' } },
        { modulo: { contains: q, mode: 'insensitive' } },
        { ipOrigen: { contains: q } },
      ];
    }

    if (accion && accion !== 'TODOS') {
      where.accion = accion;
    }

    if (modulo && modulo !== 'TODOS') {
      where.modulo = modulo;
    }

    if (resultado && resultado !== 'TODOS') {
      where.resultado = resultado as ResultadoAuditoria;
    }

    const [total, items] = await Promise.all([
      this.prisma.authAuditoriaForense.count({ where }),
      this.prisma.authAuditoriaForense.findMany({
        where,
        take,
        skip,
        orderBy: { creadoEn: 'desc' },
      }),
    ]);

    // Serializar BigInt a String para evitar error en JSON.stringify
    const serializedItems = items.map((item) => ({
      ...item,
      id: item.id.toString(),
    }));

    return {
      total,
      limit: take,
      offset: skip,
      items: serializedItems,
    };
  }
}
