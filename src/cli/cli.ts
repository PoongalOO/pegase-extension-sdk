#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { archivePegext, empreinte } from './archive.js';
import { lireProjet, verifierTailleArchive } from './projet.js';

/**
 * Outils des développeurs d'extensions :
 *
 *   pegase-extension valider [dossier]                      manifeste et fichiers, comme Pégase avant installation
 *   pegase-extension construire [dossier] [--sortie=dist]   archive .pegext reproductible et son empreinte SHA-256
 */
const [commande = 'aide', ...reste] = process.argv.slice(2);
const options = Object.fromEntries(reste.filter((a) => a.startsWith('--')).map((a) => {
  const [cle, valeur = 'true'] = a.slice(2).split('=');
  return [cle, valeur];
}));
const dossier = resolve(reste.find((a) => !a.startsWith('--')) ?? '.');

try {
  switch (commande) {
    case 'valider': {
      const { manifeste, fichiers } = lireProjet(dossier);
      console.log(`${manifeste.id} ${manifeste.version} : manifeste et ${fichiers.size} fichiers conformes.`);
      break;
    }
    case 'construire': {
      const { manifeste, fichiers } = lireProjet(dossier);
      const archive = archivePegext(fichiers);
      verifierTailleArchive(archive);
      const sortie = resolve(String(options.sortie ?? join(dossier, 'dist')));
      mkdirSync(sortie, { recursive: true });
      const nom = `${manifeste.id.replace('/', '-')}-${manifeste.version}.pegext`;
      const hash = empreinte(archive);
      writeFileSync(join(sortie, nom), archive);
      writeFileSync(join(sortie, `${nom}.sha256`), `${hash}  ${nom}\n`);
      console.log(`${join(sortie, nom)}\nSHA-256 : ${hash}`);
      break;
    }
    default:
      console.log('pegase-extension valider [dossier]\npegase-extension construire [dossier] [--sortie=dossier]');
      process.exitCode = commande === 'aide' ? 0 : 1;
  }
} catch (erreur) {
  console.error((erreur as Error).message);
  process.exitCode = 1;
}
