import { StoredDomainEvent } from '../event.interface.js';

export const EVENT_STORE_PORT = Symbol('EVENT_STORE_PORT');

export interface EventStorePort {
  append(event: StoredDomainEvent): Promise<{ globalPosition: bigint; hash: Buffer }>;
  readStream(streamId: string): Promise<any[]>;
  verifyStreamIntegrity(streamId: string): Promise<boolean>;
}
