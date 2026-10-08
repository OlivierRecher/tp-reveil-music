# ADR-0001 — Backend Node.js + client PWA plutôt qu'une PWA autonome

- Statut : Accepté (2026-10-08)

## En une phrase

**Tous les appels aux services externes (iTunes, MusicBrainz) et tous les envois de notification sont
faits par le serveur Node.js.** La PWA ne parle qu'à notre propre API.

## Qui appelle quoi

| Appel                                 | Fait par       | Jamais par |
| ------------------------------------- | -------------- | ---------- |
| iTunes Search API                     | serveur        | PWA        |
| MusicBrainz API                       | serveur        | PWA        |
| Service interne de préférences (mock) | serveur        | PWA        |
| Envoi email / SMS / push (mocks)      | serveur        | PWA        |
| `POST /api/wake-ups` (notre API)      | PWA, curl, CLI | —          |

```
PWA (navigateur) ──POST /api/wake-ups──► Serveur Node.js ──► iTunes / MusicBrainz / fallback local
       ▲                                       │
       └──────────── WakeUpReport ◄────────────┴──► mocks email / SMS / push
```

## Contexte : pourquoi pas une PWA autonome ?

L'équipe souhaitait une PWA TypeScript, sauf contre-indication de l'énoncé. Une PWA **autonome** (sans
serveur) obligerait le **navigateur** à appeler lui-même iTunes et MusicBrainz et à envoyer les
notifications. L'énoncé rend cela impossible ou fragile :

1. **MusicBrainz exige un en-tête `User-Agent` identifiable.** Un navigateur ne laisse pas le code
   JavaScript fixer cet en-tête de façon fiable (historiquement interdit, encore ignoré par Chromium) :
   les requêtes seraient rejetées.
2. **iTunes Search API** ne garantit pas les en-têtes CORS (Apple documente JSONP) : un appel depuis le
   navigateur peut être bloqué.
3. **Quota d'environ 20 requêtes/minute, à respecter « côté cache »** : chaque navigateur aurait son propre
   cache, sans protéger le quota global du service. Il faut un cache unique, donc côté serveur.
4. **Envoi à heure précise, jamais de silence** : un navigateur fermé ou en économie d'énergie n'exécute
   rien. Le déclenchement doit vivre sur un serveur toujours disponible.
5. **Email et SMS** sont par nature envoyés par un serveur.

## Décision

- Le cas d'usage `TriggerWakeUp` et tous les adaptateurs (musique, préférences, notifications) tournent
  dans le **serveur Node.js TypeScript** (`apps/server`), qui expose `POST /api/wake-ups`.
- La **PWA** (`apps/web`) est un client léger : installable, coquille hors ligne, formulaire de
  déclenchement de démonstration et affichage du rapport renvoyé par le serveur.
- Le noyau (`packages/core`) ne dépend d'aucun runtime : il resterait réutilisable ailleurs (worker,
  fonction serverless).

## Alternatives écartées

- PWA autonome : bloquée par les points 1 à 4.
- PWA + proxy CORS public tiers : dépendance externe non maîtrisée, contraire aux exigences légale et de
  fiabilité.

## Conséquences

- Deux applications en développement (`dev:server`, `dev:web`) ; Vite redirige `/api` vers le serveur.
- La PWA est une couche de présentation optionnelle : le TP est complet sans elle (phase 5 du plan).
- Une règle dependency-cruiser interdit à `apps/web` d'importer du code de `apps/server`.
