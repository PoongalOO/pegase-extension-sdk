/**
 * Types de l'API d'extension v1 de Pégase (docs/extensions/extension-api.md et openapi/extension-api-v1.yaml du dépôt
 * de Pégase).
 */

export const PONT = 'pegase-pont/1';

export type CodeErreur =
  | 'non_connecte' | 'jeton_expire' | 'permission_refusee' | 'droit_utilisateur_refuse' | 'extension_inactive'
  | 'introuvable' | 'conflit' | 'quota_depasse' | 'trop_volumineux' | 'invalide' | 'debit_depasse'
  | 'annule_par_utilisateur' | 'runtime_indisponible' | 'erreur_interne';

export type Niveau = 'connecte' | 'valide' | 'administration';

export interface Contexte {
  pont: typeof PONT;
  extension: { id: string; version: string };
  /** id : identifiant pseudonyme propre à l'extension, jamais l'identifiant du compte */
  utilisateur: { connecte: false } | { connecte: true; id: string; niveau: Niveau | null };
  joueur?: { session: string; pseudo: string | null; parcours: string };
  permissions: string[];
  page: string;
  parametre?: string | null;
  langue: 'fr';
}

export interface Profil {
  prenom: string;
  nom: string;
  institution?: string | null;
}

export interface Document<T = unknown> {
  cle: string;
  valeur: T;
  version: number;
  modifie: string;
}

export interface PageDocuments<T = unknown> {
  documents: Document<T>[];
  suivant: string | null;
}

export interface Fichier {
  id: string;
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  taille: number;
  largeur: number;
  hauteur: number;
}

export interface Publication {
  code: string;
  version: number;
  publie: string;
  adresse?: string;
}

export interface Projet<T = unknown> {
  id: string;
  titre: string;
  contenu: T;
  version: number;
  cree: string;
  modifie: string;
  publication: Publication | null;
}

export interface Resultat {
  pseudo: string | null;
  score: number;
  termine?: boolean;
  details?: Record<string, unknown>;
  date: string;
}

export interface Evenement<D = Record<string, unknown>> {
  id: string;
  type: string;
  version: number;
  date: string;
  donnees: D;
}

export type ValeurParametre = string | number | boolean | null;

export type Methode =
  | 'contexte.lire' | 'utilisateur.profil' | 'permissions.verifier' | 'parametres.lire'
  | 'stockage.lire' | 'stockage.lister' | 'stockage.ecrire' | 'stockage.supprimer'
  | 'fichiers.deposer' | 'fichiers.lire'
  | 'projets.lister' | 'projets.lire' | 'projets.creer' | 'projets.modifier' | 'projets.supprimer' | 'projets.publier'
  | 'parcours.lire' | 'resultats.lister' | 'resultats.enregistrer'
  | 'evenements.lister' | 'evenements.acquitter' | 'evenements.publier'
  | 'ressources.lire';

export type NomSignal = 'pret' | 'hauteur' | 'naviguer' | 'connexion' | 'message' | 'titre';

export interface MessagePont {
  pont: typeof PONT;
  type: 'requete' | 'reponse' | 'signal' | 'notification';
  [cle: string]: unknown;
}
