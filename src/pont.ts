import { CodeErreur, Contexte, MessagePont, Methode, NomSignal, PONT } from './types.js';

/** Erreur rendue par le Core (codes stables de l'API v1) */
export class ErreurPegase extends Error {
  constructor(public readonly code: CodeErreur, message: string, public readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ErreurPegase';
  }
}

/**
 * Canal de messages vers la page hôte du Core. Par défaut : window.parent, en n'acceptant que les messages venus de
 * lui (l'interface tourne dans une iframe isolée, son origine est opaque). Remplaçable dans les tests.
 */
export interface Canal {
  envoyer(message: MessagePont): void;
  ecouter(recevoir: (message: unknown) => void): void;
}

export function canalNavigateur(fenetre: Window = window): Canal {
  return {
    envoyer: (message) => fenetre.parent.postMessage(message, '*'),
    ecouter: (recevoir) => fenetre.addEventListener('message', (evenement: MessageEvent) => {
      if (evenement.source === fenetre.parent) {
        recevoir(evenement.data);
      }
    }),
  };
}

interface Attente {
  resoudre: (valeur: unknown) => void;
  rejeter: (erreur: ErreurPegase) => void;
  minuterie: ReturnType<typeof setTimeout>;
  delai: number;
  progression?: (envoye: number, total: number) => void;
}

/** Options d'une requête : délai sans nouvelle du Core (relancé à chaque progression), suivi d'un envoi */
export interface OptionsRequete {
  delai?: number;
  progression?: (envoye: number, total: number) => void;
}

/**
 * Client du pont pegase-pont/1 : requêtes avec réponse (identifiant, délai), signaux, notifications du Core. Le contexte
 * peut être envoyé plusieurs fois par le Core (chargement, démarrage du script hôte, réponse à « pret ») : seul le
 * premier démarre l'interface.
 */
export class Pont {
  public static DELAI = 30_000;
  private suivant = 0;
  private attentes = new Map<string, Attente>();
  private contexte: Contexte | null = null;
  private auDemarrage: Array<(contexte: Contexte) => void> = [];
  private abonnes = new Map<string, Array<(donnees: Record<string, unknown>) => void>>();

  constructor(private canal: Canal) {
    canal.ecouter((message) => this.recevoir(message));
  }

  /** Signal « pret » puis contexte de l'appel (une seule fois, mémorisé) */
  demarrer(): Promise<Contexte> {
    if (this.contexte) {
      return Promise.resolve(this.contexte);
    }
    const promesse = new Promise<Contexte>((resoudre) => this.auDemarrage.push(resoudre));
    this.signal('pret');

    return promesse;
  }

  contexteCourant(): Contexte | null {
    return this.contexte;
  }

  appeler<T>(methode: Methode, parametres: Record<string, unknown> = {}, fichier?: Blob, options: OptionsRequete = {}): Promise<T> {
    const id = 'r' + (++this.suivant).toString(36);
    const delai = options.delai ?? Pont.DELAI;
    return new Promise<T>((resoudre, rejeter) => {
      const minuterie = this.minuterie(id, delai, rejeter);
      this.attentes.set(id, { resoudre: resoudre as (valeur: unknown) => void, rejeter, minuterie, delai, progression: options.progression });
      const message: MessagePont = { pont: PONT, type: 'requete', id, methode, parametres };
      if (fichier !== undefined) {
        message.fichier = fichier;
      }
      this.canal.envoyer(message);
    });
  }

  private minuterie(id: string, delai: number, rejeter: (erreur: ErreurPegase) => void): ReturnType<typeof setTimeout> {
    const minuterie = setTimeout(() => {
      this.attentes.delete(id);
      rejeter(new ErreurPegase('erreur_interne', 'Pas de réponse du Core.'));
    }, delai);
    // Node (tests) : la minuterie ne retient pas le processus
    (minuterie as { unref?: () => void }).unref?.();

    return minuterie;
  }

  signal(signal: NomSignal, donnees: Record<string, unknown> = {}): void {
    this.canal.envoyer({ pont: PONT, type: 'signal', signal, ...donnees });
  }

  /** Notifications du Core : « parametres » (réglages modifiés), « desactivee » (extension désactivée) */
  surNotification(nom: 'parametres' | 'desactivee', rappel: (donnees: Record<string, unknown>) => void): void {
    this.abonnes.set(nom, [...(this.abonnes.get(nom) ?? []), rappel]);
  }

  private recevoir(message: unknown): void {
    if (!message || typeof message !== 'object' || (message as MessagePont).pont !== PONT) {
      return;
    }
    const m = message as MessagePont;
    if (m.type === 'reponse' && typeof m.id === 'string') {
      const attente = this.attentes.get(m.id);
      if (!attente) {
        return;
      }
      this.attentes.delete(m.id);
      clearTimeout(attente.minuterie);
      if (m.ok === true) {
        attente.resoudre(m.resultat);
      } else {
        const erreur = (m.erreur ?? {}) as { code?: CodeErreur; message?: string; details?: Record<string, unknown> };
        attente.rejeter(new ErreurPegase(erreur.code ?? 'erreur_interne', erreur.message ?? 'Erreur.', erreur.details ?? {}));
      }
      return;
    }
    if (m.type === 'notification' && typeof m.nom === 'string') {
      const donnees = (m.donnees ?? {}) as Record<string, unknown>;
      if (m.nom === 'progression') {
        // envoi d'un fichier en cours : rappel de la requête, délai relancé
        const attente = typeof donnees.requete === 'string' ? this.attentes.get(donnees.requete) : undefined;
        if (attente && typeof donnees.envoye === 'number' && typeof donnees.total === 'number') {
          clearTimeout(attente.minuterie);
          attente.minuterie = this.minuterie(donnees.requete as string, attente.delai, attente.rejeter);
          attente.progression?.(donnees.envoye, donnees.total);
        }
        return;
      }
      if (m.nom === 'contexte') {
        if (this.contexte === null) {
          this.contexte = donnees as unknown as Contexte;
          for (const rappel of this.auDemarrage.splice(0)) {
            rappel(this.contexte);
          }
        }
        return;
      }
      for (const rappel of this.abonnes.get(m.nom) ?? []) {
        rappel(donnees);
      }
    }
  }
}
