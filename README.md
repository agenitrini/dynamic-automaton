# Automates finis dynamiques

Site pédagogique de visualisation des automates finis et de leurs algorithmes.
Il permet de saisir des automates, d'observer leurs transformations et de
suivre pas à pas le pseudo-code correspondant. Il s'inspire du cours de
mathématiques discrètes et du TME de programmation d'automates finis.

## Sommaire

- [Démarrage](#démarrage)
- [Description d'un automate](#description-dun-automate)
- [Utilisation de l'interface](#utilisation-de-linterface)
- [Opérations disponibles](#opérations-disponibles)
- [Conventions et limites](#conventions-et-limites)
- [Organisation du projet](#organisation-du-projet)
- [Tests](#tests)
- [Auteur et licence](#auteur-et-licence)

## Démarrage

Ouvrir [index.html](./index.html) dans un navigateur moderne avec JavaScript
activé. Le site fonctionne directement depuis le disque, sans installation,
serveur, connexion Internet ni dépendance externe.

Un exemple d'automate non déterministe est chargé dans le champ au démarrage,
ainsi qu'un second automate pour les opérations binaires. La visualisation
principale reste vide jusqu'au choix d'une opération. Toutes les données
restent dans la page : les saisies ne sont pas conservées après son rechargement.
Le bouton **EN / FR** et son drapeau indiquent la langue vers laquelle passer.
Il change la langue de l'interface et de la visualisation en
cours sans perdre l'étape affichée. La préférence est mémorisée si le navigateur
l'autorise. On peut aussi ouvrir la page avec `?lang=fr` ou `?lang=en`.
Le bouton **Aide**, à côté du choix de langue, affiche cette documentation
dans la langue de l'interface et met la lecture en pause ; **Fermer** ou la
touche Échap permet d'en sortir.

## Description d'un automate

Saisir l'automate A dans le champ multiligne. Pour l'intersection, l'union et
la concaténation, saisir également l'automate B. Le format est celui des
fichiers du TME :

```text
#E: 0 1 2
#I: 0
#F: 2
#T: (0 a 0)
(0 b 1)
(1 a 2)
```

| Section | Contenu |
|---|---|
| `#E:` | Identifiants de tous les états |
| `#I:` | Identifiants des états initiaux |
| `#F:` | Identifiants des états finaux |
| `#T:` | Transitions, sous la forme `(source symbole destination)` |

Les quatre sections doivent apparaître dans cet ordre. Les identifiants sont
des entiers positifs ou nuls ; ceux des états initiaux, finaux et des extrémités
des transitions doivent être déclarés dans `#E:`. Une transition porte un seul
caractère non blanc, autre qu'une parenthèse. Les sections peuvent être vides,
et plusieurs états peuvent être initiaux ou finaux. Les doublons sont ignorés.
Les transitions ε ne sont pas prises en charge ; ε désigne uniquement le mot
vide dans l'interface et les explications.

Pour les opérations demandant un alphabet, saisir ses caractères sans
séparateur, par exemple `ab` ; les espaces sont ignorés. Pour le complémentaire
et la minimisation, il doit contenir toutes les étiquettes de transition de A.
Pour la reconnaissance, laisser le champ « Mot » vide pour tester ε.

## Utilisation de l'interface

1. Choisir une opération : sa visualisation démarre automatiquement.
2. Modifier l'automate A et, si l'opération le demande, l'automate B.
   **Visualiser** dessine l'automate saisi dans l'aperçu à droite.
3. Remplir les champs propres à l'opération. La visualisation est recalculée
   lorsque l'on quitte un champ modifié ; une case à cocher agit immédiatement.
4. Utiliser le lecteur ou sélectionner une entrée du journal pour examiner une
   étape ; le message, la ligne de pseudo-code et le graphe sont synchronisés.

Le lecteur propose première et dernière étape, pas précédent et suivant,
lecture/pause, déplacement dans la chronologie et réglage de la vitesse.
Lorsque le focus n'est pas dans un champ ou un bouton, les touches
<kbd>Espace</kbd>, <kbd>←</kbd> et <kbd>→</kbd> commandent la lecture.

### Pseudo-code

Le panneau de droite présente l'algorithme **par grandes étapes**, en français
ou en anglais, et surligne l'étape en cours. Il ne reproduit volontairement pas
le code Python du TME, que les étudiants doivent écrire eux-mêmes. Lorsqu'un
algorithme en utilise un autre (par exemple le complémentaire, qui déterminise
puis complète), la ligne **Algorithmes en cours** indique l'enchaînement et le
pseudo-code affiché est celui de l'algorithme appelé.

### Graphe

- une **flèche rouge** indique un état initial, un **double cercle** un état
  final ;
- l'**orange** désigne l'état ou la transition en cours de traitement ;
- le **bleu** désigne les états qui restent à traiter ;
- un **anneau vert pointillé** entoure un ensemble d'états calculé (successeurs,
  états finals, états déjà vus…) ;
- pendant la minimisation, les couleurs de fond repèrent les classes.

Les états sont placés **de gauche à droite** selon leur distance aux états
initiaux, comme le fait Graphviz dans le notebook. La position de chaque état
est calculée une fois pour toute la construction : un état créé apparaît
directement à sa place définitive et ne bouge plus ensuite. Les créations
d'états et de transitions sont animées : l'état grossit, la transition se
dessine depuis son origine. Les arcs qui sautent des colonnes ou qui reviennent
en arrière sont courbés, et les étiquettes d'un grand alphabet sont abrégées
(`0–9`, `Σ∖{0–9}` pour « tout sauf un chiffre » ; le détail apparaît au
survol).

On peut **faire glisser un état** pour améliorer le dessin ; la nouvelle
position est conservée pendant toute la visualisation. **Réorganiser** rétablit
la disposition calculée. La molette et les boutons `+` / `−` permettent de
zoomer, un glisser sur le fond déplace la vue et **Recentrer** rétablit le
cadrage. **Agrandir** donne davantage de place au graphe. Les aperçus de A et B
suivent les mêmes règles et mettent en évidence, pendant une construction, les
états de l'automate de départ concernés (par exemple l'ensemble d'états
représenté par l'état en cours de la déterminisation).

### Panneaux complémentaires

- **Exécutions** (reconnaissance d'un mot) : les exécutions apparaissent sous
  la forme `0 ─a→ 1 ─b→ 2`, avec les branches bloquées puis, après lecture
  complète, les exécutions acceptantes.
- **Partition courante** (minimisation) : les classes et, pour chaque état, sa
  signature (sa classe et la classe atteinte par chaque lettre). Deux états
  restent dans la même classe exactement quand leurs signatures coïncident.

Après une construction ou une transformation, **Utiliser le résultat comme
automate A** copie l'automate obtenu dans le champ A. Ses états sont
renumérotés pour respecter le format de saisie ; il faut ensuite choisir
l'opération suivante, même si c'est la même. Une erreur de saisie est affichée
et la visualisation précédente reste visible.

## Opérations disponibles

Les algorithmes suivent le comportement du corrigé du TME (mêmes étapes,
mêmes étiquettes d'états, par exemple `{0,1}` pour la déterminisation, `bot`
pour le puits, `2_0` pour les états renommés de B, `j` pour l'état ajouté par
l'étoile).

### Construction et parcours

| Opération | Principe et paramètres |
|---|---|
| Ajouter un état | Identifiant et attributs initial / final ; renvoie Faux si l'identifiant existe déjà |
| Supprimer un état | Suppression de l'état et de ses transitions incidentes |
| Ajouter une transition | Source, symbole et destination ; un état absent est ajouté |
| Supprimer une transition | Source, symbole et destination d'une transition existante |
| Successeurs d'un ensemble | États de départ séparés par des espaces et symbole à suivre |
| Reconnaissance d'un mot | Ensemble des états atteints après chaque lettre, puis acceptation ou refus |
| Tester le déterminisme | Un seul état initial et au plus un successeur par état et symbole |
| Tester la complétude | Une transition pour chaque lettre de l'alphabet, sur les états accessibles |

### Transformations et opérations sur les langages

| Opération | Construction visualisée |
|---|---|
| Compléter | Si l'automate n'est pas complet : état puits `bot`, puis ajout des transitions manquantes, lettre par lettre |
| Déterminiser | Construction des sous-ensembles accessibles |
| Complémentaire | Déterminisation si nécessaire, complétion si nécessaire, échange des états finals et non finals |
| Intersection | Produit des automates A et B (éventuellement non déterministes) ; les deux composantes doivent être finales |
| Union | Complétion des deux automates, puis produit ; une composante finale suffit |
| Concaténation | Copies de A et B, transitions de jonction, sans transitions ε |
| Itération positive | Transitions de jonction vers les états initiaux |
| Étoile | Itération positive et ajout d'un état isolé, initial et final, pour reconnaître ε |
| Minimisation de Moore | Déterminisation, complétion, raffinements successifs de la partition, automate quotient |

La minimisation (cours 5bis) ne figure pas dans le TME ; elle est présentée
dans le même esprit.

## Conventions et limites

- Comme dans le TME, le **test** de complétude ne considère que les états
  accessibles depuis les états initiaux ; la complétion ne fait rien si ce test
  réussit.
- La déterminisation ne crée pas de transition vers l'ensemble vide ; la
  complétion ajoute un puits si nécessaire.
- Deux écarts volontaires avec le corrigé, qui donnait un langage faux dans
  des cas particuliers : l'**union** donne un identifiant distinct à chaque
  couple d'états initiaux, et la **concaténation** conserve les états isolés
  (le corrigé les perdait, ce qui pouvait faire perdre le mot vide).
- Si l'un des deux automates de l'**union** n'a pas d'état initial, le produit
  est vide : la construction par produit ne donne alors pas l'union, ce que la
  visualisation signale.
- Une visualisation est limitée à **150 états**, **1 500 transitions** et
  **6 000 étapes** ; un mot à reconnaître à 60 lettres. Un dépassement est signalé. Certaines constructions peuvent être
  exponentielles.
- Pour la reconnaissance, l'affichage des exécutions est limité à **256
  branches** et **4 000 états d'exécution**. Si cette limite est atteinte,
  l'affichage des chemins s'arrête et le signale ; le résultat reste exact.
- Les données ne sont ni sauvegardées ni transmises par le site.

## Organisation du projet

```text
index.html               Interface et commandes
style.css                Présentation et adaptation aux écrans
automata.js              Lecture de la saisie et algorithmes exécutés pas à pas
pseudo.js                Pseudo-code bilingue affiché pendant l'exécution
layout.js                Placement en couches, tracé des arcs et des étiquettes
app.js                   Rendu SVG animé, lecteur et interactions
i18n.js                  Textes de l'interface et messages des étapes (français et anglais)
README.en.md             Traduction anglaise de cette documentation
help-content.js          Documentation bilingue intégrée pour l'utilisation hors ligne
scripts/update-help.js   Génération de l'aide depuis le README
tests/automata.test.js   Tests des algorithmes avec Node.js
tests/layout.test.js     Tests de la mise en page
tests/i18n.test.js       Tests des traductions et du pseudo-code
tests/help.test.js       Vérification de l'aide et de sa synchronisation
LICENSE                  Texte intégral de la licence
```

Chaque algorithme produit une suite d'étapes contenant l'automate observé, un
message (clé de traduction et paramètres), la ligne de pseudo-code et les
éléments à mettre en évidence. Les étapes d'une même construction partagent
une mise en page commune ; le rendu SVG, sans bibliothèque externe, ne modifie
que ce qui change d'une étape à l'autre, ce qui permet d'animer les créations
et les suppressions.

Après toute modification du README ou de sa traduction anglaise, maintenir les
deux textes cohérents puis exécuter `node scripts/update-help.js` depuis le
dossier du projet pour actualiser la documentation intégrée à l'aide.
Cette génération est nécessaire pour que l'aide fonctionne aussi en ouvrant
directement le site depuis le disque, sans serveur.

## Tests

Avec une version récente de Node.js, depuis le dossier du projet :

```sh
node --test tests/*.test.js
```

Les tests vérifient l'analyse des entrées, la couverture du pseudo-code
(chaque ligne est surlignée par au moins une exécution), les traductions, les
langages obtenus par chaque construction sur des automates aléatoires non
déterministes, la minimalité des automates quotients et plusieurs comportements
du corrigé du TME.

## Auteur et licence

Auteur : **Antoine Genitrini**.

Copyright © 2026 Antoine Genitrini.

Ce logiciel est distribué sous la **GNU General Public License, version 3**
uniquement (SPDX : `GPL-3.0-only`). Il est fourni sans garantie ; voir le texte
complet dans [LICENSE](./LICENSE).
