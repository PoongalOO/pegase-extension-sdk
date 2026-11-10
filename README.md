# SDK des extensions de Pégase

Bibliothèque TypeScript et outils en ligne de commande pour écrire des extensions de
[Pégase](https://github.com/PoongalOO/pegase), sous licence **MIT** : une extension qui l'utilise peut avoir la licence
de son choix.

- **Client du pont `pegase-pont/1`** : l'interface d'une extension tourne dans une iframe isolée (origine opaque, aucun
  accès au réseau) et parle au Core uniquement par messages ; le SDK enveloppe ces messages dans des fonctions typées.
- **Types** de l'API d'extension v1 (contexte, documents, projets, événements, erreurs).
- **`pegase-extension valider`** : contrôle le manifeste `pegase-extension.json` (schéma officiel, dans `schemas/`) et
  les fichiers, comme Pégase avant installation.
- **`pegase-extension construire`** : produit l'archive `.pegext` reproductible (tar ustar trié, dates à zéro, gzip
  sans date) et son empreinte SHA-256, à publier avec la release.

## Installation

Chaque version est publiée comme archive npm attachée à sa release GitHub (empreinte d'intégrité inscrite dans le
`package-lock.json` du projet qui l'installe) :

```sh
npm install --save-dev https://github.com/PoongalOO/pegase-extension-sdk/releases/download/v0.1.0/pegase-extension-sdk-0.1.0.tgz
```

L'interface d'une extension doit être livrée en fichiers statiques sans dépendance externe : regroupez votre code et
le SDK avec un outil comme esbuild (l'iframe ne peut charger aucun script d'un autre domaine).

## Utilisation

```ts
import { pegase, ErreurPegase } from '@pegase/extension-sdk';

const p = pegase();
const contexte = await p.demarrer();          // signal « pret », contexte envoyé par le Core

if (!contexte.utilisateur.connecte) {
  bouton.addEventListener('click', () => p.connexion());   // formulaire de connexion de Pégase, puis retour
} else {
  const { salutation } = await p.parametres.lire<{ salutation: string }>();
  const profil = await p.utilisateur.profil();               // permission utilisateur:profil
  titre.textContent = `${salutation} ${profil.prenom} ${profil.nom}`;   // textContent, jamais innerHTML
}

const messages = p.stockage.collection<{ texte: string }>('messages');
const actuel = await messages.lireOuNull('message');
try {
  await messages.ecrire('message', { texte: 'Bonjour' }, { version: actuel?.version ?? 0 });
} catch (erreur) {
  if (erreur instanceof ErreurPegase && erreur.code === 'conflit') { /* modifié ailleurs */ }
}

p.ajusterHauteur();                           // hauteur de l'iframe suivie automatiquement
```

Autres fonctions : `permissions.possede()`, `fichiers.deposer(blob)` et `fichiers.lire(id)`, `projets.*`,
`evenements.lister()` et `evenements.acquitter()`, `ressources.lire(url)`, `naviguer(page, parametre)`,
`message(niveau, texte)`, `titre(texte)`, `surDesactivation(rappel)`. Chaque appel est vérifié par le Core : permission
accordée par un administrateur et droits de l'utilisateur.

## Outils

```sh
npx pegase-extension valider .
npx pegase-extension construire . --sortie=dist
```

## Développement

```sh
npm install
npm test        # compilation TypeScript puis tests (node --test)
```

Les schémas de `schemas/` sont des copies de `docs/extensions/schemas/` du dépôt de Pégase.

Publier une version : mettre à jour `version` dans `package.json`, commit, étiquette `vX.Y.Z` poussée ; le workflow
**Publication** teste, construit l'archive npm et crée la release.

## Licence

MIT, voir [LICENSE](LICENSE).
