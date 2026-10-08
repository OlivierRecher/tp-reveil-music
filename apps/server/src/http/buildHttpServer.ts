// Adaptateur entrant HTTP (Fastify). Ne connaît aucune implémentation concrète : il reçoit le cas
// d'usage et le logger de la composition root.
import { describeError } from '@reveil/core';
import type { Logger, TriggerWakeUp } from '@reveil/core';
import { fastify } from 'fastify';
import type { FastifyInstance } from 'fastify';
import { toReportJson } from './toReportJson.ts';
import { wakeUpRequestSchema } from './wakeUpRequestSchema.ts';

export interface HttpServerDeps {
  /** Seule la méthode `execute` du cas d'usage est utilisée. */
  readonly triggerWakeUp: Pick<TriggerWakeUp, 'execute'>;
  readonly logger: Logger;
}

/** Détail d'une erreur de saisie : champ concerné (vide pour le corps entier) et motif. */
interface InvalidField {
  readonly field: string;
  readonly message: string;
}

/**
 * Serveur HTTP : `POST /api/wake-ups` (corps validé, 400 si invalide), `GET /health`, et gestion
 * d'erreurs centralisée (500 générique, sans détail interne).
 */
export function buildHttpServer({ triggerWakeUp, logger }: HttpServerDeps): FastifyInstance {
  // Journal de Fastify désactivé : on journalise via le port `Logger` injecté.
  const app = fastify({ logger: false });

  app.get('/health', () => ({ status: 'ok' }));

  app.post('/api/wake-ups', async (request, reply) => {
    const parsed = wakeUpRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const details: ReadonlyArray<InvalidField> = parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        message: issue.message,
      }));
      logger.info('Demande de réveil refusée (400)', { details });
      return reply.code(400).send({ error: 'INVALID_REQUEST', details });
    }
    const report = await triggerWakeUp.execute(parsed.data);
    return toReportJson(report);
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode = clientErrorStatus(error);
    if (statusCode !== undefined) {
      // Erreur de requête détectée par Fastify (JSON malformé, type de contenu non pris en charge…).
      const details: ReadonlyArray<InvalidField> = [{ field: '', message: describeError(error) }];
      return reply.code(statusCode).send({ error: 'INVALID_REQUEST', details });
    }
    // Jamais de silence, jamais de fuite : le détail va au journal, le client reçoit un 500 générique.
    logger.error('Erreur inattendue du serveur HTTP', { error: describeError(error) });
    return reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });

  return app;
}

/** Statut 4xx porté par une erreur de Fastify, sinon `undefined` (erreur interne). */
function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return undefined;
  }
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}
