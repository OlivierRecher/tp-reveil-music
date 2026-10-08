import { describe, expect, it } from 'vitest';
import { CHANNEL_TYPES, isChannelType } from '../../src/index.ts';

// Tests unitaires de détail : la garde sert à valider la configuration et les préférences (phase 3).
describe('ChannelType', () => {
  it.each(CHANNEL_TYPES)('reconnaît le canal %s', (channel) => {
    expect(isChannelType(channel)).toBe(true);
  });

  it.each(['email', 'FAX', '', ' LOG', null, undefined, 1, { channel: 'SMS' }])(
    'rejette une valeur qui n’est pas un canal connu (%j)',
    (value) => {
      expect(isChannelType(value)).toBe(false);
    },
  );
});
