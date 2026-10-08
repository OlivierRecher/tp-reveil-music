import { Track, UserId, WakeUpMessage } from '@reveil/core';
import type { Recipient } from '@reveil/core';

export const USER_ID = UserId.parse('alice');

/** Message de réveil réel (composé par le domaine) utilisé par tous les tests de canaux. */
export const MESSAGE = WakeUpMessage.compose(
  Track.create({ title: 'Walking on Sunshine', artist: 'Katrina and the Waves', source: 'itunes' }),
  'LUNDI',
  'SOLEIL',
);

/** Message dont le corps contient des caractères spéciaux HTML (`&`, `<`, `>`). */
export const HTML_UNSAFE_MESSAGE = WakeUpMessage.compose(
  Track.create({ title: 'Rock & Roll <Live>', artist: 'Led Zeppelin', source: 'itunes' }),
  'MARDI',
  'PLUIE',
);

export function recipient(address: string): Recipient {
  return { userId: USER_ID, address };
}
