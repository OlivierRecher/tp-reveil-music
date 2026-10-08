# ADR-0002 — Architecture hexagonale en monorepo npm workspaces

- Statut : Accepté (2026-10-08)

## Contexte

Exigences : aucune classe métier ne doit connaître un détail technique d'un fournisseur ou d'un canal ;
changer de fournisseur ou de canal « sans tout réécrire ». Le cours porte sur la gestion des dépendances.

## Décision

- **Ports & Adapters** : `domain` (règles pures) ← `application` (cas d'usage + ports) ← `infrastructure`
  (adaptateurs) ; la composition root assemble le tout.
- **Monorepo npm workspaces** : `packages/core`, `apps/server`, `apps/web`. Chaque workspace déclare ses
  propres dépendances : le `package.json` de `core` **sans aucune dépendance** matérialise la règle
  d'isolation, et `dependency-cruiser` la vérifie en CI (y compris l'interdiction des modules `node:*`).
- npm workspaces natifs plutôt que pnpm/Nx/Turborepo : aucun outil supplémentaire à vérifier pour 3 paquets.

## Alternatives écartées

- Un seul paquet avec des dossiers : les frontières ne sont que des conventions.
- Nx / Turborepo : surdimensionné, nombreuses dépendances transitives.
- Clean Architecture « complète » (use case interactors, presenters, DTO par couche) : cérémonie
  excessive pour un seul cas d'usage.

## Conséquences

- Ajouter un fournisseur = un adaptateur dans `infrastructure/music/` + une entrée dans le conteneur.
- Ajouter un canal (WhatsApp, appel vocal) = un adaptateur + une valeur de `ChannelType` + une entrée
  dans le registre.
