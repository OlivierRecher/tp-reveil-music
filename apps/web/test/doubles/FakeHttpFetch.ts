import type { HttpFetch } from '../../src/wakeUpApi.ts';

/** Requête reçue par le faux `fetch`, pour vérifier URL, méthode, en-têtes et corps. */
export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | undefined;
}

/**
 * Faux `fetch` écrit à la main : enregistre chaque requête et renvoie la réponse scriptée
 * (ou rejette, pour simuler une erreur réseau). Aucun accès réseau.
 */
export class FakeHttpFetch {
  readonly requests: RecordedRequest[] = [];
  #respond: () => Promise<Response> = () =>
    Promise.reject(new Error('FakeHttpFetch : aucune réponse scriptée'));

  readonly fetch: HttpFetch = (input, init) => {
    this.requests.push({
      url: input,
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return this.#respond();
  };

  /** Répond avec ce corps sérialisé en JSON. */
  respondJson(body: unknown, status = 200): this {
    this.#respond = () =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }),
      );
    return this;
  }

  /** Répond avec un corps texte brut (JSON malformé, page d'erreur d'un proxy…). */
  respondText(text: string, status: number): this {
    this.#respond = () => Promise.resolve(new Response(text, { status }));
    return this;
  }

  /** Simule une erreur réseau : la promesse de `fetch` est rejetée. */
  failWithNetworkError(): this {
    this.#respond = () => Promise.reject(new TypeError('Failed to fetch'));
    return this;
  }
}
