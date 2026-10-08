import { InvalidTrackError } from './InvalidTrackError.ts';

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
  readonly #title: string;
  readonly #artist: string;
  readonly #link: string | undefined;
  readonly #source: string;

  private constructor(title: string, artist: string, link: string | undefined, source: string) {
    this.#title = title;
    this.#artist = artist;
    this.#link = link;
    this.#source = source;
  }

  /** Lève `InvalidTrackError` si le titre, l'artiste ou la source est vide. */
  static create(props: TrackProps): Track {
    const title = requireText(props.title, 'titre');
    const artist = requireText(props.artist, 'artiste');
    const source = requireText(props.source, 'source');
    const link = props.link?.trim();
    return new Track(title, artist, link === '' ? undefined : link, source);
  }

  get title(): string {
    return this.#title;
  }

  get artist(): string {
    return this.#artist;
  }

  get link(): string | undefined {
    return this.#link;
  }

  get source(): string {
    return this.#source;
  }

  toJSON(): TrackJson {
    const base = { title: this.#title, artist: this.#artist };
    return this.#link === undefined
      ? { ...base, source: this.#source }
      : { ...base, link: this.#link, source: this.#source };
  }
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new InvalidTrackError(`Le champ « ${field} » du morceau ne peut pas être vide`);
  }
  return trimmed;
}
