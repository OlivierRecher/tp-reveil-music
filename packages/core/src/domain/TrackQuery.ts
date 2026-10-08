export interface TrackQueryProps {
  readonly title: string;
  readonly artist?: string | undefined;
}

/** Morceau demandé (titre + artiste optionnel), avant résolution par un catalogue musical. */
export class TrackQuery {
  private constructor() {}

  /** Lève `InvalidTrackQueryError` si le titre est vide ; un artiste vide est considéré absent. */
  static create(props: TrackQueryProps): TrackQuery {
    throw new Error('Not implemented', { cause: props });
  }

  get title(): string {
    throw new Error('Not implemented');
  }

  get artist(): string | undefined {
    throw new Error('Not implemented');
  }

  /** Clé normalisée (casse, espaces) : deux requêtes équivalentes partagent la même clé. */
  get cacheKey(): string {
    throw new Error('Not implemented');
  }

  /** Terme de recherche neutre : « artiste titre », ou le titre seul. */
  toSearchTerm(): string {
    throw new Error('Not implemented');
  }
}
