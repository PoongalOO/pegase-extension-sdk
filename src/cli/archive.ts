import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

/**
 * Archive .pegext reproductible (docs/extensions/manifest-specification.md, § 3.1 du dépôt de Pégase) : tar au format
 * ustar, fichiers triés par chemin, dates à zéro, propriétaire 0:0, droits 0644, sans entrée de dossier, compressé par
 * gzip sans nom ni date. Les mêmes sources donnent toujours les mêmes octets, donc la même empreinte.
 */
export function archiveTar(fichiers: Map<string, Buffer>): Buffer {
  const blocs: Buffer[] = [];
  for (const chemin of [...fichiers.keys()].sort()) {
    const contenu = fichiers.get(chemin)!;
    blocs.push(entete(chemin, contenu.length), contenu, Buffer.alloc((512 - (contenu.length % 512)) % 512));
  }
  blocs.push(Buffer.alloc(1024));

  return Buffer.concat(blocs);
}

export function archivePegext(fichiers: Map<string, Buffer>): Buffer {
  const gz = gzipSync(archiveTar(fichiers), { level: 9 });
  // en-tête gzip : date à zéro (déjà le cas avec zlib) et système « inconnu » (255) quel que soit l'environnement
  gz[9] = 255;

  return gz;
}

export function empreinte(octets: Buffer): string {
  return createHash('sha256').update(octets).digest('hex');
}

function entete(chemin: string, taille: number): Buffer {
  const octets = Buffer.byteLength(chemin);
  if (octets > 200 || !/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(chemin) || chemin.split('/').some((s) => s === '.' || s === '..')) {
    throw new Error(`Chemin non accepté par Pégase : ${chemin}`);
  }
  let nom = chemin;
  let prefixe = '';
  if (octets > 100) {
    const coupure = chemin.lastIndexOf('/', 155);
    if (coupure <= 0 || chemin.length - coupure - 1 > 100) {
      throw new Error(`Chemin trop long pour le format ustar : ${chemin}`);
    }
    prefixe = chemin.slice(0, coupure);
    nom = chemin.slice(coupure + 1);
  }
  const bloc = Buffer.alloc(512);
  bloc.write(nom, 0, 100, 'utf8');
  bloc.write('0000644\0', 100, 'ascii');
  bloc.write('0000000\0', 108, 'ascii');
  bloc.write('0000000\0', 116, 'ascii');
  bloc.write(taille.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
  bloc.write('00000000000\0', 136, 'ascii');
  bloc.write('        ', 148, 'ascii');
  bloc.write('0', 156, 'ascii');
  bloc.write('ustar\0' + '00', 257, 'ascii');
  bloc.write(prefixe, 345, 155, 'utf8');
  let somme = 0;
  for (const octet of bloc) {
    somme += octet;
  }
  bloc.write(somme.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');

  return bloc;
}
