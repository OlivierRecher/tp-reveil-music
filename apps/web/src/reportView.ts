import type { WakeUpReportView } from './wakeUpApi.ts';

/** Données prêtes à afficher pour un rapport de réveil (aucune logique dans le rendu DOM). */
export interface ReportViewModel {
  readonly title: string;
  readonly artist: string;
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
  throw new Error('Not implemented', { cause: report });
}
