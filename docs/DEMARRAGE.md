# Démarrage et test — Réveil musical

Guide pas à pas pour installer, lancer et tester l'application. Présentation du projet et inventaire
des dépendances : [`README.md`](../README.md).

## Prérequis

- **Node.js 24 ou plus** (26 recommandé, voir `.nvmrc`) avec le npm fourni. `engine-strict` est actif :
  `npm install` refuse une version de Node plus ancienne. Vérifier avec `node -v`.
- **git** et un accès Internet (installation des paquets, puis appels réels à iTunes et MusicBrainz).
- Ports libres : **3000** (API), **5173** (PWA en dev), **4173** (PWA construite).

## 1. Récupérer et installer

```bash
git clone https://github.com/OlivierRecher/tp-reveil-music.git
cd tp-reveil-music
nvm use                 # facultatif, si nvm est installé
npm install
```

Un avertissement de `npm install` est **attendu** et sans conséquence :

- `install scripts blocked … fsevents` : npm bloque le script d'installation de ce paquet optionnel
  (macOS). Rien à autoriser, l'application fonctionne sans.

## 2. Configurer

```bash
cp .env.example .env
```

Le serveur **refuse de démarrer sans `.env`** (`Configuration invalide : MUSICBRAINZ_USER_AGENT: requis`) :
MusicBrainz exige un `User-Agent` identifiable. Remplacer `contact@example.com` par une adresse de
contact réelle. Les autres valeurs par défaut conviennent. Après toute modification de `.env`,
**redémarrer** le serveur (Ctrl+C puis relancer) : `node --watch` ne surveille pas ce fichier.

## 3. Lancer

Dans **deux terminaux** (chaque commande reste au premier plan) :

```bash
npm run dev:server      # terminal 1 — API : http://localhost:3000 (journal lisible par pino-pretty)
npm run dev:web         # terminal 2 — PWA : http://localhost:5173 (relaie /api vers le port 3000)
```

Ouvrir http://localhost:5173, saisir un **identifiant du jeu de données** (`u1` à `u4`, voir
ci-dessous), choisir un jour et une météo, puis « Déclencher le réveil ». Le rapport affiche le morceau et son
lien d'écoute, sa source (`itunes`, `musicbrainz` ou `local`), le canal utilisé, chaque tentative et,
le cas échéant, le mode dégradé. Vérification rapide : `curl http://localhost:3000/health` répond
`{"status":"ok"}`.

Version de production de la PWA (manifest, service worker, installable, hors ligne) : avec le serveur
toujours lancé,

```bash
npm run build:web                   # génère apps/web/dist
npm run preview -w @reveil/web      # http://localhost:4173, relaie aussi /api vers le port 3000
```

Contrôle complet du dépôt (format, lint, types, architecture, tests + couverture, licences, audit) :

```bash
npm run verify
```

## Tester l'application

### Utilisateurs du jeu de données

Les préférences sont simulées en mémoire
([`preferencesSeed.ts`](../apps/server/src/infrastructure/preferences/preferencesSeed.ts)) : seuls ces
quatre identifiants existent. Le jour de la semaine n'influence pas le choix du morceau (il apparaît
dans le message).

| Id   | SOLEIL                                      | PLUIE                            | NEIGE                                 | NUAGEUX                        | Morceau de secours (météo non couverte) | Canal       | Ce que l'utilisateur démontre                                                   |
| ---- | ------------------------------------------- | -------------------------------- | ------------------------------------- | ------------------------------ | --------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `u1` | Walking on Sunshine — Katrina and the Waves | Riders on the Storm — The Doors  | Let It Snow — Dean Martin             | Clouds — Joni Mitchell         | Lovely Day — Bill Withers               | EMAIL       | cas nominal : chaque météo a son morceau                                        |
| `u2` | Here Comes the Sun — The Beatles            | Singin’ in the Rain — Gene Kelly | —                                     | —                              | Good Morning — Kanye West               | SMS         | préférences partielles : NEIGE et NUAGEUX donnent le morceau de secours         |
| `u3` | Mr. Blue Sky — Electric Light Orchestra     | Purple Rain — Prince             | Snow (Hey Oh) — Red Hot Chili Peppers | Both Sides Now — Joni Mitchell | Wake Me Up — Avicii                     | PUSH        | troisième canal                                                                 |
| `u4` | Good Day Sunshine — The Beatles             | —                                | —                                     | Cloudbusting — Kate Bush       | Morning Has Broken — Cat Stevens        | SMS → EMAIL | canal préféré inutilisable (aucun numéro) : bascule sur EMAIL, `degraded: true` |

**Tout autre identifiant** (`olivier`, `1`, `U1`…) est un utilisateur inconnu, traité comme une panne
du service de préférences : préférences par défaut, donc **toujours « Here Comes the Sun » — The
Beatles quelle que soit la météo**, remis par le canal `LOG`, avec `degraded: true` (critère CA-APP-06).
Ce n'est pas un bug : c'est le mode dégradé garanti par l'énoncé.

Le titre affiché est celui que renvoie le catalogue interrogé ; il peut différer légèrement de la
préférence (« Let It Snow! Let It Snow! Let It Snow! », « Purple Rain — Prince & The Revolution »).

Jours : `LUNDI` … `DIMANCHE` ; météos : `SOLEIL`, `PLUIE`, `NEIGE`, `NUAGEUX`. Les envois simulés
(email, SMS, push) sont écrits dans `apps/server/logs/notifications.log` (`NOTIFICATION_LOG_FILE`).

### Sans navigateur

Script de démonstration, sans serveur (la trace de l'envoi simulé puis le rapport JSON sortent sur la
sortie standard, le journal pino sur la sortie d'erreur ; code de sortie 1 si un argument est
invalide) :

```bash
npm run wake -- --user u1 --day LUNDI --weather PLUIE
```

Par l'API HTTP (serveur lancé) :

```bash
curl -X POST http://localhost:3000/api/wake-ups \
  -H 'content-type: application/json' \
  -d '{"userId":"u1","dayOfWeek":"LUNDI","weather":"PLUIE"}'
# 200 : { userId, dayOfWeek, weather, track: { title, artist, link?, source }, trackSource,
#         deliveredVia, attempts: [{ channel, success, error? }], degraded }
# 400 : { "error": "INVALID_REQUEST", "details": [{ "field": "weather", "message": "Météo invalide…" }] }
# 500 : { "error": "INTERNAL_ERROR" } (détail uniquement dans le journal)

curl http://localhost:3000/health   # { "status": "ok" }
```

### Démontrer le mode dégradé

`SIMULATED_FAILURES` (liste séparée par virgules) met en panne des dépendances choisies, sans toucher
au code : `preferences`, `itunes`, `musicbrainz` (le `fetch` du fournisseur rejette, aucun appel
réseau), `email`, `sms`, `push` (le mock du fournisseur échoue).

```bash
SIMULATED_FAILURES=itunes,musicbrainz,email,sms,push \
  npm run wake -- --user u1 --day LUNDI --weather PLUIE
# → morceau local, remise par le canal LOG, "degraded": true, avertissements (warn) au journal
```

`MUSIC_PROVIDERS` change l'ordre ou la composition de la chaîne musicale (`musicbrainz,itunes`,
`musicbrainz`, ou vide pour le seul fallback local). Les envois simulés sont écrits dans
`NOTIFICATION_LOG_FILE` (chemin relatif au dossier `apps/server` avec les scripts npm ; `logs/` est
ignoré par git). Toutes les variables : [`.env.example`](../.env.example).

Pour voir le mode dégradé dans la PWA, mettre la même liste dans `.env`
(`SIMULATED_FAILURES=itunes,musicbrainz`, par exemple) puis redémarrer `npm run dev:server`.
