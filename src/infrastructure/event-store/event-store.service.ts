import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import { PrismaCoreService } from '../persistence/core/prisma-core.service.js';
import crypto from 'crypto';

export interface StoredDomainEvent<T = Record<string, unknown>> {
  streamId: string;
  streamType: string;
  version: number;
  eventType: string;
  eventSchema?: number;
  payload: T;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async append(event: StoredDomainEvent): Promise<{ globalPosition: bigint; hash: Buffer }> {
    const lastEvent = await this.prisma.eventStore.findFirst({
      where: { streamId: event.streamId },
      orderBy: { version: 'desc' },
      select: { version: true, hash: true },
    });

    const expectedVersion = lastEvent ? lastEvent.version + 1 : 1;
    if (event.version !== expectedVersion) {
      throw new ConflictException(
        `Concurrency conflict on stream ${event.streamId}. Expected version ${expectedVersion}, got ${event.version}`
      );
    }

    const prevHash = lastEvent ? Buffer.from(lastEvent.hash) : null;
    const hash = this.calculateHash(event.payload, prevHash);

    try {
      const recorded = await this.prisma.eventStore.create({
        data: {
          streamId: event.streamId,
          streamType: event.streamType,
          version: event.version,
          eventType: event.eventType,
          eventSchema: event.eventSchema ?? 1,
          payload: event.payload as object,
          metadata: (event.metadata ?? {}) as object,
          prevHash: prevHash ? new Uint8Array(prevHash) : null,
          hash: new Uint8Array(hash),
        },
      });

      return {
        globalPosition: recorded.globalPosition,
        hash: Buffer.from(recorded.hash),
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Concurrency conflict: stream ${event.streamId} version ${event.version} already exists.`);
      }
      throw error;
    }
  }

  async readStream(streamId: string): Promise<any[]> {
    return this.prisma.eventStore.findMany({
      where: { streamId },
      orderBy: { version: 'asc' },
    });
  }

  /**
   * Reconstruye el estado de un stream en un punto del tiempo. Como cada
   * evento guarda el snapshot completo (no un delta), "reconstruir" es
   * simplemente ubicar el evento vigente en ese momento y devolver su
   * payload — no hace falta reproducir la cadena completa.
   */
  async reconstructAt(
    streamId: string,
    options: { version?: number; asOfDate?: Date },
  ): Promise<any | null> {
    if (options.version !== undefined) {
      return this.prisma.eventStore.findUnique({
        where: { stream_id_version_idx: { streamId, version: options.version } },
      });
    }

    if (options.asOfDate) {
      return this.prisma.eventStore.findFirst({
        where: { streamId, recordedAt: { lte: options.asOfDate } },
        orderBy: { version: 'desc' },
      });
    }

    throw new Error('Debe indicar version o asOfDate para reconstruir el estado');
  }

  async verifyStreamIntegrity(streamId: string): Promise<boolean> {
    const events = await this.readStream(streamId);
    let prevHash: Buffer | null = null;

    for (const ev of events) {
      const calculatedHash = this.calculateHash(ev.payload, prevHash);
      if (!calculatedHash.equals(Buffer.from(ev.hash))) {
        this.logger.warn(`Hash chain broken at stream ${streamId}, version ${ev.version}`);
        return false;
      }
      prevHash = Buffer.from(ev.hash);
    }

    return true;
  }

  private calculateHash(payload: unknown, prevHash: Buffer | null): Buffer {
    const canonicalString = this.canonicalJson(payload);
    const hash = crypto.createHash('sha256');
    hash.update(canonicalString, 'utf8');
    if (prevHash) {
      hash.update(prevHash);
    }
    return hash.digest();
  }

  private canonicalJson(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    // Un Date recién construido (payload en memoria, al hacer append) y un
    // Date ya serializado a ISO string (payload leído de vuelta desde el
    // JSONB de Postgres) deben producir el mismo hash — si no, la cadena de
    // integridad se rompe para todo evento que incluya una fecha.
    if (obj instanceof Date) {
      return JSON.stringify(obj.toISOString());
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.canonicalJson(item)).join(',') + ']';
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const parts = keys.map(
      (k) => JSON.stringify(k) + ':' + this.canonicalJson((obj as Record<string, unknown>)[k])
    );
    return '{' + parts.join(',') + '}';
  }
}
