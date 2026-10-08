/** Canaux de notification connus du domaine. `LOG` est le canal de dernier recours. */
export const CHANNEL_TYPES = ['EMAIL', 'SMS', 'PUSH', 'LOG'] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

/** Garde de type : vrai si la valeur est exactement un canal connu. */
export function isChannelType(value: unknown): value is ChannelType {
  throw new Error('Not implemented', { cause: value });
}
