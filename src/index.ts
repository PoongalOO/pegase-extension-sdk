import { Canal, canalNavigateur, ErreurPegase, Pont } from './pont.js';
import type {
  Contexte, Document, Evenement, Fichier, PageDocuments, Profil, Projet, Publication, Resultat, ValeurParametre,
} from './types.js';

export * from './types.js';
export { ErreurPegase, Pont, canalNavigateur } from './pont.js';
export type { Canal } from './pont.js';

/** Collection de documents JSON déclarée dans le manifeste (stockage.collections) */
export class Collection<T = unknown> {
  constructor(private pont: Pont, public readonly nom: string) {}

  lire(cle: string): Promise<Document<T>> {
    return this.pont.appeler('stockage.lire', { collection: this.nom, cle });
  }

  /** Document ou null s'il n'existe pas */
  async lireOuNull(cle: string): Promise<Document<T> | null> {
    try {
      return await this.lire(cle);
    } catch (erreur) {
      if (erreur instanceof ErreurPegase && erreur.code === 'introuvable') {
        return null;
      }
      throw erreur;
    }
  }

  lister(options: { apres?: string; limite?: number } = {}): Promise<PageDocuments<T>> {
    return this.pont.appeler('stockage.lister', { collection: this.nom, ...options });
  }

  /**
   * Écriture ; options.version : 0 pour exiger une création, n pour exiger la version n (sinon erreur « conflit »)
   */
  ecrire(cle: string, valeur: T, options: { version?: number } = {}): Promise<Document<T>> {
    return this.pont.appeler('stockage.ecrire', { collection: this.nom, cle, valeur, version: options.version });
  }

  supprimer(cle: string): Promise<null> {
    return this.pont.appeler('stockage.supprimer', { collection: this.nom, cle });
  }
}

/** Interface de programmation des extensions, au-dessus du pont */
export class Pegase {
  readonly pont: Pont;

  constructor(canal?: Canal) {
    this.pont = new Pont(canal ?? canalNavigateur());
  }

  /** Démarre l'interface : contexte de l'appel (utilisateur, permissions, page) */
  demarrer(): Promise<Contexte> {
    return this.pont.demarrer();
  }

  readonly utilisateur = {
    profil: (): Promise<Profil> => this.pont.appeler('utilisateur.profil'),
  };

  readonly permissions = {
    accordees: async (): Promise<string[]> => (await this.pont.appeler<{ accordees: string[] }>('permissions.verifier')).accordees,
    possede: async (permission: string): Promise<boolean> => {
      const reponse = await this.pont.appeler<{ verification?: Record<string, boolean> }>('permissions.verifier', { permissions: [permission] });
      return reponse.verification?.[permission] === true;
    },
  };

  readonly parametres = {
    lire: <T extends Record<string, ValeurParametre> = Record<string, ValeurParametre>>(): Promise<T> => this.pont.appeler('parametres.lire'),
  };

  readonly stockage = {
    collection: <T = unknown>(nom: string): Collection<T> => new Collection<T>(this.pont, nom),
  };

  readonly fichiers = {
    deposer: (fichier: Blob): Promise<Fichier> => this.pont.appeler('fichiers.deposer', {}, fichier),
    lire: (id: string): Promise<Blob> => this.pont.appeler('fichiers.lire', { id }),
    /** Image prête à afficher (adresse data:) : une adresse blob: créée dans l'iframe, d'origine opaque, ne se charge pas */
    adresse: async (id: string): Promise<string> => adresseData(await this.pont.appeler<Blob>('fichiers.lire', { id })),
  };

  readonly projets = {
    lister: async <T = unknown>(): Promise<Projet<T>[]> => (await this.pont.appeler<{ projets: Projet<T>[] }>('projets.lister')).projets,
    lire: <T = unknown>(id: string): Promise<Projet<T>> => this.pont.appeler('projets.lire', { id }),
    creer: <T = unknown>(projet: { titre: string; contenu: T }): Promise<Projet<T>> => this.pont.appeler('projets.creer', projet),
    modifier: <T = unknown>(id: string, projet: { titre: string; contenu: T; version: number }): Promise<Projet<T>> =>
      this.pont.appeler('projets.modifier', { id, ...projet }),
    /** Le Core demande confirmation à l'utilisateur ; refus : erreur « annule_par_utilisateur » */
    supprimer: (id: string): Promise<null> => this.pont.appeler('projets.supprimer', { id }),
    publier: (id: string): Promise<Publication> => this.pont.appeler('projets.publier', { id }),
  };

  readonly parcours = {
    lire: <T = unknown>(): Promise<{ code: string; titre: string; version: number; contenu: T }> => this.pont.appeler('parcours.lire'),
  };

  readonly resultats = {
    lister: async (projet: string): Promise<Resultat[]> => (await this.pont.appeler<{ resultats: Resultat[] }>('resultats.lister', { projet })).resultats,
    /** Résultat de la session de jeu (mode joueur) : créé puis mis à jour ; pseudo facultatif, 40 caractères */
    enregistrer: (resultat: { score: number; termine?: boolean; pseudo?: string; details?: Record<string, unknown> }): Promise<{ enregistre: boolean }> =>
      this.pont.appeler('resultats.enregistrer', resultat),
  };

  readonly evenements = {
    lister: async <D = Record<string, unknown>>(limite = 50): Promise<Evenement<D>[]> =>
      (await this.pont.appeler<{ evenements: Evenement<D>[] }>('evenements.lister', { limite })).evenements,
    acquitter: (ids: string[]): Promise<null> => this.pont.appeler('evenements.acquitter', { ids }),
    publier: (type: string, donnees: Record<string, unknown> = {}): Promise<{ id: string }> => this.pont.appeler('evenements.publier', { type, donnees }),
  };

  readonly ressources = {
    lire: (url: string): Promise<Blob> => this.pont.appeler('ressources.lire', { url }),
  };

  /** Redirige la page vers la connexion de Pégase, puis revient à cette page */
  connexion(): void {
    this.pont.signal('connexion');
  }

  /** Ouvre une autre page de l'extension (avec un paramètre d'adresse éventuel) */
  naviguer(page: string, parametre?: string): void {
    this.pont.signal('naviguer', parametre === undefined ? { page } : { page, parametre });
  }

  /** Message affiché par le Core au-dessus de l'extension (texte seul) */
  message(niveau: 'information' | 'succes' | 'alerte', texte: string): void {
    this.pont.signal('message', { niveau, texte });
  }

  titre(texte: string): void {
    this.pont.signal('titre', { texte });
  }

  /** Hauteur de l'iframe ajustée au contenu, puis suivie (ResizeObserver) */
  ajusterHauteur(element: HTMLElement = document.documentElement): void {
    let derniere = 0;
    const envoyer = () => {
      const hauteur = Math.ceil(element.scrollHeight) + 16;
      if (Math.abs(hauteur - derniere) > 4) {
        derniere = hauteur;
        this.pont.signal('hauteur', { hauteur });
      }
    };
    envoyer();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(envoyer).observe(element);
    }
  }

  surDesactivation(rappel: () => void): void {
    this.pont.surNotification('desactivee', rappel);
  }
}

/** Contenu d'un Blob en adresse data: (FileReader) */
export function adresseData(blob: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

let instance: Pegase | null = null;

/** Instance partagée de la page (iframe de l'extension) */
export function pegase(): Pegase {
  instance ??= new Pegase();
  return instance;
}
