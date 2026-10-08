import type { DeliveryAttempt, TrackJson, WakeUpReport } from '@reveil/core';

/** Représentation JSON du rapport de réveil renvoyée par l'API. */
export interface WakeUpReportJson {
  readonly userId: string;
  readonly dayOfWeek: string;
  readonly weather: string;
  readonly track: TrackJson;
  readonly trackSource: string;
  readonly deliveredVia: string;
  readonly attempts: ReadonlyArray<DeliveryAttempt>;
  readonly degraded: boolean;
}

/** Sérialisation explicite : le morceau (value object) passe par son `toJSON`. */
export function toReportJson(report: WakeUpReport): WakeUpReportJson {
  return { ...report, track: report.track.toJSON() };
}
