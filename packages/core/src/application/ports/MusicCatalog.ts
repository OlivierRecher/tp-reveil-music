import type { Track } from '../../domain/Track.ts';
import type { TrackQuery } from '../../domain/TrackQuery.ts';

/** Port sortant : résolution d'un morceau demandé auprès d'une source musicale. */
export interface MusicCatalog {
  /** Rejette la promesse si aucun morceau n'a pu être résolu. */
  resolve(query: TrackQuery): Promise<Track>;
}
