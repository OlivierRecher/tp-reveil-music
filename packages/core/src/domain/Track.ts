/** Source attribuée aux morceaux du fallback local. */
export const LOCAL_TRACK_SOURCE = 'local';

export interface TrackProps {
  readonly title: string;
  readonly artist: string;
  readonly link?: string | undefined;
  readonly source: string;
}

/** Représentation sérialisable d'un morceau : uniquement des champs du domaine. */
export interface TrackJson {
  readonly title: string;
  readonly artist: string;
  readonly link?: string;
  readonly source: string;
}

/** Morceau résolu (value object) : aucun champ propre à un fournisseur. */
export class Track {
  private constructor() {}

  /** Lève `InvalidTrackError` si le titre, l'artiste ou la source est vide. */
  static create(props: TrackProps): Track {
    throw new Error('Not implemented', { cause: props });
  }

  get title(): string {
    throw new Error('Not implemented');
  }

  get artist(): string {
    throw new Error('Not implemented');
  }

  get link(): string | undefined {
    throw new Error('Not implemented');
  }

  get source(): string {
    throw new Error('Not implemented');
  }

  toJSON(): TrackJson {
    throw new Error('Not implemented');
  }
}
