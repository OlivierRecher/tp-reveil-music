import type { UserId } from '../../domain/UserId.ts';
import type { UserPreferences } from '../../domain/UserPreferences.ts';

/** Port sortant : service interne des préférences utilisateur. */
export interface UserPreferencesProvider {
  /** `null` si l'utilisateur est inconnu ; rejette la promesse si le service est en panne. */
  findByUserId(userId: UserId): Promise<UserPreferences | null>;
}
