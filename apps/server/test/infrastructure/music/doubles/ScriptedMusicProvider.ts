import { Track } from '@reveil/core';
import type { TrackQuery } from '@reveil/core';
import type { MusicProvider } from '../../../../src/infrastructure/music/MusicProvider.ts';
import { MusicProviderUnavailableError } from '../../../../src/infrastructure/music/MusicProviderUnavailableError.ts';

type Behavior = (query: TrackQuery) => Promise<Track>;

/**
 * Doublure de `MusicProvider` écrite à la main : comportement scriptable (succès, échec, absence de
 * réponse), compte les appels et les inscrit dans un journal partagé pour vérifier l'ordre.
 */
export class ScriptedMusicProvider implements MusicProvider {
  readonly name: string;
  readonly queries: TrackQuery[] = [];
  readonly #callLog: string[] | undefined;
  #behavior: Behavior;

  constructor(name: string, callLog?: string[]) {
    this.name = name;
    this.#callLog = callLog;
    this.#behavior = (query) => Promise.resolve(this.trackFor(query));
  }

  get calls(): number {
    return this.queries.length;
  }

  /** Morceau renvoyé en cas de succès : la requête, attribuée à ce fournisseur. */
  trackFor(query: TrackQuery): Track {
    return Track.create({
      title: query.title,
      artist: query.artist ?? 'Artiste inconnu',
      link: `https://${this.name}.example/${encodeURIComponent(query.title)}`,
      source: this.name,
    });
  }

  succeed(): this {
    this.#behavior = (query) => Promise.resolve(this.trackFor(query));
    return this;
  }

  fail(error: Error = new MusicProviderUnavailableError(this.name, 'panne simulée')): this {
    this.#behavior = () => Promise.reject(error);
    return this;
  }

  /** Ne répond jamais : la promesse reste en attente. */
  hang(): this {
    this.#behavior = () =>
      new Promise<Track>(() => {
        // volontairement jamais résolue
      });
    return this;
  }

  resolve(query: TrackQuery): Promise<Track> {
    this.queries.push(query);
    this.#callLog?.push(this.name);
    return this.#behavior(query);
  }
}
