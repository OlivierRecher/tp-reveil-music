import type { Track } from '../../domain/Track.ts';
import type { TrackQuery } from '../../domain/TrackQuery.ts';

/** Morceau résolu par le catalogue, avec l'indication d'un repli sur le fallback local. */
export interface ResolvedTrack {
  readonly track: Track;
  /** `true` si le catalogue a dû se replier sur sa source de secours (CA-APP-10). */
  readonly degraded: boolean;
}

/** Port sortant : résolution d'un morceau demandé auprès d'une source musicale. */
export interface MusicCatalog {
  /** Rejette la promesse si aucun morceau n'a pu être résolu. */
  resolve(query: TrackQuery): Promise<ResolvedTrack>;
}
