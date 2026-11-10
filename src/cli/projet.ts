import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/** Contrôles faits aussi par Pégase avant installation (ValidateurArtefact), pour les voir avant de publier */
const RACINE = ['pegase-extension.json', 'LICENSE', 'README.md'];
const DOSSIERS = ['interface', 'joueur', 'serveur'];
const EXTENSIONS_INTERFACE = ['html', 'js', 'mjs', 'css', 'json', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'woff2', 'txt', 'map'];
const TAILLE_ARCHIVE = 20 * 1024 * 1024;
const TAILLE_TOTALE = 60 * 1024 * 1024;
const NOMBRE_FICHIERS = 2000;

// ajv : modules CommonJS chargés depuis ce module ES
const charger = createRequire(import.meta.url);
interface Validation {
  (donnees: unknown): boolean;
  errors?: { instancePath: string; message?: string }[] | null;
}
const Ajv2020 = (charger('ajv/dist/2020') as { default: new (options: object) => { compile(schema: object): Validation } }).default;
const ajvFormats = (charger('ajv-formats') as { default: (ajv: object) => void }).default;

export interface Manifeste {
  id: string;
  nom: string;
  version: string;
  capacites: { interface: boolean; serveur: boolean };
  points_entree: { pages?: { id: string; fichier: string }[]; joueur?: { fichier: string }; menu?: { page: string }[]; cartes?: { page: string }[] };
  serveur?: { module: string };
  distribution?: { icone?: string };
  permissions: { id: string }[];
  evenements?: { abonnements?: string[]; publies?: string[] };
  [cle: string]: unknown;
}

export interface Projet {
  manifeste: Manifeste;
  fichiers: Map<string, Buffer>;
}

export function cheminSchema(): string {
  return fileURLToPath(new URL('../../schemas/pegase-extension.schema.json', import.meta.url));
}

/**
 * Lit et valide le dossier d'une extension : manifeste conforme au schéma et cohérent, fichiers autorisés
 *
 * @throws Error avec la liste des problèmes
 */
export function lireProjet(dossier: string): Projet {
  const problemes: string[] = [];
  const brut = readFileSync(join(dossier, 'pegase-extension.json'), 'utf8');
  let manifeste: Manifeste;
  try {
    manifeste = JSON.parse(brut) as Manifeste;
  } catch (erreur) {
    throw new Error(`pegase-extension.json n'est pas un JSON valide : ${(erreur as Error).message}`);
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajvFormats(ajv);
  const valider = ajv.compile(JSON.parse(readFileSync(cheminSchema(), 'utf8')));
  if (!valider(manifeste)) {
    for (const erreur of valider.errors ?? []) {
      problemes.push(`manifeste ${erreur.instancePath || '/'} : ${erreur.message}`);
    }
    throw new Error(problemes.join('\n'));
  }

  const fichiers = new Map<string, Buffer>();
  const parcourir = (chemin: string) => {
    for (const nom of readdirSync(chemin)) {
      const complet = join(chemin, nom);
      const relatif = relative(dossier, complet).split(sep).join('/');
      const infos = statSync(complet);
      if (infos.isDirectory()) {
        parcourir(complet);
      } else if (infos.isFile()) {
        fichiers.set(relatif, readFileSync(complet));
      }
    }
  };
  for (const nom of RACINE) {
    try {
      fichiers.set(nom, readFileSync(join(dossier, nom)));
    } catch {
      if (nom !== 'README.md') {
        problemes.push(`fichier ${nom} absent`);
      }
    }
  }
  for (const nom of DOSSIERS) {
    try {
      if (statSync(join(dossier, nom)).isDirectory()) {
        parcourir(join(dossier, nom));
      }
    } catch {
      // dossier facultatif
    }
  }

  let total = 0;
  for (const [chemin, contenu] of fichiers) {
    total += contenu.length;
    const extension = chemin.split('.').pop()?.toLowerCase() ?? '';
    const premier = chemin.split('/')[0] ?? '';
    if (premier === 'serveur' ? extension !== 'wasm' : DOSSIERS.includes(premier) && !EXTENSIONS_INTERFACE.includes(extension)) {
      problemes.push(`type de fichier refusé par Pégase : ${chemin}`);
    }
    if (chemin.length > 200 || !/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(chemin) || chemin.split('/').some((s) => s === '.' || s === '..')) {
      problemes.push(`chemin refusé par Pégase : ${chemin}`);
    }
  }
  const cles = [...fichiers.keys()].map((c) => c.toLowerCase());
  if (new Set(cles).size !== cles.length) {
    problemes.push('deux fichiers ne diffèrent que par la casse');
  }
  if (fichiers.size > NOMBRE_FICHIERS) {
    problemes.push(`plus de ${NOMBRE_FICHIERS} fichiers`);
  }
  if (total > TAILLE_TOTALE) {
    problemes.push('plus de 60 Mio de fichiers');
  }
  const cites = [
    ...(manifeste.points_entree.pages ?? []).map((p) => p.fichier),
    ...(manifeste.points_entree.joueur ? [manifeste.points_entree.joueur.fichier] : []),
    ...(manifeste.serveur ? [manifeste.serveur.module] : []),
    ...(manifeste.distribution?.icone ? [manifeste.distribution.icone] : []),
  ];
  for (const cite of cites) {
    if (!fichiers.has(cite)) {
      problemes.push(`fichier cité par le manifeste absent : ${cite}`);
    }
  }
  const pages = (manifeste.points_entree.pages ?? []).map((p) => p.id);
  for (const entree of [...(manifeste.points_entree.menu ?? []), ...(manifeste.points_entree.cartes ?? [])]) {
    if (!pages.includes(entree.page)) {
      problemes.push(`point d'entrée vers une page non déclarée : ${entree.page}`);
    }
  }
  const permissions = manifeste.permissions.map((p) => p.id);
  for (const evenement of manifeste.evenements?.abonnements ?? []) {
    if (!permissions.includes(`evenements:${evenement}`)) {
      problemes.push(`abonnement à ${evenement} sans la permission evenements:${evenement}`);
    }
  }
  if (!manifeste.capacites.serveur && [...fichiers.keys()].some((c) => c.startsWith('serveur/'))) {
    problemes.push('dossier serveur/ présent alors que capacites.serveur vaut false');
  }
  if (problemes.length > 0) {
    throw new Error(problemes.join('\n'));
  }

  return { manifeste, fichiers };
}

export function verifierTailleArchive(octets: Buffer): void {
  if (octets.length > TAILLE_ARCHIVE) {
    throw new Error('archive de plus de 20 Mio : Pégase la refusera');
  }
}
