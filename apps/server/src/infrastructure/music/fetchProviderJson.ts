import type { HttpFetch } from '../http/HttpFetch.ts';
import { MusicProviderUnavailableError } from './MusicProviderUnavailableError.ts';

/**
 * Appel HTTP GET d'un fournisseur musical, renvoyant le corps JSON brut (non validé).
 * Erreur réseau, statut non 2xx et JSON malformé deviennent tous `MusicProviderUnavailableError` :
 * l'adaptateur n'a plus qu'à valider le schéma et traduire vers le domaine.
 */
export async function fetchProviderJson(
  httpFetch: HttpFetch,
  providerName: string,
  url: URL,
  headers: Readonly<Record<string, string>> = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await httpFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
    });
  } catch (error) {
    throw new MusicProviderUnavailableError(providerName, 'erreur réseau', { cause: error });
  }
  if (!response.ok) {
    throw new MusicProviderUnavailableError(providerName, `HTTP ${String(response.status)}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new MusicProviderUnavailableError(providerName, 'JSON malformé', { cause: error });
  }
}
