// Vérifie la licence de toutes les dépendances installées (directes et transitives)
// contre license-policy.json. Échoue (exit 1) à la moindre violation : utilisé en CI.
//
// - license-checker-rseidelsohn détecte les licences (champ `license`, sinon fichiers LICENSE).
// - `npm query .prod` donne l'ensemble des paquets de production, workspaces compris
//   (l'option --production de license-checker ne voit pas les dépendances des workspaces).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd, args) =>
  JSON.parse(execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

const policy = JSON.parse(readFileSync(new URL('../license-policy.json', import.meta.url), 'utf8'));
const detected = run('npx', [
  '--no-install',
  'license-checker-rseidelsohn',
  '--json',
  '--excludePrivatePackages',
]);
const production = new Set(
  run('npm', ['query', '.prod'])
    .filter((pkg) => !pkg.private)
    .map((pkg) => `${pkg.name}@${pkg.version}`),
);

// Garde-fou : un scan vide passerait silencieusement.
if (production.size === 0 || Object.keys(detected).length === 0) {
  console.error('Scan de licences vide : vérifier l’installation (npm ci).');
  process.exit(1);
}

// Une expression SPDX « A OR B » est acceptable si l'une des options l'est ; « A AND B » exige les deux.
const accepts = (expression, allowed) => {
  const clean = String(expression).replace(/[()*]/g, '').trim();
  if (clean.includes(' OR ')) return clean.split(' OR ').some((part) => accepts(part, allowed));
  if (clean.includes(' AND ')) return clean.split(' AND ').every((part) => accepts(part, allowed));
  return allowed.includes(clean);
};

const devAllowed = [...policy.allowed, ...policy.allowedDevOnly];
const violations = [];
for (const [pkg, info] of Object.entries(detected)) {
  const isProd = production.has(pkg);
  const licenses = Array.isArray(info.licenses) ? info.licenses.join(' AND ') : info.licenses;
  if (!accepts(licenses, isProd ? policy.allowed : devAllowed)) {
    violations.push({ scope: isProd ? 'prod' : 'dev', pkg, licenses });
  }
}

if (violations.length > 0) {
  console.error('Licences non conformes à license-policy.json :');
  console.table(violations);
  process.exit(1);
}
console.info(
  `Licences conformes : ${Object.keys(detected).length} paquets analysés, dont ${production.size} de production.`,
);
