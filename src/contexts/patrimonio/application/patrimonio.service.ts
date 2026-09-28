import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ACTIVO_REPOSITORY, ActivoRepository, ActivoFilters } from '../domain/activo.repository.js';
import { Activo } from '../domain/activo.entity.js';
import { CreateActivoDto, UpdateActivoDto } from '../infrastructure/patrimonio.dto.js';
import { EventStorePort, EVENT_STORE_PORT } from '../../../contexts/trazabilidad/domain/ports/event-store.port.js';
import { PrismaCoreService } from '../../../shared/infrastructure/database/prisma-core.service.js';
import { PrismaLegacyService } from '../../../shared/infrastructure/database/prisma-legacy.service.js';
import { ResultadoAuditoria } from '../../../shared/infrastructure/database/generated/core/enums.js';
import argon2 from 'argon2';
import crypto from 'crypto';

@Injectable()
export class PatrimonioService {
  constructor(
    @Inject(ACTIVO_REPOSITORY) private readonly repository: ActivoRepository,
    @Inject(EVENT_STORE_PORT) private readonly eventStore: EventStorePort,
    @Inject(PrismaCoreService) private readonly prismaCore: PrismaCoreService,
    @Inject(PrismaLegacyService) private readonly prismaLegacy: PrismaLegacyService,
  ) {}

  async findAll(limit = 50, offset = 0, filters?: ActivoFilters) {
    const items = await this.repository.findAll(limit, offset, filters);
    const total = await this.repository.count(filters);
    return {
      data: items.map((i) => i.toJSON()),
      total,
      limit,
      offset,
    };
  }

  async getMetadata() {
    const items = await this.repository.findAll(200, 0);
    const unidades = Array.from(new Set(items.map((i) => i.unidad || i.ubicacion).filter(Boolean)));
    const estados = Array.from(new Set(items.map((i) => i.estado).filter(Boolean)));
    const grupos = Array.from(new Set(items.map((i) => i.grupoContable).filter(Boolean)));

    return {
      unidades,
      estados: estados.length > 0 ? estados : ['BUENO', 'REGULAR', 'MALO', 'EN_REPARACION', 'BAJA'],
      grupos,
    };
  }

  async getFormularioMetadata() {
    try {
      const [
        grupos,
        marcas,
        modelos,
        unidades,
        condiciones,
        estados,
        proveedores,
        oficinas,
        empleados,
        gestiones,
        maxActivo,
      ] = await Promise.all([
        this.prismaLegacy.inGrupo.findMany({
          where: { activo: true },
          select: { codGrupo: true, desGrupo: true },
          orderBy: { codGrupo: 'asc' },
        }),
        this.prismaLegacy.inMarca.findMany({
          where: { activo: true },
          select: { codMarca: true, desMarca: true },
          orderBy: { desMarca: 'asc' },
        }),
        this.prismaLegacy.inModelo.findMany({
          where: { activo: true },
          select: { codModelo: true, codMarca: true, desModelo: true },
          orderBy: { desModelo: 'asc' },
        }),
        this.prismaLegacy.inUnidad.findMany({
          where: { activo: true },
          select: { codUnidad: true, desUnidad: true, abrev: true },
          orderBy: { desUnidad: 'asc' },
        }),
        this.prismaLegacy.inCondicion.findMany({
          where: { activo: true },
          select: { codCond: true, desCond: true },
          orderBy: { codCond: 'asc' },
        }),
        this.prismaLegacy.inEstado.findMany({
          where: { activo: true },
          select: { codEstado: true, desEstado: true },
          orderBy: { codEstado: 'asc' },
        }),
        this.prismaLegacy.inProveedor.findMany({
          where: { activo: true },
          select: { codProve: true, razonSocial: true, nit: true },
          orderBy: { razonSocial: 'asc' },
        }),
        this.prismaLegacy.inOficina.findMany({
          where: { activo: true },
          select: { codOfic: true, desDpto: true },
          orderBy: { desDpto: 'asc' },
        }),
        this.prismaLegacy.inEmpleado.findMany({
          where: { activo: true },
          select: { codEmp: true, nombres: true, apellidos: true, cargo: true, codOfic: true },
          orderBy: { apellidos: 'asc' },
        }),
        this.prismaLegacy.inGestion.findMany({
          where: { activo: true },
          select: { codGest: true, vigente: true },
          orderBy: { codGest: 'desc' },
        }),
        this.prismaLegacy.inActivo.aggregate({
          _max: { nroActivo: true },
        }),
      ]);

      const proximoNroActivo = (maxActivo._max.nroActivo || 0) + 1;

      return {
        grupos: grupos.length > 0 ? grupos : [
          { codGrupo: 12100, desGrupo: '12100 - EDIFICIOS Y ESTRUCTURAS' },
          { codGrupo: 12200, desGrupo: '12200 - MAQUINARIA Y EQUIPO' },
          { codGrupo: 12300, desGrupo: '12300 - EQUIPO DE COMPUTACIÓN' },
          { codGrupo: 12400, desGrupo: '12400 - VEHÍCULOS AUTOMOTORES' },
          { codGrupo: 12500, desGrupo: '12500 - MUEBLES Y ENSERES' },
        ],
        marcas,
        modelos,
        unidades: unidades.length > 0 ? unidades : [
          { codUnidad: 1, desUnidad: 'PIEZA', abrev: 'PZA' },
          { codUnidad: 2, desUnidad: 'GLOBAL', abrev: 'GLB' },
          { codUnidad: 3, desUnidad: 'EQUIPO', abrev: 'EQP' },
          { codUnidad: 4, desUnidad: 'LOTE', abrev: 'LOT' },
        ],
        condiciones: condiciones.length > 0 ? condiciones : [
          { codCond: 1, desCond: 'NUEVO' },
          { codCond: 2, desCond: 'BUENO' },
          { codCond: 3, desCond: 'REGULAR' },
          { codCond: 4, desCond: 'MALO' },
        ],
        estados: estados.length > 0 ? estados : [
          { codEstado: 1, desEstado: 'EN USO' },
          { codEstado: 2, desEstado: 'EN DEPÓSITO' },
          { codEstado: 3, desEstado: 'EN MANTENIMIENTO' },
        ],
        proveedores,
        oficinas,
        empleados,
        gestiones,
        proximoNroActivo,
      };
    } catch (e) {
      console.warn('Fallo al obtener metadata legado, usando fallbacks:', (e as Error).message);
      return {
        grupos: [
          { codGrupo: 12100, desGrupo: '12100 - EDIFICIOS Y ESTRUCTURAS' },
          { codGrupo: 12200, desGrupo: '12200 - MAQUINARIA Y EQUIPO' },
          { codGrupo: 12300, desGrupo: '12300 - EQUIPO DE COMPUTACIÓN' },
          { codGrupo: 12400, desGrupo: '12400 - VEHÍCULOS AUTOMOTORES' },
          { codGrupo: 12500, desGrupo: '12500 - MUEBLES Y ENSERES' },
        ],
        marcas: [],
        modelos: [],
        unidades: [
          { codUnidad: 1, desUnidad: 'PIEZA', abrev: 'PZA' },
          { codUnidad: 2, desUnidad: 'GLOBAL', abrev: 'GLB' },
          { codUnidad: 3, desUnidad: 'EQUIPO', abrev: 'EQP' },
        ],
        condiciones: [
          { codCond: 1, desCond: 'NUEVO' },
          { codCond: 2, desCond: 'BUENO' },
          { codCond: 3, desCond: 'REGULAR' },
        ],
        estados: [
          { codEstado: 1, desEstado: 'EN USO' },
          { codEstado: 2, desEstado: 'EN DEPÓSITO' },
        ],
        proveedores: [],
        oficinas: [],
        empleados: [],
        gestiones: [{ codGest: new Date().getFullYear(), vigente: true }],
        proximoNroActivo: 1,
      };
    }
  }

  async findById(id: string) {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException(`Activo with id ${id} not found`);
    return item.toJSON();
  }

  async create(dto: CreateActivoDto, user?: any, ipOrigen = '127.0.0.1', userAgent = 'Browser') {
    // 1. RE-AUTENTICACIÓN OBLIGATORIA POR CONTRASEÑA (STEP-UP SECURITY)
    if (!user || !user.sub) {
      throw new UnauthorizedException('Identidad de usuario no verificada en sesión');
    }

    const usuario = await this.prismaCore.authUsuario.findUnique({
      where: { id: user.sub },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo o no autorizado');
    }

    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(dto)).digest('hex');

    const isPasswordValid = await argon2.verify(usuario.passwordHash, dto.passwordConfirm);
    if (!isPasswordValid) {
      // Registrar intento de alta con contraseña incorrecta en auditoría forense
      await this.prismaCore.authAuditoriaForense.create({
        data: {
          usuarioId: usuario.id,
          emailUsuario: usuario.email,
          accion: 'ALTA_ACTIVO',
          modulo: 'PATRIMONIO',
          entidadId: dto.codigo,
          resultado: ResultadoAuditoria.BLOQUEADO_SEGURIDAD,
          ipOrigen,
          userAgent,
          motivoRechazo: 'Firma de re-autenticación fallida: Contraseña incorrecta',
          payloadHash,
        },
      });
      throw new UnauthorizedException('Contraseña institucional incorrecta. La firma de seguridad del alta ha sido rechazada.');
    }

    // 2. VALIDACIÓN DE UNICIDAD DEL CÓDIGO Y PLACA
    const existingInCore = await this.prismaCore.activoProyeccion.findUnique({
      where: { codigo: dto.codigo },
    });
    const existingInLegacy = await this.prismaLegacy.inActivo.findUnique({
      where: { codActivo: dto.codigo },
    });
    if (existingInCore || existingInLegacy) {
      throw new ConflictException(`Ya existe un activo registrado con el código "${dto.codigo}"`);
    }

    if (dto.esVehiculo && dto.placa) {
      const placaLimpia = dto.placa.trim().toUpperCase();
      const existingPlaca = await this.prismaLegacy.inVehic.findUnique({
        where: { placa: placaLimpia },
      });
      if (existingPlaca) {
        throw new ConflictException(`Ya existe un vehículo registrado con la placa de control "${placaLimpia}"`);
      }
    }

    // 3. DETERMINACIÓN DEL NÚMERO CORRELATIVO INSTITUCIONAL (NRO_ACTIVO)
    let nroActivo = dto.nroActivo;
    if (!nroActivo || nroActivo <= 0) {
      const maxActivo = await this.prismaLegacy.inActivo.aggregate({
        _max: { nroActivo: true },
      });
      nroActivo = (maxActivo._max.nroActivo || 0) + 1;
    } else {
      const conflictNro = await this.prismaLegacy.inActivo.findUnique({
        where: { nroActivo },
      });
      if (conflictNro) {
        const maxActivo = await this.prismaLegacy.inActivo.aggregate({
          _max: { nroActivo: true },
        });
        nroActivo = (maxActivo._max.nroActivo || 0) + 1;
      }
    }

    const montoFinal = Number(dto.monto ?? dto.valor ?? 0);
    const fechaAdquisicion = dto.fecAdqui ? new Date(dto.fecAdqui) : new Date();
    const activoUuid = crypto.randomUUID();

    // Validar claves foráneas existentes en la base legada para integridad estricta
    let codGrupoValido: number | null = null;
    if (dto.codGrupo) {
      const g = await this.prismaLegacy.inGrupo.findUnique({ where: { codGrupo: Number(dto.codGrupo) } });
      if (g) codGrupoValido = g.codGrupo;
    }

    let codMarcaValido: number | null = null;
    if (dto.codMarca) {
      const m = await this.prismaLegacy.inMarca.findUnique({ where: { codMarca: Number(dto.codMarca) } });
      if (m) codMarcaValido = m.codMarca;
    }

    let codModeloValido: number | null = null;
    if (dto.codModelo) {
      const mod = await this.prismaLegacy.inModelo.findUnique({ where: { codModelo: Number(dto.codModelo) } });
      if (mod) codModeloValido = mod.codModelo;
    }

    let codUnidadValido: number | null = null;
    if (dto.codUnidad) {
      const u = await this.prismaLegacy.inUnidad.findUnique({ where: { codUnidad: Number(dto.codUnidad) } });
      if (u) codUnidadValido = u.codUnidad;
    }

    let codCondValido: number | null = null;
    if (dto.codCond) {
      const c = await this.prismaLegacy.inCondicion.findUnique({ where: { codCond: Number(dto.codCond) } });
      if (c) codCondValido = c.codCond;
    }

    let codEstadoValido: number | null = null;
    if (dto.codEstado) {
      const e = await this.prismaLegacy.inEstado.findUnique({ where: { codEstado: Number(dto.codEstado) } });
      if (e) codEstadoValido = e.codEstado;
    }

    let codProveValido: number | null = null;
    if (dto.codProve) {
      const p = await this.prismaLegacy.inProveedor.findUnique({ where: { codProve: Number(dto.codProve) } });
      if (p) codProveValido = p.codProve;
    }

    let codGestValido: number | null = null;
    if (dto.codGest) {
      const gest = await this.prismaLegacy.inGestion.findUnique({ where: { codGest: Number(dto.codGest) } });
      if (gest) codGestValido = gest.codGest;
    }

    // 4. ESQUEMA 2: PERSISTENCIA EN PATRIMONIO LEGADO (legacy_demo)
    await this.prismaLegacy.inActivo.create({
      data: {
        nroActivo,
        codActivo: dto.codigo,
        descripcion: dto.descripcion,
        monto: montoFinal,
        fecAdqui: fechaAdquisicion,
        nroSerie: dto.nroSerie || null,
        codGrupo: codGrupoValido,
        codMarca: codMarcaValido,
        codModelo: codModeloValido,
        codUnidad: codUnidadValido,
        codCond: codCondValido,
        codEstado: codEstadoValido,
        codGest: codGestValido,
        codProve: codProveValido,
        activo: true,
      },
    });

    // Inserción condicional vehicular en legacy_demo.in_vehic
    if (dto.esVehiculo && dto.placa) {
      await this.prismaLegacy.inVehic.create({
        data: {
          nroActivo,
          placa: dto.placa.trim().toUpperCase(),
          chasis: dto.chasis?.trim() || null,
          motor: dto.motor?.trim() || null,
          ruat: dto.ruat?.trim() || null,
          poliza: dto.poliza?.trim() || null,
          color: dto.color?.trim() || null,
          anioFabricacion: dto.anioFabricacion ? Number(dto.anioFabricacion) : null,
          cilindrada: dto.cilindrada?.trim() || null,
          soatVigente: true,
          activo: true,
        },
      });
    }

    // Inserción condicional de custodia inicial en legacy_demo.in_asignado
    if (dto.codEmp && dto.codOfic) {
      try {
        const maxAsig = await this.prismaLegacy.inAsignado.aggregate({
          _max: { codAsig: true },
        });
        const nextCodAsig = (maxAsig._max.codAsig || 0) + 1;
        await this.prismaLegacy.inAsignado.create({
          data: {
            codAsig: nextCodAsig,
            codOfic: Number(dto.codOfic),
            codResp: Number(dto.codEmp),
            fechaAsig: new Date(),
            estado: 'VIGENTE',
            tipoAsig: 'ALTA_INICIAL',
            documentoRespaldo: dto.actaRecep || null,
            observacion: 'Asignación inicial por alta patrimonial',
            detalles: {
              create: {
                nroActivo,
                cantidad: 1,
              },
            },
          },
        });
      } catch (err) {
        console.warn('Advertencia al registrar asignación inicial:', (err as Error).message);
      }
    }

    // Registro en legacy_demo.in_event_store
    try {
      const lastLegacy = await this.prismaLegacy.inEventStore.findFirst({
        orderBy: { seqNum: 'desc' },
        select: { hash: true },
      });
      const prevLegacyHash = lastLegacy?.hash || '0'.repeat(64);
      const currentLegacyHash = crypto
        .createHash('sha256')
        .update(prevLegacyHash + nroActivo + dto.codigo + 'ALTA' + JSON.stringify(dto))
        .digest('hex');

      await this.prismaLegacy.inEventStore.create({
        data: {
          tipoEvento: 'ALTA',
          nroActivo,
          codActivo: dto.codigo,
          usuarioId: usuario.id,
          ipOrigen,
          datosEvento: dto as any,
          prevHash: prevLegacyHash,
          hash: currentLegacyHash,
        },
      });
    } catch (err) {
      console.warn('Advertencia al registrar inEventStore:', (err as Error).message);
    }

    // 5. ESQUEMA 3: SISTEMA NATIVO Y TRAZABILIDAD (core.event_store & core.activo_proyeccion)
    const eventPayload = {
      id: activoUuid,
      nroActivo,
      codigo: dto.codigo,
      descripcion: dto.descripcion,
      monto: montoFinal,
      grupoContable: dto.grupoContable || 'GENERAL',
      ubicacion: dto.ubicacion || 'ALMACÉN CENTRAL',
      estado: dto.estado || 'BUENO',
      fecAdqui: fechaAdquisicion.toISOString(),
      nroSerie: dto.nroSerie,
      cSenape: dto.cSenape,
      nInt: dto.nInt,
      tipoIng: dto.tipoIng,
      recur: dto.recur,
      actaRecep: dto.actaRecep,
      esVehiculo: dto.esVehiculo,
      placa: dto.placa,
      codEmp: dto.codEmp,
      codOfic: dto.codOfic,
    };

    const eventResult = await this.eventStore.append({
      streamId: activoUuid,
      streamType: 'ACTIVO',
      version: 1,
      eventType: 'ActivoRegistrado',
      eventSchema: 1,
      payload: eventPayload,
      metadata: {
        usuarioId: usuario.id,
        email: usuario.email,
        ip: ipOrigen,
        timestamp: new Date().toISOString(),
      },
    });

    await this.prismaCore.activoProyeccion.create({
      data: {
        id: activoUuid,
        codigo: dto.codigo,
        descripcion: dto.descripcion,
        grupoContable: dto.grupoContable || 'GENERAL',
        ubicacion: dto.ubicacion || 'ALMACÉN CENTRAL',
        estado: dto.estado || 'BUENO',
        valor: montoFinal,
        fechaAlta: fechaAdquisicion,
        version: 1,
      },
    });

    // 6. ESQUEMA 1: AUDITORÍA FORENSE INMUTABLE (core.auth_auditoria_forense)
    const auditRecord = await this.prismaCore.authAuditoriaForense.create({
      data: {
        usuarioId: usuario.id,
        emailUsuario: usuario.email,
        accion: 'ALTA_ACTIVO', // Exactamente como instruyó el usuario
        modulo: 'PATRIMONIO',
        entidadId: dto.codigo,
        resultado: ResultadoAuditoria.EXITOSO,
        ipOrigen,
        userAgent,
        motivoRechazo: null,
        payloadHash,
      },
    });

    return {
      success: true,
      message: 'Activo registrado y dado de alta exitosamente en los 3 esquemas',
      data: {
        id: activoUuid,
        nroActivo,
        codigo: dto.codigo,
        descripcion: dto.descripcion,
        monto: montoFinal,
        eventHash: eventResult.hash.toString('hex'),
        auditId: auditRecord.id.toString(),
        payloadHash,
      },
    };
  }

  async update(id: string, dto: UpdateActivoDto) {
    const activo = await this.repository.findById(id);
    if (!activo) throw new NotFoundException(`Activo with id ${id} not found`);

    if (activo.version !== dto.expectedVersion) {
      throw new ConflictException(
        `Version conflict: current version is ${activo.version}, expected ${dto.expectedVersion}`
      );
    }

    activo.update({
      descripcion: dto.descripcion,
      grupoContable: dto.grupoContable,
      ubicacion: dto.ubicacion,
      estado: dto.estado,
      valor: dto.valor,
    });

    await this.repository.save(activo);
    return activo.toJSON();
  }

  async darDeBaja(id: string, expectedVersion: number) {
    const activo = await this.repository.findById(id);
    if (!activo) throw new NotFoundException(`Activo with id ${id} not found`);

    if (activo.version !== expectedVersion) {
      throw new ConflictException(
        `Version conflict: current version is ${activo.version}, expected ${expectedVersion}`
      );
    }

    activo.darDeBaja();
    await this.repository.save(activo);
    return activo.toJSON();
  }

  async getHistory(id: string) {
    return this.eventStore.readStream(id);
  }
}
