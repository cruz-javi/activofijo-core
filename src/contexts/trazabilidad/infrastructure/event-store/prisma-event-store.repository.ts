import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { EventStorePort } from '../../domain/ports/event-store.port.js';
import { StoredDomainEvent } from '../../domain/event.interface.js';
import crypto from 'crypto';

@Injectable()
export class PrismaEventStoreRepository implements EventStorePort {
  private readonly logger = new Logger(PrismaEventStoreRepository.name);

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
