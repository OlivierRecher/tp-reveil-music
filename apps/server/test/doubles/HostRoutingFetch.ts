import type { HttpFetch } from '../../src/infrastructure/http/HttpFetch.ts';

type Responder = () => Promise<Response>;

/**
 * Faux `fetch` écrit à la main pour les tests de composition : enregistre l'hôte de chaque appel
 * (dans l'ordre) et répond selon l'hôte. Par défaut : 503. Aucun accès réseau.
 */
export class HostRoutingFetch {
  readonly hosts: string[] = [];
  readonly #routes = new Map<string, Responder>();
  #fallback: Responder = () =>
    Promise.resolve(new Response('Service Unavailable', { status: 503 }));

  readonly fetch: HttpFetch = (input) => {
    const host = new URL(String(input)).hostname;
    this.hosts.push(host);
    const responder = this.#routes.get(host) ?? this.#fallback;
    return responder();
  };

  /** Chaque appel vers cet hôte renvoie ce corps JSON (nouvelle réponse à chaque appel). */
  respondJson(host: string, body: unknown): this {
    this.#routes.set(host, () =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }),
      ),
    );
    return this;
  }

  /** Chaque appel, quel que soit l'hôte, échoue comme une coupure réseau. */
  rejectAll(): this {
    this.#routes.clear();
    this.#fallback = () => Promise.reject(new TypeError('fetch failed (réseau coupé, test)'));
    return this;
  }
}

export const ITUNES_HOST = 'itunes.apple.com';
export const MUSICBRAINZ_HOST = 'musicbrainz.org';
