/** Échappe les caractères spéciaux HTML d'un texte avant de l'insérer dans un document. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;') // en premier : ne pas ré-échapper les entités produites ensuite
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
