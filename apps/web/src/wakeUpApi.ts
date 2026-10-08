import type { DayOfWeek, WeatherType } from './wakeUpOptions.ts';

/** Signature de `fetch` injectée (remplacée par un faux en test, aucun accès réseau). */
export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Corps de `POST /api/wake-ups`. */
export interface WakeUpRequest {
  readonly userId: string;
  readonly dayOfWeek: DayOfWeek;
  readonly weather: WeatherType;
}

/**
 * Tentative d'envoi sur un canal, telle que renvoyée par l'API. Le canal est une chaîne non vide,
 * pas une énumération : le serveur peut ajouter un canal (CA-NOT-05) sans casser le client.
 */
export interface DeliveryAttemptView {
  readonly channel: string;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Rapport de réveil renvoyé par l'API (200), une fois validé. Jour, météo et canaux sont des chaînes
 * non vides (le serveur reste seul juge des valeurs) ; les champs inconnus sont ignorés et retirés.
 */
export interface WakeUpReportView {
  readonly userId: string;
  readonly dayOfWeek: string;
  readonly weather: string;
  readonly track: {
    readonly title: string;
    readonly artist: string;
    readonly link?: string;
    readonly source: string;
  };
  readonly trackSource: string;
  readonly deliveredVia: string;
  readonly attempts: ReadonlyArray<DeliveryAttemptView>;
  readonly degraded: boolean;
}

/** Issue d'un déclenchement : jamais d'exception, toujours un résultat affichable. */
export type WakeUpOutcome =
  | { readonly kind: 'report'; readonly report: WakeUpReportView }
  | { readonly kind: 'invalid-request'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly message: string };

/**
 * Déclenche un réveil via notre API (même origine, ADR-0001). La réponse 200 est validée avant
 * d'être exposée ; toute erreur (400, 5xx, réseau, format inattendu) devient un `WakeUpOutcome`.
 */
export function requestWakeUp(
  request: WakeUpRequest,
  httpFetch: HttpFetch,
): Promise<WakeUpOutcome> {
  return Promise.reject(new Error('Not implemented', { cause: { request, httpFetch } }));
}
