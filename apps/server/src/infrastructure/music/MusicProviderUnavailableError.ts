/**
 * Indisponibilité d'un fournisseur musical : HTTP non 2xx, JSON malformé, réponse vide, schéma
 * invalide, délai dépassé, quota atteint, circuit ouvert ou erreur réseau. Erreur typée unique, pour que
 * la chaîne `FallbackMusicCatalog` bascule sans connaître les détails techniques de chaque source.
 */
export class MusicProviderUnavailableError extends Error {
  readonly providerName: string;

  constructor(providerName: string, reason: string, options?: ErrorOptions) {
    super(`Fournisseur musical « ${providerName} » indisponible : ${reason}`, options);
    this.name = 'MusicProviderUnavailableError';
    this.providerName = providerName;
  }
}
