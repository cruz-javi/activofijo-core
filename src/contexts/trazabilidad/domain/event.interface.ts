export interface StoredDomainEvent<T = Record<string, unknown>> {
  streamId: string;
  streamType: string;
  version: number;
  eventType: string;
  eventSchema?: number;
  payload: T;
  metadata?: Record<string, unknown>;
}
