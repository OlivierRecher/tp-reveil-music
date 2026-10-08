// Adaptateur entrant HTTP (Fastify). Ne connaît aucune implémentation concrète : il reçoit le cas
// d'usage et le logger de la composition root.
import type { Logger, TriggerWakeUp } from '@reveil/core';
import type { FastifyInstance } from 'fastify';

export interface HttpServerDeps {
  /** Seule la méthode `execute` du cas d'usage est utilisée. */
  readonly triggerWakeUp: Pick<TriggerWakeUp, 'execute'>;
  readonly logger: Logger;
}

/**
 * Serveur HTTP : `POST /api/wake-ups` (corps validé, 400 si invalide), `GET /health`, et gestion
 * d'erreurs centralisée (500 générique, sans détail interne).
 */
export function buildHttpServer(deps: HttpServerDeps): FastifyInstance {
  throw new Error('Not implemented', { cause: { deps } });
}
