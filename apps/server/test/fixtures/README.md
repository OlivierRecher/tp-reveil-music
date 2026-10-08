# Fixtures de test

Réponses **réelles** des API externes, capturées le **2026-10-08** et stockées telles quelles (JSON
reformaté par prettier). Les tests n'accèdent jamais au réseau : ils rejouent ces réponses via un faux
`fetch`. Les tests qui ont besoin d'un cas particulier (entrée album, crédit unique…) modifient une copie
en mémoire, jamais le fichier.

| Fichier                      | Source      | Requête capturée                                                                                                                                  |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `itunes-search.json`         | iTunes      | `GET https://itunes.apple.com/search?term=Queen%20Under%20Pressure&media=music&limit=5`                                                           |
| `musicbrainz-recording.json` | MusicBrainz | `GET https://musicbrainz.org/ws/2/recording?query=recording:"Under Pressure" AND artist:"Queen & David Bowie"&fmt=json&limit=3` (requête encodée) |
| `musicbrainz-busy.json`      | MusicBrainz | Réponse d'erreur réelle `{ "error": … }` renvoyée par `/ws/2/recording` quand le serveur est saturé                                               |
