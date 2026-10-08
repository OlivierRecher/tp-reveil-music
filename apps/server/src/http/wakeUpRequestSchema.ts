import { DomainError, UserId, parseDayOfWeek, parseWeatherType } from '@reveil/core';
import type { WakeUpCommand } from '@reveil/core';
import { z } from 'zod';

/**
 * Champ validé par un parseur du domaine : les règles (météos, jours, identifiant) restent dans le
 * noyau ; zod ne fait que rattacher l'erreur au champ concerné.
 */
function domainField<T>(parse: (raw: unknown) => T) {
  return z.unknown().transform((raw, context): T => {
    try {
      return parse(raw);
    } catch (error) {
      if (!(error instanceof DomainError)) {
        throw error;
      }
      context.addIssue({ code: 'custom', message: error.message });
      return z.NEVER;
    }
  });
}

/** Corps de `POST /api/wake-ups`, traduit en commande du domaine (value objects). */
export const wakeUpRequestSchema: z.ZodType<WakeUpCommand> = z.object({
  userId: domainField((raw) => UserId.parse(raw)),
  dayOfWeek: domainField(parseDayOfWeek),
  weather: domainField(parseWeatherType),
});
