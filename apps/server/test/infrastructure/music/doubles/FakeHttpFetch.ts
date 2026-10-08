import type { HttpFetch } from '../../../../src/infrastructure/http/HttpFetch.ts';

/** Requête reçue par le faux `fetch`, pour vérifier URL, méthode et en-têtes. */
export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
}

type Responder = () => Promise<Response>;

/**
 * Faux `fetch` écrit à la main : enregistre chaque requête et renvoie des réponses scriptées
 * (une par appel, dans l'ordre, puis la réponse permanente éventuelle). Aucun accès réseau.
 */
export class FakeHttpFetch {
  readonly requests: RecordedRequest[] = [];
  readonly #queue: Responder[] = [];
  #always: Responder | undefined;

  readonly fetch: HttpFetch = (input, init) => {
    this.requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
    });
    const responder = this.#queue.shift() ?? this.#always;
    if (responder === undefined) {
      return Promise.reject(new Error('FakeHttpFetch : aucune réponse scriptée'));
    }
    return responder();
  };

  /** Prochaine réponse : corps JSON sérialisé. */
  respondJson(body: unknown, status = 200): this {
    this.#queue.push(() => Promise.resolve(jsonResponse(body, status)));
    return this;
  }

  /** Prochaine réponse : corps texte brut (JSON malformé, page d'erreur…). */
  respondText(text: string, status = 200): this {
    this.#queue.push(() => Promise.resolve(new Response(text, { status })));
    return this;
  }

  /** Prochain appel : erreur réseau (promesse rejetée). */
  failWith(error: Error): this {
    this.#queue.push(() => Promise.reject(error));
    return this;
  }

  /** Une fois la file épuisée, chaque appel renvoie ce corps JSON. */
  alwaysRespondJson(body: unknown, status = 200): this {
    this.#always = () => Promise.resolve(jsonResponse(body, status));
    return this;
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
