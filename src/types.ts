/**
 * Types de l'API d'extension v1 de Pégase (docs/extensions/extension-api.md et openapi/extension-api-v1.yaml du dépôt
 * de Pégase).
 */

export const PONT = 'pegase-pont/1';

export type CodeErreur =
  | 'non_connecte' | 'jeton_expire' | 'permission_refusee' | 'droit_utilisateur_refuse' | 'extension_inactive'
  | 'introuvable' | 'conflit' | 'quota_depasse' | 'trop_volumineux' | 'invalide' | 'debit_depasse'
  | 'annule_par_utilisateur' | 'runtime_indisponible' | 'erreur_interne' | 'erreur_reseau';

export type Niveau = 'connecte' | 'valide' | 'administration';

export interface Contexte {
  pont: typeof PONT;
  extension: { id: string; version: string };
  /** id : identifiant pseudonyme propre à l'extension, jamais l'identifiant du compte */
  utilisateur: { connecte: false } | { connecte: true; id: string; niveau: Niveau | null };
  joueur?: { session: string; pseudo: string | null; parcours: string };
  permissions: string[];
  page: string;
  /** paramètre d'adresse de la page, ou point d'entrée du parcours ouvert par le joueur (/extensions/joueur/{code}/{parametre}) */
  parametre?: string | null;
  langue: 'fr';
  /** joueur ouvert par le lecteur (web ou PégaseLab) à partir du paquet gardé sur l'appareil, avec ou sans réseau */
  horsLigne?: boolean;
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

/** Image (fichiers:deposer, réencodée en PNG ou JPEG), son ou vidéo (fichiers:medias, 15 Mo au plus) */
export interface Fichier {
  id: string;
  type: 'image/png' | 'image/jpeg' | 'audio/mpeg' | 'audio/mp4' | 'audio/webm' | 'video/mp4' | 'video/webm';
  /** depuis Pégase 1.9.0 */
  nature?: 'image' | 'audio' | 'video';
  taille: number;
  /** images seulement */
  largeur?: number;
  hauteur?: number;
  /** sons et vidéos : nom du fichier déposé, nettoyé */
  nom?: string | null;
  /** sons et vidéos : lecture possible avant la fin du téléchargement (MP4 « faststart ») */
  progressif?: boolean;
  cree?: string;
}

/** Adresse signée et temporaire d'une image, d'un son ou d'une vidéo, pour <img>, <audio> ou <video> */
export interface AdresseFichier {
  adresse: string;
  /** date ISO 8601 ; au moins 4 heures après la demande */
  expire: string;
}

/** Place utilisée et quota, en octets, du compte connecté et des données partagées */
export interface Quota {
  compte: { utilise: number; quota: number } | null;
  partage: { utilise: number; quota: number };
}

/** Point d'entrée d'un parcours publié : ouvert par l'adresse du joueur suivie de son paramètre, imprimé en QR code */
export interface Acces {
  parametre: string;
  libelle: string;
}

export interface Publication {
  code: string;
  version: number;
  publie: string;
  adresse?: string;
  /** page des QR codes du parcours (depuis Pégase 1.9.0) */
  codes_qr?: string;
  /**
   * Parcours retiré par son auteur jusqu'à sa prochaine publication (depuis Pégase 1.16.0) : « depublie », plus
   * téléchargeable ni jouable en ligne ; « desinstalle », en plus effacé des appareils qui l'ont gardé
   */
  retrait?: Retrait;
  /** date du retrait */
  retire?: string;
}

export type Retrait = 'depublie' | 'desinstalle';

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
  | 'fichiers.deposer' | 'fichiers.lire' | 'fichiers.adresse' | 'fichiers.lister' | 'fichiers.supprimer' | 'quota.lire'
  | 'projets.lister' | 'projets.lire' | 'projets.creer' | 'projets.modifier' | 'projets.supprimer' | 'projets.publier'
  | 'projets.depublier' | 'projets.desinstaller'
  | 'parcours.lire' | 'resultats.lister' | 'resultats.enregistrer'
  | 'evenements.lister' | 'evenements.acquitter' | 'evenements.publier'
  | 'ressources.lire';

export type NomSignal = 'pret' | 'hauteur' | 'naviguer' | 'connexion' | 'message' | 'titre';

export interface MessagePont {
  pont: typeof PONT;
  type: 'requete' | 'reponse' | 'signal' | 'notification';
  [cle: string]: unknown;
}
