import type { DeliveryAttemptView, WakeUpReportView } from './wakeUpApi.ts';

/** Données prêtes à afficher pour un rapport de réveil (aucune logique dans le rendu DOM). */
export interface ReportViewModel {
  readonly title: string;
  readonly artist: string;
  /** Lien d'écoute, uniquement s'il est en http(s). */
  readonly link?: string;
  /** Libellé du canal qui a effectivement délivré la notification. */
  readonly deliveredVia: string;
  /** Une ligne par tentative : « ✓ EMAIL » ou « ✗ SMS : raison ». */
  readonly attempts: ReadonlyArray<string>;
  /** Vrai si et seulement si le rapport indique un mode dégradé. */
  readonly degradedBadge: boolean;
}

/** Traduit un rapport validé en modèle de vue (fonction pure). */
export function toReportViewModel(report: WakeUpReportView): ReportViewModel {
  const { title, artist } = report.track;
  const link = safeLink(report.track.link);
  return {
    title,
    artist,
    ...(link === undefined ? {} : { link }),
    deliveredVia: `Notifié par ${report.deliveredVia}`,
    attempts: report.attempts.map(describeAttempt),
    // Le badge suit uniquement le verdict du serveur, jamais une déduction locale (ADR-0004).
    degradedBadge: report.degraded,
  };
}

/**
 * Ne garde qu'un lien http(s) : l'URL finit dans un `href`, un schéma `javascript:` ou `data:` venu
 * d'une réponse altérée ne doit jamais devenir cliquable (défense en profondeur côté client).
 */
function safeLink(link: string | undefined): string | undefined {
  if (link === undefined || !URL.canParse(link)) return undefined;
  const { protocol } = new URL(link);
  return protocol === 'https:' || protocol === 'http:' ? link : undefined;
}

function describeAttempt(attempt: DeliveryAttemptView): string {
  if (attempt.success) return `✓ ${attempt.channel}`;
  return attempt.error === undefined || attempt.error === ''
    ? `✗ ${attempt.channel}`
    : `✗ ${attempt.channel} : ${attempt.error}`;
}
