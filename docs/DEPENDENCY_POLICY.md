# Politique de gestion des dépendances

> Exigence de la direction : _« aucun composant externe ne doit être intégré sans vérification préalable
> de sa licence et de sa fraîcheur »_. Ce document est la procédure qui la met en œuvre.
> Elle s'applique aux dépendances directes **et** transitives, de production **et** de développement.

## 1. Faut-il une dépendance ?

| Question                                                                                                        | Si oui                                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| La plateforme (Node 24+, navigateur) le fait-elle ? (`fetch`, `AbortSignal.timeout`, `structuredClone`…)        | **pas de dépendance**                                 |
| Est-ce moins de ~30 lignes simples, sans cas limites subtils ?                                                  | **pas de dépendance**                                 |
| Est-ce un problème connu et piégeux (cache LRU/TTL, circuit breaker, validation de schéma, DI, rate limiting) ? | **dépendance éprouvée** : on ne réinvente pas la roue |
| Le besoin est-il limité aux tests ou à l'outillage ?                                                            | `devDependency` uniquement                            |

## 2. Checklist de vérification (à recopier dans la PR)

```
### Dépendance : <nom>@<version>
- [ ] Besoin justifié (section 1) et alternatives comparées (au moins 2)
- [ ] Licence : <SPDX> — présente dans license-policy.json (allowed / allowedDevOnly)
- [ ] Fraîcheur : dernière stable <x.y.z> publiée le <date> (< 12 mois)
- [ ] Maintenance : activité récente du dépôt, plus d'un mainteneur ou organisation identifiée
- [ ] Poids : nombre de dépendances transitives (npm view <pkg> dependencies) jugé acceptable
- [ ] Compatibilité : engines.node et peerDependencies compatibles avec la stack
- [ ] Sécurité : `npm run deps:audit` vert après installation
- [ ] Pas de script d'installation (ou script revu avant `npm install-scripts approve`)
- [ ] Installée en version exacte dans le bon workspace (jamais de runtime dans packages/core)
- [ ] Ligne ajoutée au tableau du README.md ; ADR si le choix est structurant
```

Commandes utiles :

```bash
npm view <pkg> version license engines peerDependencies dependencies --json
npm view <pkg> "time[$(npm view <pkg> version)]"   # date de la dernière stable
npm run deps:licenses && npm run deps:audit && npm run deps:outdated
```

## 3. Licences

Définies dans `license-policy.json`, vérifiées par `npm run deps:licenses` (license-checker-rseidelsohn).

| Catégorie            | Licences                                                           | Règle                                                 |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Autorisées partout   | MIT, ISC, Apache-2.0, BSD-2/3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0 | OK                                                    |
| Outillage uniquement | Python-2.0, CC-BY-3.0, CC-BY-4.0, MPL-2.0                          | jamais embarquées dans le produit livré               |
| Interdites           | GPL, AGPL, LGPL, SSPL, EUPL, BUSL, sans licence, licence inconnue  | copyleft ou non-libre : risque pour la levée de fonds |

Une expression SPDX `A OR B` est acceptée si l'une des branches l'est ; `A AND B` exige les deux.

## 4. Fraîcheur

| Dernière version stable publiée | Statut               | Action                        |
| ------------------------------- | -------------------- | ----------------------------- |
| < 12 mois                       | 🟢 frais             | —                             |
| 12 à 24 mois                    | 🟠 à surveiller      | justification dans le README  |
| > 24 mois ou dépôt archivé      | 🔴 refusé par défaut | dérogation par ADR uniquement |

On installe la **dernière stable**, sauf incompatibilité documentée (ex. TypeScript 6.0.x au lieu de 7,
ADR-0005). Les versions sont figées (`save-exact=true`) et le `package-lock.json` est commité :
toute montée de version est un acte volontaire et revu.

## 5. Vulnérabilités et exceptions

`npm run deps:audit` échoue sur toute vulnérabilité **high/critical**, sauf exception listée dans
`audit-exceptions.json`. Une exception exige : identifiant GHSA, chemin de dépendance, analyse
d'exploitabilité, date d'acceptation et **date d'expiration** (3 mois maximum). Après expiration, la CI
échoue de nouveau et la décision doit être réévaluée.

Exception en cours : GHSA-vfj7-8cjw-p6xm (`braces` via `awilix`), voir ADR-0003.

## 6. Revue périodique

À chaque début de phase du plan : `npm run deps:outdated`, mise à jour du tableau du README
(colonnes « dernière stable » et « fraîcheur »), revue des exceptions d'audit.
