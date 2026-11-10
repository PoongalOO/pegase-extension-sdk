import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pegase, Pont, ErreurPegase, PONT } from '../dist/index.js';

/** Canal simulé : messages envoyés par l'extension, et livraison de messages « du Core » */
function canal() {
  const envoyes = [];
  let recevoir = () => {};
  return {
    envoyes,
    livrer: (message) => recevoir(message),
    envoyer: (message) => envoyes.push(message),
    ecouter: (rappel) => { recevoir = rappel; },
  };
}

const contexte = { pont: PONT, extension: { id: 'essai/hello', version: '1.0.0' }, utilisateur: { connecte: false }, permissions: [], page: 'accueil', langue: 'fr' };

test('le contexte démarre l\'interface une seule fois', async () => {
  const c = canal();
  const pont = new Pont(c);
  const promesse = pont.demarrer();
  assert.deepEqual(c.envoyes[0], { pont: PONT, type: 'signal', signal: 'pret' });
  c.livrer({ pont: PONT, type: 'notification', nom: 'contexte', donnees: contexte });
  c.livrer({ pont: PONT, type: 'notification', nom: 'contexte', donnees: { ...contexte, page: 'autre' } });
  assert.equal((await promesse).page, 'accueil');
  assert.equal((await pont.demarrer()).page, 'accueil');
});

test('requête : réponse, erreur typée, messages étrangers ignorés', async () => {
  const c = canal();
  const pegase = new Pegase(c);
  const lecture = pegase.stockage.collection('messages').lire('m');
  const requete = c.envoyes.at(-1);
  assert.deepEqual([requete.type, requete.methode, requete.parametres], ['requete', 'stockage.lire', { collection: 'messages', cle: 'm' }]);
  c.livrer({ pont: 'autre', type: 'reponse', id: requete.id, ok: true, resultat: 'piège' });
  c.livrer({ pont: PONT, type: 'reponse', id: requete.id, ok: true, resultat: { cle: 'm', valeur: 1, version: 1, modifie: '' } });
  assert.equal((await lecture).valeur, 1);

  const absent = pegase.stockage.collection('messages').lireOuNull('x');
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: false, erreur: { code: 'introuvable', message: 'Document introuvable.' } });
  assert.equal(await absent, null);

  const refus = pegase.utilisateur.profil();
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: false, erreur: { code: 'permission_refusee', message: 'Permission non accordée' } });
  await assert.rejects(refus, (e) => e instanceof ErreurPegase && e.code === 'permission_refusee');
});

test('sans réponse du Core : erreur après le délai', async () => {
  const delai = Pont.DELAI;
  Pont.DELAI = 20;
  try {
    await assert.rejects(new Pegase(canal()).parametres.lire(), (e) => e instanceof ErreurPegase && e.code === 'erreur_interne');
  } finally {
    Pont.DELAI = delai;
  }
});

test('fichier transmis avec la requête, signaux', () => {
  const c = canal();
  const pegase = new Pegase(c);
  const image = new Blob(['x'], { type: 'image/png' });
  pegase.fichiers.deposer(image).catch(() => {});
  assert.equal(c.envoyes.at(-1).fichier, image);
  pegase.naviguer('edition', '01ABC');
  assert.deepEqual(c.envoyes.at(-1), { pont: PONT, type: 'signal', signal: 'naviguer', page: 'edition', parametre: '01ABC' });
  pegase.message('succes', 'Enregistré');
  assert.deepEqual(c.envoyes.at(-1), { pont: PONT, type: 'signal', signal: 'message', niveau: 'succes', texte: 'Enregistré' });
});

test('notification de désactivation', () => {
  const c = canal();
  const pegase = new Pegase(c);
  let desactivee = false;
  pegase.surDesactivation(() => { desactivee = true; });
  c.livrer({ pont: PONT, type: 'notification', nom: 'desactivee', donnees: {} });
  assert.equal(desactivee, true);
});
