import { InvalidTrackQueryError } from './InvalidTrackQueryError.ts';

export interface TrackQueryProps {
  readonly title: string;
  readonly artist?: string | undefined;
}

/** Morceau demandé (titre + artiste optionnel), avant résolution par un catalogue musical. */
export class TrackQuery {
  readonly #title: string;
  readonly #artist: string | undefined;

  private constructor(title: string, artist: string | undefined) {
    this.#title = title;
    this.#artist = artist;
  }

  /** Lève `InvalidTrackQueryError` si le titre est vide ; un artiste vide est considéré absent. */
  static create(props: TrackQueryProps): TrackQuery {
    const title = props.title.trim();
    if (title === '') {
      throw new InvalidTrackQueryError('Le titre du morceau demandé ne peut pas être vide');
    }
    const artist = props.artist?.trim();
    return new TrackQuery(title, artist === '' ? undefined : artist);
  }

  get title(): string {
    return this.#title;
  }

  get artist(): string | undefined {
    return this.#artist;
  }

  /** Clé normalisée (casse, espaces) : deux requêtes équivalentes partagent la même clé. */
  get cacheKey(): string {
    return `${normalize(this.#artist ?? '')}|${normalize(this.#title)}`;
  }

  /** Terme de recherche neutre : « artiste titre », ou le titre seul. */
  toSearchTerm(): string {
    return this.#artist === undefined ? this.#title : `${this.#artist} ${this.#title}`;
  }
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
