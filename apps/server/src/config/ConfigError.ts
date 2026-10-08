/** Configuration d'environnement invalide : le serveur refuse de démarrer (échec explicite). */
export class ConfigError extends Error {
  /** Détail par variable invalide, par exemple `MUSICBRAINZ_USER_AGENT: requis`. */
  readonly issues: ReadonlyArray<string>;

  constructor(issues: ReadonlyArray<string>) {
    super(`Configuration invalide :\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = Object.freeze([...issues]);
  }
}
