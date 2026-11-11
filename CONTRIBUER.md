# Proposer une extension à Pégase

Ce guide s'adresse aux développeuses et développeurs qui veulent faire installer leur extension sur
[PégaseLab](https://pegaselab.org) ou sur un autre portail Pégase. Pour l'écrire : le README de ce SDK, et les
exemples [Pégase Hello Extension](https://github.com/PoongalOO/pegase-extension-hello) (démonstration courte) et
[Musée](https://github.com/PoongalOO/pegase-extension-musee) (espace de création complet).

Une extension n'est jamais installée automatiquement : un super administrateur du portail la relit, l'essaie, accorde
ses permissions une à une et décide de l'ouvrir, à tous ou à certains comptes. Les utilisateurs de Pégase sont souvent
des enseignants et des élèves, parfois mineurs : la relecture est exigeante sur la sécurité et les données personnelles.

## 1. Avant de proposer

**Fonctionnement**

- [ ] L'archive `.pegext` est construite par `npx pegase-extension construire` (reproductible) et validée par
      `npx pegase-extension valider`.
- [ ] Elle a été essayée dans un Pégase de test (essais navigateur du dépôt de Pégase, ou portail local).
- [ ] `compatibilite.pegase` indique les versions réellement essayées.
- [ ] Les erreurs du Core (`permission_refusee`, `quota_depasse`, `non_connecte`, `conflit`…) sont expliquées à
      l'utilisateur ; l'extension fonctionne sans ses permissions facultatives.

**Sécurité**

- [ ] Toutes les ressources sont dans l'archive (aucun script, style, police ou image chargé d'ailleurs).
- [ ] Aucun `innerHTML`, `eval` ni code obscurci ; le code source qui produit l'archive est public.
- [ ] Aucune demande de mot de passe ni de donnée d'authentification.
- [ ] Chaque permission demandée est **nécessaire** et sa justification dit exactement à quoi elle sert.

**Données personnelles et droits**

- [ ] Vous savez quelles données l'extension enregistre (documents, fichiers, résultats des joueurs) et pourquoi ; le
      minimum, sans donnée sur les joueurs mineurs au-delà d'un pseudo facultatif.
- [ ] Les textes, images, sons et vidéos fournis avec l'extension sont libres de droits ou sous licence compatible ;
      si l'extension permet de publier des contenus, elle rappelle aux auteurs qu'ils doivent en détenir les droits.

**Accessibilité et usage**

- [ ] Libellés, contrastes, navigation au clavier, textes alternatifs (WCAG 2.1 AA visé).
- [ ] Interface en français ; fonctionne sur téléphone pour les pages et le joueur utilisés par le public.
- [ ] Joueur jouable hors ligne : un seul module JavaScript, fichiers cités dans le HTML et le CSS, médias lus par
      `fichiers.adresse(id)`.

**Publication**

- [ ] Dépôt GitHub public, licence claire (fichier `LICENSE`), `distribution.depot` dans le manifeste.
- [ ] Release `vX.Y.Z` contenant l'archive `.pegext` et son `.sha256` (workflow de publication de Hello ou de Musée).
- [ ] README : ce que fait l'extension, permissions et pourquoi, données enregistrées, contact.

## 2. Proposer

Ouvrez une demande dans ce dépôt avec le formulaire **« Proposer une extension »** (onglet *Issues*). Indiquez :
le dépôt et la version, l'empreinte SHA-256 de l'archive, à quoi sert l'extension et pour qui, les permissions et leur
justification, les données enregistrées, les versions de Pégase essayées.

N'y mettez aucune donnée personnelle d'utilisateurs ni aucun secret.

## 3. Ce qui se passe ensuite

1. **Relecture** du code et du manifeste : permissions, sécurité, données, accessibilité.
2. **Essai** dans un portail de test, puis, si tout va bien, installation sur le portail ; les questions et demandes de
   correction se font dans la demande.
3. **Ouverture progressive** possible : l'administrateur peut réserver l'extension à quelques comptes ou à un
   abonnement le temps d'un essai.
4. **Mises à jour** : publiez une nouvelle release ; le portail la signale et elle reste en attente de l'accord d'un
   super administrateur, qui voit toute permission nouvelle. Une version publiée ne change jamais.
5. **Retrait** : une extension peut être désactivée à tout moment (faille, comportement inattendu, plainte) ; ses
   données sont conservées et peuvent être restaurées.

Il n'existe pas encore de catalogue public des extensions : ce dépôt et la relecture par l'administrateur en tiennent
lieu.

## 4. Contribuer au SDK lui-même

Corrections et améliorations du SDK : demande (*issue*) puis proposition de modification (*pull request*) avec des
tests (`npm test`). Le SDK suit l'API d'extension v1 de Pégase : une évolution de l'API se fait d'abord dans Pégase.
