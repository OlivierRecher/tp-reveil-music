/** Raison lisible d'une erreur rattrapée, pour les journaux et les tentatives. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
