import { describe, expect, it } from 'vitest';
import { NotificationChannelError } from '../../../src/infrastructure/notification/NotificationChannelError.ts';

describe('NotificationChannelError', () => {
  it("[CA-NOT-04] est une Error uniforme qui porte le canal, la raison et la cause d'origine", () => {
    const cause = new Error('SMTP indisponible');

    const error = new NotificationChannelError('EMAIL', 'le fournisseur a rejeté l’envoi', {
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NotificationChannelError');
    expect(error.channel).toBe('EMAIL');
    expect(error.message).toContain('EMAIL');
    expect(error.message).toContain('le fournisseur a rejeté l’envoi');
    expect(error.cause).toBe(cause);
  });
});
