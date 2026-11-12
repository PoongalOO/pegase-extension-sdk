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

test('0.2.0 : pseudo du joueur transmis, titre du parcours', async () => {
  const c = canal();
  const pegase = new Pegase(c);
  pegase.resultats.enregistrer({ score: 2, termine: true, pseudo: 'Léa' }).catch(() => {});
  assert.deepEqual(c.envoyes.at(-1).parametres, { score: 2, termine: true, pseudo: 'Léa' });
  const lecture = pegase.parcours.lire();
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: true, resultat: { code: 'ext-a2b3c4d5', titre: 'Les volcans', version: 1, contenu: {} } });
  assert.equal((await lecture).titre, 'Les volcans');
});

test('0.3.0 : progression de l\'envoi, adresse signée et repli data:, liste, quota, points d\'entrée', async () => {
  const c = canal();
  const pegase = new Pegase(c);
  const progressions = [];
  const depot = pegase.fichiers.deposer(new Blob(['x'], { type: 'video/mp4' }), { progression: (envoye, total) => progressions.push([envoye, total]) });
  const requete = c.envoyes.at(-1);
  c.livrer({ pont: PONT, type: 'notification', nom: 'progression', donnees: { requete: requete.id, envoye: 5, total: 10 } });
  c.livrer({ pont: PONT, type: 'notification', nom: 'progression', donnees: { requete: 'autre', envoye: 1, total: 2 } });
  c.livrer({ pont: PONT, type: 'reponse', id: requete.id, ok: true, resultat: { id: 'V', type: 'video/mp4', nature: 'video', taille: 10 } });
  assert.equal((await depot).nature, 'video');
  assert.deepEqual(progressions, [[5, 10]]);

  const adresse = pegase.fichiers.adresse('V');
  assert.deepEqual([c.envoyes.at(-1).methode, c.envoyes.at(-1).parametres], ['fichiers.adresse', { id: 'V' }]);
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: true, resultat: { adresse: '/extensions/medias/V/1/s', expire: '' } });
  assert.equal(await adresse, '/extensions/medias/V/1/s');

  // Core antérieur à 1.9.0 : méthode inconnue, image relue en adresse data: (FileReader simulé sous Node)
  globalThis.FileReader ??= class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((octets) => { this.result = `data:${blob.type};base64,` + Buffer.from(octets).toString('base64'); this.onload(); });
    }
  };
  const ancienne = pegase.fichiers.adresse('I');
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: false, erreur: { code: 'invalide', message: 'Méthode inconnue.' } });
  await new Promise((fin) => setTimeout(fin, 0));
  assert.equal(c.envoyes.at(-1).methode, 'fichiers.lire');
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: true, resultat: new Blob(['x'], { type: 'image/png' }) });
  assert.match(await ancienne, /^data:image\/png;base64,/);

  const liste = pegase.fichiers.lister();
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: true, resultat: { fichiers: [{ id: 'V' }] } });
  assert.deepEqual(await liste, [{ id: 'V' }]);
  const quota = pegase.quota();
  assert.equal(c.envoyes.at(-1).methode, 'quota.lire');
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: true, resultat: { compte: { utilise: 1, quota: 2 }, partage: { utilise: 0, quota: 1 } } });
  assert.equal((await quota).compte.quota, 2);

  pegase.projets.publier('P', { acces: [{ parametre: '1', libelle: 'Œuvre 1' }] }).catch(() => {});
  assert.deepEqual(c.envoyes.at(-1).parametres, { id: 'P', acces: [{ parametre: '1', libelle: 'Œuvre 1' }] });
  pegase.projets.publier('P').catch(() => {});
  assert.deepEqual(c.envoyes.at(-1).parametres, { id: 'P' });
});

test('0.5.0 : dépublier, désinstaller des appareils', async () => {
  const c = canal();
  const pegase = new Pegase(c);
  const depublie = pegase.projets.depublier('P');
  assert.deepEqual([c.envoyes.at(-1).methode, c.envoyes.at(-1).parametres], ['projets.depublier', { id: 'P' }]);
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: true, resultat: { code: 'ext-a2b3c4d5', version: 2, publie: '', retrait: 'depublie' } });
  assert.equal((await depublie).retrait, 'depublie');
  const desinstalle = pegase.projets.desinstaller('P');
  assert.deepEqual([c.envoyes.at(-1).methode, c.envoyes.at(-1).parametres], ['projets.desinstaller', { id: 'P' }]);
  c.livrer({ pont: PONT, type: 'reponse', id: c.envoyes.at(-1).id, ok: false, erreur: { code: 'annule_par_utilisateur', message: 'Annulé.' } });
  await assert.rejects(desinstalle, (e) => e.code === 'annule_par_utilisateur');
});

test('0.4.0 : point d\'entrée scanné pendant la partie', () => {
  const c = canal();
  const pegase = new Pegase(c);
  const recus = [];
  pegase.parcours.surPointDEntree((parametre) => recus.push(parametre));
  c.livrer({ pont: PONT, type: 'notification', nom: 'parametre', donnees: { parametre: '5' } });
  c.livrer({ pont: PONT, type: 'notification', nom: 'parametre', donnees: { parametre: null } });
  assert.deepEqual(recus, ['5', null]);
});
