import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lireProjet } from '../dist/cli/projet.js';

const manifeste = {
  manifeste: 1, id: 'essai/hello', nom: 'Essai', description: 'Extension d\'essai du SDK de Pégase.', version: '1.0.0',
  auteurs: [{ nom: 'Essai' }], licence: 'MIT', compatibilite: { pegase: '>=1.8.0', api: '1' },
  permissions: [{ id: 'stockage:prive', justification: 'Enregistrer le message de chaque personne.' }],
  points_entree: { pages: [{ id: 'accueil', titre: 'Accueil', fichier: 'interface/index.html', acces: 'public' }] },
  capacites: { interface: true, serveur: false },
};

function projet(modifier = () => {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'pegase-sdk-'));
  mkdirSync(join(dossier, 'interface'));
  const m = structuredClone(manifeste);
  const fichiers = { 'pegase-extension.json': null, LICENSE: 'MIT', 'interface/index.html': '<!doctype html>' };
  modifier(m, fichiers, dossier);
  fichiers['pegase-extension.json'] = JSON.stringify(m);
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    if (contenu !== undefined) writeFileSync(join(dossier, chemin), contenu);
  }
  return dossier;
}

test('projet valide', () => {
  const { manifeste: m, fichiers } = lireProjet(projet());
  assert.equal(m.id, 'essai/hello');
  assert.deepEqual([...fichiers.keys()].sort(), ['LICENSE', 'interface/index.html', 'pegase-extension.json']);
});

test('manifeste non conforme au schéma', () => {
  assert.throws(() => lireProjet(projet((m) => { m.id = 'Essai'; })), /manifeste \/id/);
  assert.throws(() => lireProjet(projet((m) => { m.permissions.push({ id: 'base:sql', justification: 'accès direct à la base' }); })), /manifeste/);
});

test('fichiers refusés par Pégase', () => {
  assert.throws(() => lireProjet(projet((m, f) => { f['interface/porte.php'] = '<?php'; })), /type de fichier refusé/);
  assert.throws(() => lireProjet(projet((m, f) => { f['interface/index.html'] = undefined; })), /fichier cité par le manifeste absent/);
  assert.throws(() => lireProjet(projet((m, f) => { f.LICENSE = undefined; })), /LICENSE absent/);
  assert.throws(() => lireProjet(projet((m) => { m.points_entree.menu = [{ page: 'absente', libelle: 'X' }]; })), /page non déclarée/);
});
