// `zod/mini` : API fonctionnelle, arborescente (tree-shaking), bundle bien plus léger que `zod`
// classique pour un client ; elle suffit à notre schéma (objets, chaînes, booléens, listes).
import { z } from 'zod/mini';
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

/** URL relative : même origine que la PWA, le proxy Vite ou le serveur la redirige (ADR-0001). */
const WAKE_UPS_PATH = '/api/wake-ups';

const UNAVAILABLE: WakeUpOutcome = {
  kind: 'unavailable',
  message: 'Service indisponible : réessayez dans quelques instants.',
};

const INVALID_REQUEST: WakeUpOutcome = {
  kind: 'invalid-request',
  message: 'Saisie invalide : vérifiez l’utilisateur, le jour et la météo.',
};

const nonEmptyString = z.string().check(z.minLength(1));

/** Contrat de la réponse 200 ; `z.object` retire les champs inconnus (rien ne fuite vers la vue). */
const reportSchema = z.object({
  userId: nonEmptyString,
  dayOfWeek: nonEmptyString,
  weather: nonEmptyString,
  track: z.object({
    title: nonEmptyString,
    artist: nonEmptyString,
    link: z.exactOptional(z.string()),
    source: nonEmptyString,
  }),
  trackSource: nonEmptyString,
  deliveredVia: nonEmptyString,
  attempts: z.array(
    z.object({
      channel: nonEmptyString,
      success: z.boolean(),
      error: z.exactOptional(z.string()),
    }),
  ),
  degraded: z.boolean(),
});

/**
 * Déclenche un réveil via notre API (même origine, ADR-0001). La réponse 200 est validée avant
 * d'être exposée ; toute erreur (400, 5xx, réseau, format inattendu) devient un `WakeUpOutcome`.
 */
export async function requestWakeUp(
  request: WakeUpRequest,
  httpFetch: HttpFetch,
): Promise<WakeUpOutcome> {
  let response: Response;
  try {
    response = await httpFetch(WAKE_UPS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        userId: request.userId,
        dayOfWeek: request.dayOfWeek,
        weather: request.weather,
      }),
    });
  } catch {
    return UNAVAILABLE;
  }

  if (response.status === 400) return INVALID_REQUEST;
  if (!response.ok) return UNAVAILABLE;

  const parsed = reportSchema.safeParse(await readJson(response));
  return parsed.success ? { kind: 'report', report: parsed.data } : UNAVAILABLE;
}

/** Lit le corps JSON ; un corps illisible devient `undefined`, rejeté ensuite par le schéma. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}
