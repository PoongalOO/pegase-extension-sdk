import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { archivePegext, empreinte } from '../dist/cli/archive.js';

const fichiers = () => new Map([
  ['pegase-extension.json', Buffer.from('{}')],
  ['interface/index.html', Buffer.from('<!doctype html>')],
  ['LICENSE', Buffer.from('MIT')],
  ['interface/' + 'a'.repeat(60) + '/' + 'b'.repeat(60) + '.js', Buffer.from('x')],
]);

/** Entrées d'un tar ustar : [chemin, type, taille, mtime] */
function lire(tar) {
  const entrees = [];
  for (let position = 0; position + 512 <= tar.length; ) {
    const entete = tar.subarray(position, position + 512);
    if (entete.every((o) => o === 0)) break;
    const champ = (debut, longueur) => entete.subarray(debut, debut + longueur).toString('utf8').replace(/\0.*$/s, '');
    const nom = champ(0, 100);
    const prefixe = champ(345, 155);
    const taille = parseInt(champ(124, 12), 8);
    entrees.push([prefixe ? `${prefixe}/${nom}` : nom, champ(156, 1), taille, parseInt(champ(136, 12), 8), champ(257, 6)]);
    position += 512 + Math.ceil(taille / 512) * 512;
  }
  return entrees;
}

test('archive reproductible : mêmes sources, mêmes octets', () => {
  const a = archivePegext(fichiers());
  const b = archivePegext(new Map([...fichiers()].reverse()));
  assert.equal(empreinte(a), empreinte(b));
  assert.equal(a.readUInt32LE(4), 0, 'date gzip à zéro');
  assert.equal(a[9], 255, 'système gzip neutre');
});

test('tar ustar trié, fichiers ordinaires, dates à zéro, chemins longs', () => {
  const entrees = lire(gunzipSync(archivePegext(fichiers())));
  assert.deepEqual(entrees.map((e) => e[0]), [...fichiers().keys()].sort());
  for (const [, type, , mtime, magique] of entrees) {
    assert.deepEqual([type, mtime, magique], ['0', 0, 'ustar']);
  }
});

test('chemin refusé par Pégase', () => {
  assert.throws(() => archivePegext(new Map([['interface/../x.html', Buffer.from('')]])), /Chemin non accepté/);
});
