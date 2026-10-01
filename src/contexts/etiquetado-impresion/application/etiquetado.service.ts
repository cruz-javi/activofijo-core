import {
  Injectable,
  Inject,
  OnModuleInit,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaCoreService } from '../../../shared/infrastructure/database/prisma-core.service.js';
import { PrismaLegacyService } from '../../../shared/infrastructure/database/prisma-legacy.service.js';
import { ResultadoAuditoria } from '../../../shared/infrastructure/database/generated/core/enums.js';
import crypto from 'crypto';
import {
  GenerarEtiquetasLoteDto,
  ReponerEtiquetaDto,
  CrearPlantillaDto,
  ActualizarPlantillaDto,
} from '../domain/etiqueta.dto.js';

const PLANTILLAS_BASE = [
  {
    nombre: 'Estándar Térmico UAGRM (70 × 35 mm)',
    descripcion: 'Formato oficial para impresoras térmicas de rollo (Zebra/Brother). Incluye QR, Código de Barras y membrete.',
    tipoPapel: 'ROLLO_TERMICO',
    anchoMm: 70,
    altoMm: 35,
    columnas: 1,
    filas: 1,
    tipoCodigo: 'HIBRIDO',
    esPredeterminada: true,
    esSistema: true,
    configuracion: {
      showLogo: true,
      showInstitucion: true,
      textoInstitucion: 'U.A.G.R.M. - ACTIVO FIJO',
      showCodigoTexto: true,
      showDescripcion: true,
      showCustodio: false,
      showOficina: true,
      showFecha: false,
      showHashSeguridad: true,
      showBordeCorte: true,
      tamanoFuente: 'medio',
      orientacion: 'horizontal',
    },
  },
  {
    nombre: 'Compacta Rollo Térmico (50 × 25 mm)',
    descripcion: 'Etiqueta compacta para periféricos pequeños, material de laboratorio y herramientas.',
    tipoPapel: 'ROLLO_TERMICO',
    anchoMm: 50,
    altoMm: 25,
    columnas: 1,
    filas: 1,
    tipoCodigo: 'QR',
    esPredeterminada: false,
    esSistema: true,
    configuracion: {
      showLogo: true,
      showInstitucion: false,
      textoInstitucion: 'UAGRM',
      showCodigoTexto: true,
      showDescripcion: true,
      showCustodio: false,
      showOficina: false,
      showFecha: false,
      showHashSeguridad: false,
      showBordeCorte: true,
      tamanoFuente: 'pequeno',
      orientacion: 'horizontal',
    },
  },
  {
    nombre: 'Hoja A4 Adhesiva (3 × 8 = 24 Etiquetas)',
    descripcion: 'Grilla para impresión de oficina en papel adhesivo estándar A4 o Carta (impresoras láser/inyección).',
    tipoPapel: 'HOJA_A4',
    anchoMm: 70,
    altoMm: 37,
    columnas: 3,
    filas: 8,
    tipoCodigo: 'HIBRIDO',
    esPredeterminada: false,
    esSistema: true,
    configuracion: {
      showLogo: true,
      showInstitucion: true,
      textoInstitucion: 'U.A.G.R.M. - ACTIVO FIJO',
      showCodigoTexto: true,
      showDescripcion: true,
      showCustodio: false,
      showOficina: true,
      showFecha: false,
      showHashSeguridad: true,
      showBordeCorte: true,
      tamanoFuente: 'medio',
      orientacion: 'horizontal',
    },
  },
  {
    nombre: 'Ficha Patrimonial Grande (100 × 50 mm)',
    descripcion: 'Placa grande para servidores de red, maquinaria, mobiliario pesado y padrón vehicular.',
    tipoPapel: 'INDIVIDUAL',
    anchoMm: 100,
    altoMm: 50,
    columnas: 1,
    filas: 1,
    tipoCodigo: 'HIBRIDO',
    esPredeterminada: false,
    esSistema: true,
    configuracion: {
      showLogo: true,
      showInstitucion: true,
      textoInstitucion: 'UNIVERSIDAD AUTÓNOMA GABRIEL RENÉ MORENO',
      showCodigoTexto: true,
      showDescripcion: true,
      showCustodio: true,
      showOficina: true,
      showFecha: true,
      showHashSeguridad: true,
      showBordeCorte: true,
      tamanoFuente: 'grande',
      orientacion: 'horizontal',
    },
  },
];

@Injectable()
export class EtiquetadoService implements OnModuleInit {
  private readonly hmacSecret = process.env.JWT_SECRET || 'uagrm_etiqueta_crypto_secret_key_2026';

  constructor(
    @Inject(PrismaCoreService) private readonly prismaCore: PrismaCoreService,
    @Inject(PrismaLegacyService) private readonly prismaLegacy: PrismaLegacyService,
  ) {}

  async onModuleInit() {
    await this.seedPlantillasBase();
  }

  /**
   * Inicializa las 4 plantillas base oficiales del sistema si aún no existen.
   */
  async seedPlantillasBase() {
    try {
      const count = await this.prismaCore.plantillaEtiqueta.count();
      if (count === 0) {
        for (const p of PLANTILLAS_BASE) {
          await this.prismaCore.plantillaEtiqueta.create({
            data: {
              nombre: p.nombre,
              descripcion: p.descripcion,
              tipoPapel: p.tipoPapel,
              anchoMm: p.anchoMm,
              altoMm: p.altoMm,
              columnas: p.columnas,
              filas: p.filas,
              tipoCodigo: p.tipoCodigo,
              configuracion: p.configuracion as any,
              esPredeterminada: p.esPredeterminada,
              esSistema: p.esSistema,
            },
          });
        }
      }
    } catch (err) {
      console.warn('Advertencia sembrando plantillas base de etiquetas:', (err as Error).message);
    }
  }

  // ==========================================================================
  // GESTIÓN DE PLANTILLAS DE ETIQUETAS (CRUD DINÁMICO)
  // ==========================================================================

  async listarPlantillas() {
    return this.prismaCore.plantillaEtiqueta.findMany({
      orderBy: [
        { esPredeterminada: 'desc' },
        { esSistema: 'desc' },
        { creadoEn: 'asc' },
      ],
    });
  }

  async obtenerPlantillaPorId(id: string) {
    const plantilla = await this.prismaCore.plantillaEtiqueta.findUnique({
      where: { id },
    });
    if (!plantilla) {
      throw new NotFoundException(`La plantilla de etiqueta con ID "${id}" no existe`);
    }
    return plantilla;
  }

  async crearPlantilla(dto: CrearPlantillaDto, user?: any, ipOrigen?: string, userAgent?: string) {
    const existe = await this.prismaCore.plantillaEtiqueta.findUnique({
      where: { nombre: dto.nombre.trim() },
    });
    if (existe) {
      throw new ConflictException(`Ya existe una plantilla con el nombre "${dto.nombre}"`);
    }

    if (dto.esPredeterminada) {
      await this.prismaCore.plantillaEtiqueta.updateMany({
        where: { esPredeterminada: true },
        data: { esPredeterminada: false },
      });
    }

    const created = await this.prismaCore.plantillaEtiqueta.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        tipoPapel: dto.tipoPapel,
        anchoMm: dto.anchoMm,
        altoMm: dto.altoMm,
        columnas: dto.columnas || 1,
        filas: dto.filas || 1,
        tipoCodigo: dto.tipoCodigo,
        configuracion: dto.configuracion as any,
        esPredeterminada: Boolean(dto.esPredeterminada),
        esSistema: false,
      },
    });

    try {
      await this.prismaCore.authAuditoriaForense.create({
        data: {
          usuarioId: user?.sub || null,
          emailUsuario: user?.email || 'operador@uagrm.edu.bo',
          accion: 'CREAR_PLANTILLA_ETIQUETA',
          modulo: 'ETIQUETAS',
          entidadId: created.id,
          resultado: ResultadoAuditoria.EXITOSO,
          motivoRechazo: `Plantilla "${created.nombre}" creada (${created.anchoMm}x${created.altoMm}mm)`,
          ipOrigen: ipOrigen || '127.0.0.1',
          userAgent: userAgent || 'Sistema Patrimonial UAGRM',
        },
      });
    } catch (e) {
      console.warn(`Error al registrar bitácora CREAR_PLANTILLA_ETIQUETA: ${(e as Error).message}`);
    }

    return created;
  }

  async actualizarPlantilla(id: string, dto: ActualizarPlantillaDto, user?: any, ipOrigen?: string, userAgent?: string) {
    const plantilla = await this.obtenerPlantillaPorId(id);

    if (dto.nombre && dto.nombre.trim() !== plantilla.nombre) {
      const existe = await this.prismaCore.plantillaEtiqueta.findUnique({
        where: { nombre: dto.nombre.trim() },
      });
      if (existe) {
        throw new ConflictException(`Ya existe una plantilla con el nombre "${dto.nombre}"`);
      }
    }

    if (dto.esPredeterminada) {
      await this.prismaCore.plantillaEtiqueta.updateMany({
        where: { esPredeterminada: true, id: { not: id } },
        data: { esPredeterminada: false },
      });
    }

    const updated = await this.prismaCore.plantillaEtiqueta.update({
      where: { id },
      data: {
        nombre: dto.nombre ? dto.nombre.trim() : undefined,
        descripcion: dto.descripcion !== undefined ? dto.descripcion?.trim() || null : undefined,
        tipoPapel: dto.tipoPapel,
        anchoMm: dto.anchoMm,
        altoMm: dto.altoMm,
        columnas: dto.columnas,
        filas: dto.filas,
        tipoCodigo: dto.tipoCodigo,
        configuracion: dto.configuracion ? (dto.configuracion as any) : undefined,
        esPredeterminada: dto.esPredeterminada,
      },
    });

    try {
      await this.prismaCore.authAuditoriaForense.create({
        data: {
          usuarioId: user?.sub || null,
          emailUsuario: user?.email || 'operador@uagrm.edu.bo',
          accion: 'ACTUALIZAR_PLANTILLA_ETIQUETA',
          modulo: 'ETIQUETAS',
          entidadId: id,
          resultado: ResultadoAuditoria.EXITOSO,
          motivoRechazo: `Plantilla "${updated.nombre}" actualizada`,
          ipOrigen: ipOrigen || '127.0.0.1',
          userAgent: userAgent || 'Sistema Patrimonial UAGRM',
        },
      });
    } catch (e) {
      console.warn(`Error al registrar bitácora ACTUALIZAR_PLANTILLA_ETIQUETA: ${(e as Error).message}`);
    }

    return updated;
  }

  async eliminarPlantilla(id: string, user?: any, ipOrigen?: string, userAgent?: string) {
    const plantilla = await this.obtenerPlantillaPorId(id);
    if (plantilla.esSistema) {
      throw new ForbiddenException('Las plantillas oficiales de fábrica del sistema están protegidas contra eliminación');
    }

    await this.prismaCore.plantillaEtiqueta.delete({
      where: { id },
    });

    try {
      await this.prismaCore.authAuditoriaForense.create({
        data: {
          usuarioId: user?.sub || null,
          emailUsuario: user?.email || 'operador@uagrm.edu.bo',
          accion: 'ELIMINAR_PLANTILLA_ETIQUETA',
          modulo: 'ETIQUETAS',
          entidadId: id,
          resultado: ResultadoAuditoria.EXITOSO,
          motivoRechazo: `Plantilla "${plantilla.nombre}" eliminada`,
          ipOrigen: ipOrigen || '127.0.0.1',
          userAgent: userAgent || 'Sistema Patrimonial UAGRM',
        },
      });
    } catch (e) {
      console.warn(`Error al registrar bitácora ELIMINAR_PLANTILLA_ETIQUETA: ${(e as Error).message}`);
    }

    return { success: true, message: `Plantilla "${plantilla.nombre}" eliminada exitosamente` };
  }

  async establecerPredeterminada(id: string) {
    await this.obtenerPlantillaPorId(id);
    await this.prismaCore.plantillaEtiqueta.updateMany({
      data: { esPredeterminada: false },
    });
    const updated = await this.prismaCore.plantillaEtiqueta.update({
      where: { id },
      data: { esPredeterminada: true },
    });
    return updated;
  }

  // ==========================================================================
  // GENERACIÓN E IMPRESIÓN POR LOTES
  // ==========================================================================

  /**
   * Genera los datos, codificación física y sellos criptográficos para un lote de activos.
   */
  async generarEtiquetasLote(
    dto: GenerarEtiquetasLoteDto,
    user: any,
    ipOrigen?: string,
    userAgent?: string,
  ) {
    const codigosUnicos = Array.from(new Set(dto.codigos.map((c) => c.trim().toUpperCase())));
    if (codigosUnicos.length === 0) {
      throw new BadRequestException('No se proporcionaron códigos de activo válidos');
    }

    // Obtener plantilla activa
    let plantilla: any = null;
    if (dto.plantillaId) {
      plantilla = await this.prismaCore.plantillaEtiqueta.findUnique({
        where: { id: dto.plantillaId },
      });
    }
    if (!plantilla) {
      plantilla = await this.prismaCore.plantillaEtiqueta.findFirst({
        where: { esPredeterminada: true },
      });
    }

    // Resolver activos en lote
    const etiquetasProcesadas = [];
    const timestampActual = new Date();

    for (const codigo of codigosUnicos) {
      // 1. Buscar en legado o en core
      const activoLegacy = await this.prismaLegacy.inActivo.findUnique({
        where: { codActivo: codigo },
        include: {
          grupo: true,
          marca: true,
          modelo: true,
          vehiculo: true,
          detallesAsignacion: {
            include: {
              asignado: {
                include: { oficina: true, responsable: true },
              },
            },
            orderBy: { codAsig: 'desc' },
            take: 1,
          },
        },
      });

      const activoCore = !activoLegacy
        ? await this.prismaCore.activoProyeccion.findUnique({ where: { codigo } })
        : null;

      if (!activoLegacy && !activoCore) {
        continue; // Omitir códigos inexistentes
      }

      const nroActivo = activoLegacy?.nroActivo || 1;
      const descripcion = activoLegacy?.descripcion || activoCore?.descripcion || '';
      const ultimaAsig = activoLegacy?.detallesAsignacion?.[0]?.asignado;
      const ubicacion = ultimaAsig?.oficina?.desDpto || activoCore?.ubicacion || 'ALMACÉN CENTRAL';
      const grupo = activoLegacy?.grupo?.desGrupo || activoCore?.grupoContable || 'GENERAL';
      const custodioNombre = ultimaAsig?.responsable
        ? `${ultimaAsig.responsable.nombres} ${ultimaAsig.responsable.apellidos}`
        : null;

      // 3. Obtener versión de etiqueta vigente
      const ultimaEtiqueta = await this.prismaCore.etiquetaGenerada.findFirst({
        where: { codActivo: codigo, vigente: true },
        orderBy: { versionEtiqueta: 'desc' },
      });

      const versionEtiqueta = ultimaEtiqueta ? ultimaEtiqueta.versionEtiqueta : 1;

      // 4. Generar hash criptográfico HMAC-SHA256 institucional
      const hashSeguridad = crypto
        .createHmac('sha256', this.hmacSecret)
        .update(`${codigo}|${nroActivo}|${versionEtiqueta}|${timestampActual.getTime()}`)
        .digest('hex');

      // 5. Registrar emisión de etiqueta
      const registro = await this.prismaCore.etiquetaGenerada.create({
        data: {
          nroActivo,
          codActivo: codigo,
          formato: dto.formato || plantilla?.tipoCodigo || 'HIBRIDO',
          motivo: dto.motivo || 'ALTA',
          versionEtiqueta,
          vigente: true,
          hashSeguridad,
          plantillaNombre: plantilla?.nombre || 'Formato Estándar',
          generadoPor: user.sub,
          generadoEn: timestampActual,
          impreso: true,
        },
      });

      etiquetasProcesadas.push({
        id: registro.id,
        nroActivo,
        codigo,
        descripcion,
        ubicacion,
        grupoContable: grupo,
        custodio: custodioNombre,
        versionEtiqueta,
        hashSeguridad,
        codigoVerificacionCorto: hashSeguridad.substring(0, 10).toUpperCase(),
        formato: registro.formato,
        fechaEmision: timestampActual.toISOString(),
      });
    }

    if (etiquetasProcesadas.length > 0) {
      try {
        const payloadHash = crypto
          .createHash('sha256')
          .update(JSON.stringify({ codigos: codigosUnicos, formato: dto.formato, total: etiquetasProcesadas.length }))
          .digest('hex');

        await this.prismaCore.authAuditoriaForense.create({
          data: {
            usuarioId: user?.sub || null,
            emailUsuario: user?.email || 'operador@uagrm.edu.bo',
            accion: 'GENERAR_ETIQUETAS_LOTE',
            modulo: 'ETIQUETAS',
            entidadId: `${etiquetasProcesadas.length} activos`,
            resultado: ResultadoAuditoria.EXITOSO,
            ipOrigen: ipOrigen || '127.0.0.1',
            userAgent: userAgent || 'Sistema Patrimonial UAGRM',
            motivoRechazo: `Generación e impresión de ${etiquetasProcesadas.length} etiquetas en lote`,
            payloadHash,
          },
        });
      } catch (e) {
        console.warn(`Error al registrar bitácora GENERAR_ETIQUETAS_LOTE: ${(e as Error).message}`);
      }
    }

    return {
      success: true,
      totalProcesados: etiquetasProcesadas.length,
      plantilla: plantilla || PLANTILLAS_BASE[0],
      etiquetas: etiquetasProcesadas,
    };
  }

  // ==========================================================================
  // REPOSICIÓN FORMAL DE ETIQUETA (HU3-18)
  // ==========================================================================

  /**
   * Invalida la etiqueta anterior de un bien deteriorado y emite la versión sucesiva (n+1)
   * registrando la trazabilidad en la bitácora de auditoría forense con accion: REPOSICION_ETIQUETA.
   */
  async reponerEtiqueta(
    dto: ReponerEtiquetaDto,
    user: any,
    ipOrigen?: string,
    userAgent?: string,
  ) {
    const codActivoLimpio = dto.codActivo.trim().toUpperCase();

    // 1. Verificar existencia del activo
    const activoLegacy = await this.prismaLegacy.inActivo.findUnique({
      where: { codActivo: codActivoLimpio },
      include: {
        grupo: true,
        detallesAsignacion: {
          include: {
            asignado: {
              include: { oficina: true },
            },
          },
          orderBy: { codAsig: 'desc' },
          take: 1,
        },
      },
    });
    const activoCore = !activoLegacy
      ? await this.prismaCore.activoProyeccion.findUnique({ where: { codigo: codActivoLimpio } })
      : null;

    if (!activoLegacy && !activoCore) {
      throw new NotFoundException(`El activo con código "${codActivoLimpio}" no existe en el sistema patrimonial`);
    }

    const nroActivo = activoLegacy?.nroActivo || 1;
    const descripcion = activoLegacy?.descripcion || activoCore?.descripcion || '';
    const ubicacion = activoLegacy?.detallesAsignacion?.[0]?.asignado?.oficina?.desDpto || activoCore?.ubicacion || 'ALMACÉN CENTRAL';

    // 2. Localizar y dar de baja la etiqueta actualmente vigente
    const etiquetaVigente = await this.prismaCore.etiquetaGenerada.findFirst({
      where: { codActivo: codActivoLimpio, vigente: true },
      orderBy: { versionEtiqueta: 'desc' },
    });

    const ahora = new Date();
    if (etiquetaVigente) {
      await this.prismaCore.etiquetaGenerada.update({
        where: { id: etiquetaVigente.id },
        data: {
          vigente: false,
          invalidadaEn: ahora,
        },
      });
    }

    const nuevaVersion = (etiquetaVigente?.versionEtiqueta || 1) + 1;

    // 3. Generar nuevo hash criptográfico HMAC-SHA256
    const nuevoHashSeguridad = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(`${codActivoLimpio}|${nroActivo}|${nuevaVersion}|${dto.motivo}|${ahora.getTime()}`)
      .digest('hex');

    // 4. Crear nuevo registro de etiqueta vigente
    const nuevaEtiqueta = await this.prismaCore.etiquetaGenerada.create({
      data: {
        nroActivo,
        codActivo: codActivoLimpio,
        formato: dto.formato || 'HIBRIDO',
        motivo: dto.motivo,
        versionEtiqueta: nuevaVersion,
        vigente: true,
        hashSeguridad: nuevoHashSeguridad,
        plantillaNombre: 'Reposición Institucional',
        observacion: dto.observacion?.trim() || null,
        generadoPor: user.sub,
        generadoEn: ahora,
        impreso: true,
      },
    });

    // 5. Registrar en la bitácora de auditoría forense inmutable
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ ...dto, versionAnterior: etiquetaVigente?.versionEtiqueta, nuevaVersion }))
      .digest('hex');

    await this.prismaCore.authAuditoriaForense.create({
      data: {
        usuarioId: user.sub,
        emailUsuario: user.email || 'operador@uagrm.edu.bo',
        accion: 'REPOSICION_ETIQUETA',
        modulo: 'ETIQUETAS',
        entidadId: codActivoLimpio,
        resultado: ResultadoAuditoria.EXITOSO,
        ipOrigen: ipOrigen || '127.0.0.1',
        userAgent: userAgent || 'Sistema Patrimonial UAGRM',
        motivoRechazo: null,
        payloadHash,
      },
    });

    return {
      success: true,
      message: `Etiqueta del activo ${codActivoLimpio} repuesta exitosamente (Versión ${nuevaVersion})`,
      data: {
        id: nuevaEtiqueta.id,
        nroActivo,
        codigo: codActivoLimpio,
        descripcion,
        ubicacion,
        versionPrevia: etiquetaVigente?.versionEtiqueta || 1,
        versionEtiqueta: nuevaVersion,
        motivo: dto.motivo,
        observacion: dto.observacion,
        hashSeguridad: nuevoHashSeguridad,
        codigoVerificacionCorto: nuevoHashSeguridad.substring(0, 10).toUpperCase(),
        fechaEmision: ahora.toISOString(),
      },
    };
  }

  // ==========================================================================
  // CONSULTA DE HISTORIAL Y TRAZABILIDAD DE ETIQUETAS
  // ==========================================================================

  async obtenerHistorialActivo(codActivo: string) {
    const codLimpio = codActivo.trim().toUpperCase();
    const historial = await this.prismaCore.etiquetaGenerada.findMany({
      where: { codActivo: codLimpio },
      orderBy: { versionEtiqueta: 'desc' },
    });

    return {
      codigo: codLimpio,
      totalEmisiones: historial.length,
      historial: historial.map((e) => ({
        id: e.id,
        version: e.versionEtiqueta,
        vigente: e.vigente,
        motivo: e.motivo,
        formato: e.formato,
        hashSeguridad: e.hashSeguridad,
        observacion: e.observacion,
        generadoEn: e.generadoEn,
        invalidadaEn: e.invalidadaEn,
      })),
    };
  }
}
