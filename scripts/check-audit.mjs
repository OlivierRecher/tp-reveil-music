// Surcouche de `npm audit` : échoue sur toute vulnérabilité high/critical, sauf exception
// documentée et non expirée dans audit-exceptions.json (cf. docs/DEPENDENCY_POLICY.md).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BLOCKING = new Set(['high', 'critical']);
const { exceptions } = JSON.parse(
  readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'),
);
const today = new Date().toISOString().slice(0, 10);
const active = new Map(exceptions.filter((e) => e.expiresOn >= today).map((e) => [e.advisory, e]));
const expired = exceptions.filter((e) => e.expiresOn < today);

// npm audit sort en code 1 dès qu'il trouve quelque chose : on lit le JSON quel que soit le code.
const report = JSON.parse(spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' }).stdout);

const advisories = Object.values(report.vulnerabilities ?? {})
  .flatMap((v) => v.via.filter((via) => typeof via === 'object'))
  .filter((via) => BLOCKING.has(via.severity));
const unique = [...new Map(advisories.map((a) => [a.url, a])).values()];
const blocking = unique.filter((a) => !active.has(a.url.split('/').pop()));

for (const e of expired)
  console.warn(`Exception expirée le ${e.expiresOn} : ${e.advisory} (${e.package})`);
for (const a of unique.filter((a) => !blocking.includes(a)))
  console.warn(`Accepté (exception) : ${a.name} — ${a.title}`);

if (blocking.length > 0) {
  console.error('Vulnérabilités bloquantes :');
  console.table(
    blocking.map((a) => ({ package: a.name, severity: a.severity, title: a.title, url: a.url })),
  );
  process.exit(1);
}
console.info('Audit : aucune vulnérabilité bloquante non couverte par une exception valide.');
