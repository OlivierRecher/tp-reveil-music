# Critères d'acceptation — Réveil musical

Ce document est la **source de vérité des tests**. Chaque critère est observable, testable, et
rattaché à sa source : l'énoncé (`TP_reveil_musical.pdf`), un ADR ou une hypothèse documentée
(`ARCHITECTURE.md` §6).

Règles :

- Les tests d'une phase sont écrits **à partir de ce document, avant le code de production** (cf.
  `CLAUDE.md` § Tests écrits en amont). Le nom de chaque test commence par l'ID du critère :
  `it('[CA-MUS-03] bascule sur le fournisseur suivant quand le premier est en panne', …)`.
- Un critère n'est modifié ou supprimé que par une décision humaine, tracée dans le commit (et dans un
  ADR si elle change le comportement attendu). **On ne modifie jamais un critère pour qu'il
  corresponde au code.**
- La colonne « Validé » est cochée par l'équipe après relecture, avant que les tests correspondants
  soient écrits.

Sources : **É** = énoncé · **ADR-n** · **H** = hypothèse (ARCHITECTURE §6)

---

## Phase 1 — Domaine

| ID        | Critère                                                                                                                                                    | Source                                             | Validé |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| CA-DOM-01 | Les seuls types de météo acceptés sont `SOLEIL`, `PLUIE`, `NEIGE`, `NUAGEUX` ; toute autre valeur est rejetée                                              | É « Point d'entrée »                               | [x]    |
| CA-DOM-02 | Les seuls jours acceptés sont `LUNDI` … `DIMANCHE` ; toute autre valeur est rejetée                                                                        | É, H                                               | [x]    |
| CA-DOM-03 | Un identifiant utilisateur vide ou composé d'espaces est rejeté                                                                                            | É                                                  | [x]    |
| CA-DOM-04 | Si l'utilisateur a un morceau pour la météo du jour, c'est ce morceau qui est demandé                                                                      | É « Point d'entrée »                               | [x]    |
| CA-DOM-05 | Si la météo du jour n'est pas couverte par ses préférences, le morceau de secours de l'utilisateur est demandé                                             | É « morceau de secours pour les cas non couverts » | [x]    |
| CA-DOM-06 | Pour chacune des 4 météos, CA-DOM-04 et CA-DOM-05 sont vérifiés (tests paramétrés)                                                                         | É                                                  | [x]    |
| CA-DOM-07 | Un morceau du domaine a un titre et un artiste non vides ; aucun champ propre à un fournisseur (`trackViewUrl`, `artist-credit`…) n'existe dans le domaine | É « ne doit pas fuiter dans le métier »            | [x]    |
| CA-DOM-08 | Le message de réveil contient le titre, l'artiste, le jour et la météo                                                                                     | É, H                                               | [x]    |

## Phase 2 — Application (cas d'usage `TriggerWakeUp`)

| ID        | Critère                                                                                                                                                       | Source                        | Validé |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------ |
| CA-APP-01 | Nominal : un appel `(userId, jour, météo)` envoie exactement une notification, sur le canal préféré, avec le morceau choisi                                   | É                             | [x]    |
| CA-APP-02 | Le cas d'usage ne dépend que d'interfaces (ports) : il est testable avec des doublures écrites à la main, sans réseau ni conteneur                            | É « Isolation », « IoC / DI » | [x]    |
| CA-APP-03 | Si le catalogue musical lève une erreur, une notification est **quand même** envoyée avec un morceau de secours local, et le rapport indique `degraded: true` | É « un silence ne l'est pas » | [x]    |
| CA-APP-04 | Si le canal préféré échoue, la notification est envoyée sur un autre canal disponible pour cet utilisateur ; le rapport liste la tentative échouée            | É « Fiabilité »               | [x]    |
| CA-APP-05 | Si tous les canaux échouent, le canal de dernier recours (journal) reçoit le message ; le cas d'usage ne lève pas d'exception                                 | É « jamais empêcher l'envoi » | [x]    |
| CA-APP-06 | Si le service de préférences est en panne ou l'utilisateur inconnu, un réveil est quand même émis (préférences par défaut), `degraded: true`                  | É, H                          | [x]    |
| CA-APP-07 | En fonctionnement nominal, le rapport indique `degraded: false`                                                                                               | ADR-0004                      | [x]    |
| CA-APP-08 | Toute bascule en mode dégradé est journalisée au niveau `warn`                                                                                                | ADR-0004                      | [x]    |
| CA-APP-09 | Un canal n'est tenté que si l'utilisateur possède la coordonnée correspondante                                                                                | H                             | [x]    |

Précision (décision d'équipe, 2026-10-08) : le rapport est `degraded: true` dès qu'une bascule a eu
lieu, c'est-à-dire préférences par défaut, morceau de source locale (renvoyé par le catalogue ou tiré
de `EmergencyPlaylist`), ou livraison sur un autre canal que le préféré. Un morceau de secours choisi
par l'utilisateur pour une météo non couverte est un fonctionnement **normal** (`degraded: false`).

## Phase 3 — Adaptateurs

### Musique

| ID        | Critère                                                                                                                                                  | Source                             | Validé |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ |
| CA-MUS-01 | L'adaptateur iTunes appelle `https://itunes.apple.com/search?term=<morceau>&media=music&limit=5` (terme encodé)                                          | É « APIs »                         | [x]    |
| CA-MUS-02 | L'adaptateur iTunes traduit `trackName`/`artistName` en morceau du domaine ; `trackViewUrl` n'apparaît pas tel quel hors de l'adaptateur                 | É                                  | [x]    |
| CA-MUS-03 | L'adaptateur MusicBrainz appelle `https://musicbrainz.org/ws/2/recording?query=<morceau>&fmt=json` avec l'en-tête `User-Agent` configuré                 | É                                  | [x]    |
| CA-MUS-04 | Le démarrage échoue explicitement si le `User-Agent` MusicBrainz n'est pas configuré                                                                     | É, ADR-0004                        | [x]    |
| CA-MUS-05 | L'adaptateur MusicBrainz traduit `title` et `artist-credit` en morceau du domaine                                                                        | É                                  | [x]    |
| CA-MUS-06 | Une réponse vide, malformée, une erreur HTTP ou un dépassement de délai est traité comme une indisponibilité du fournisseur (erreur typée, pas de crash) | É « en panne »                     | [x]    |
| CA-MUS-07 | La chaîne essaie les fournisseurs dans l'ordre configuré et renvoie le premier résultat valide                                                           | É « changer rapidement », ADR-0004 | [x]    |
| CA-MUS-08 | Si tous les fournisseurs distants échouent, le fallback local renvoie un morceau ; le fallback local ne lève jamais                                      | É « Fallback local »               | [x]    |
| CA-MUS-09 | Deux recherches identiques dans la durée du cache ne déclenchent qu'un seul appel HTTP                                                                   | É « respecter côté cache »         | [x]    |
| CA-MUS-10 | Au-delà de 20 requêtes par minute vers iTunes, l'appel suivant n'atteint pas iTunes et bascule immédiatement sur le fournisseur suivant                  | É « ~20 requêtes/minute »          | [x]    |
| CA-MUS-11 | Un fournisseur qui ne répond pas dans le délai configuré est abandonné au profit du suivant                                                              | ADR-0004                           | [x]    |
| CA-MUS-12 | Après plusieurs échecs consécutifs, un fournisseur n'est plus appelé pendant la période d'ouverture du circuit                                           | ADR-0004                           | [x]    |

### Notifications

| ID        | Critère                                                                                                                                    | Source                                   | Validé |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------ |
| CA-NOT-01 | Les mocks email, SMS et push exposent trois interfaces **différentes** (signatures et styles d'erreur distincts)                           | É « volontairement différente »          | [x]    |
| CA-NOT-02 | Chaque mock écrit l'envoi dans la console ou un fichier de log, sans envoi réel                                                            | É                                        | [x]    |
| CA-NOT-03 | Chaque adaptateur ramène son mock à l'interface commune `NotificationChannel`                                                              | É « ramener vers une interface commune » | [x]    |
| CA-NOT-04 | Un rejet ou une erreur du mock (promesse rejetée, statut `REJECTED`, erreur de callback) devient un échec d'envoi uniforme côté adaptateur | É, ADR-0004                              | [x]    |
| CA-NOT-05 | Ajouter un canal (ex. WhatsApp) ne demande aucune modification de `packages/core` hors de la liste des types de canal                      | É « nouveaux canaux »                    | [x]    |

### Préférences (mock du service interne)

| ID        | Critère                                                                                                                     | Source                              | Validé |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------ |
| CA-PRF-01 | Le mock renvoie, pour un ID connu, un morceau par météo (éventuellement partiel), un morceau de secours et le canal préféré | É                                   | [x]    |
| CA-PRF-02 | Le mock est accédé via une interface, comme tout fournisseur                                                                | É « un fournisseur comme un autre » | [x]    |

## Phase 4 — Composition et points d'entrée

| ID        | Critère                                                                                                                                     | Source                        | Validé |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------ |
| CA-CMP-01 | Toutes les dépendances du cas d'usage sont résolues par le conteneur ; aucun `new` d'implémentation hors de la composition root (lint)      | É « IoC / DI »                | [x]    |
| CA-CMP-02 | Changer `MUSIC_PROVIDERS` (ex. `musicbrainz,itunes` ou `musicbrainz`) change l'ordre ou la composition de la chaîne sans modifier le code   | É « changer rapidement »      | [x]    |
| CA-CMP-03 | `POST /api/wake-ups` avec un corps valide renvoie 200 et le rapport de réveil                                                               | É, ADR-0001                   | [x]    |
| CA-CMP-04 | `POST /api/wake-ups` avec une météo, un jour ou un ID invalide renvoie 400 sans déclencher d'envoi                                          | É                             | [x]    |
| CA-CMP-05 | Avec tous les fournisseurs musicaux et canaux simulés en panne, l'API renvoie quand même 200, un morceau local et une trace dans le journal | É « un silence ne l'est pas » | [x]    |

## Phase 5 — Client PWA

| ID        | Critère                                                                                                                                                           | Source                        | Validé |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------ |
| CA-WEB-01 | Le formulaire propose l'identifiant utilisateur, le jour (les 7 valeurs `LUNDI` … `DIMANCHE`) et la météo (les 4 valeurs de l'énoncé), chaque champ étant libellé | É « Point d'entrée »          | [x]    |
| CA-WEB-02 | La soumission envoie `POST /api/wake-ups` (même origine) avec le corps JSON `{ userId, dayOfWeek, weather }` ; le client n'appelle jamais iTunes ni MusicBrainz   | ADR-0001                      | [x]    |
| CA-WEB-03 | Un rapport reçu (200) est affiché : titre, artiste, lien s'il existe, canal utilisé et liste des tentatives (canal, succès ou échec)                              | É, ADR-0004                   | [x]    |
| CA-WEB-04 | Un badge « mode dégradé » est affiché si et seulement si le rapport indique `degraded: true`                                                                      | ADR-0004                      | [x]    |
| CA-WEB-05 | Une réponse 400 affiche une erreur de saisie ; une erreur réseau ou 5xx affiche « service indisponible » ; aucun plantage, le formulaire reste utilisable         | É « un silence ne l'est pas » | [x]    |
| CA-WEB-06 | Une réponse 200 au format inattendu est traitée comme une erreur (réponse validée), jamais affichée partiellement                                                 | É « ne doit pas fuiter »      | [x]    |
| CA-WEB-07 | L'application est installable : manifest (nom, icônes 192 et 512 px, `display: standalone`) et service worker mettant en cache la coquille                        | ADR-0001                      | [x]    |
| CA-WEB-08 | Accessibilité de base : champs libellés, zone de résultat annoncée (`aria-live`), utilisable entièrement au clavier, contrastes AA                                | ADR-0001                      | [x]    |

Critères rédigés et validés le 2026-10-08 (exécution autonome des phases demandée par l'équipe).
CA-WEB-07 et CA-WEB-08 sont vérifiés par le build et une revue manuelle (Lighthouse) ; les autres par des tests.

## Transverses (vérifiés par l'outillage)

| ID        | Critère                                                                                                    | Source                          | Vérifié par            |
| --------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------- |
| CA-ARC-01 | `packages/core` n'importe aucun package npm ni module Node                                                 | É « Isolation »                 | `arch:check`           |
| CA-ARC-02 | Seule la composition root importe les implémentations concrètes                                            | É « IoC / DI »                  | `arch:check`, `lint`   |
| CA-DEP-01 | Toute dépendance a une licence autorisée et figure dans le README avec version, fraîcheur et justification | É « Côté légal », « Livrables » | `deps:licenses`, revue |
| CA-DEP-02 | Aucune vulnérabilité high/critical sans exception documentée et non expirée                                | É « Côté légal »                | `deps:audit`           |
| CA-TST-01 | Couverture ≥ 90 % lignes et fonctions, ≥ 85 % branches                                                     | É « bon niveau de couverture »  | `test:coverage`        |
