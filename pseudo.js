/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
/*
 * Pseudo-code affiché pendant l'exécution : volontairement par grandes étapes,
 * pour ne pas donner le code Python à écrire en TME.
 * Chaque ligne : [français, anglais, étiquettes]. Les étiquettes « x.nom »
 * relient une étape du moteur (fonction x, étape nom) à la ligne surlignée.
 */
(function (root) {
  'use strict';

  const listings = {
    addState: {
      title: ['Ajout d’un état', 'Adding a state'], fns: { m: 'addState' },
      lines: [
        ['si l’état q n’appartient pas à l’automate :', 'if state q is not in the automaton:', 'm.test'],
        ['  ajouter q (avec ses attributs initial / final)', '  add q (with its initial / final attributes)', 'm.add'],
        ['  renvoyer Vrai', '  return True', 'm.true'],
        ['sinon renvoyer Faux', 'otherwise return False', 'm.false']
      ]
    },
    removeState: {
      title: ['Suppression d’un état', 'Removing a state'], fns: { m: 'removeState' },
      lines: [
        ['si l’état q appartient à l’automate :', 'if state q is in the automaton:', 'm.test'],
        ['  pour chaque transition :', '  for each transition:', 'm.copy'],
        ['    si elle part de q ou arrive en q : la supprimer', '    if it leaves or enters q: remove it', 'm.cond m.remove'],
        ['  supprimer q', '  remove q', 'm.removeState'],
        ['  renvoyer Vrai', '  return True', 'm.true'],
        ['sinon renvoyer Faux', 'otherwise return False', 'm.false']
      ]
    },
    addTransition: {
      title: ['Ajout d’une transition', 'Adding a transition'], fns: { m: 'addTransition' },
      lines: [
        ['si la transition (p, a, q) est déjà présente : renvoyer Faux', 'if transition (p, a, q) is already present: return False', 'm.test m.false'],
        ['rechercher p et q parmi les états', 'look for p and q among the states', 'm.initDest m.foundSrc m.foundDest'],
        ['ajouter p et q s’ils sont absents', 'add p and q if they are missing', 'm.addSrc m.addDest'],
        ['ajouter la transition', 'add the transition', 'm.add'],
        ['renvoyer Vrai', 'return True', 'm.true']
      ]
    },
    removeTransition: {
      title: ['Suppression d’une transition', 'Removing a transition'], fns: { m: 'removeTransition' },
      lines: [
        ['si la transition (p, a, q) est présente :', 'if transition (p, a, q) is present:', 'm.test'],
        ['  la supprimer (les états ne changent pas)', '  remove it (states are unchanged)', 'm.remove'],
        ['  renvoyer Vrai', '  return True', 'm.true'],
        ['sinon renvoyer Faux', 'otherwise return False', 'm.false']
      ]
    },
    succ: {
      title: ['Successeurs d’un ensemble d’états', 'Successors of a set of states'], fns: { m: 'succ' },
      lines: [
        ['S ← ∅', 'S ← ∅', 'm.init'],
        ['pour chaque état q de l’ensemble de départ', 'for each state q of the starting set', 'm.loopS m.S2'],
        ['  pour chaque transition q –x→ r', '  for each transition q –x→ r', 'm.test'],
        ['    si x = a : ajouter r à S', '    if x = a: add r to S', 'm.add'],
        ['renvoyer S', 'return S', 'm.ret']
      ]
    },
    accept: {
      title: ['Reconnaissance d’un mot', 'Word recognition'], fns: { m: 'accepte', r: 'accepte_etats' },
      lines: [
        ['E ← états initiaux', 'E ← initial states', 'm.call'],
        ['tant que le mot n’est pas entièrement lu', 'while the word has not been fully read', 'r.empty r.rec'],
        ['  a ← lettre suivante ; E ← successeurs de E par a', '  a ← next letter; E ← successors of E on a', 'r.succ'],
        ['accepter si E contient un état final', 'accept if E contains a final state', 'r.fin r.true r.false']
      ]
    },
    isDet: {
      title: ['Test du déterminisme', 'Determinism test'], fns: { m: 'estDeterministe' },
      lines: [
        ['s’il n’y a pas exactement un état initial : renvoyer Faux', 'if there is not exactly one initial state: return False', 'm.ini m.false1'],
        ['pour chaque état q et chaque lettre a', 'for each state q and each letter a', 'm.all m.alpha'],
        ['  si q a plusieurs successeurs par a : renvoyer Faux', '  if q has several successors on a: return False', 'm.test m.false2'],
        ['renvoyer Vrai', 'return True', 'm.true']
      ]
    },
    isComplete: {
      title: ['Test de complétude (états accessibles)', 'Completeness test (reachable states)'], fns: { m: 'estComplet', r: 'estComplet_etats' },
      lines: [
        ['à traiter ← états initiaux', 'to process ← initial states', 'm.call'],
        ['tant qu’il reste des états à traiter', 'while there are states to process', 'r.empty r.rec'],
        ['  pour chaque état q à traiter', '  for each state q to process', 'r.A'],
        ['    si une lettre de l’alphabet ne sort pas de q : renvoyer Faux', '    if some letter of the alphabet does not leave q: return False', 'r.test r.false'],
        ['    ajouter ses successeurs pas encore vus aux prochains états à traiter', '    add its successors not yet seen to the next states to process', 'r.loopA r.union'],
        ['renvoyer Vrai', 'return True', 'r.true']
      ]
    },
    complete: {
      title: ['Complétion par un état puits', 'Completion with a sink state'], fns: { m: 'completeAutomate' },
      lines: [
        ['copier l’automate', 'copy the automaton', 'm.copy'],
        ['s’il est déjà complet : le renvoyer', 'if it is already complete: return it', 'm.test m.retCopy'],
        ['créer l’état puits', 'create the sink state', 'm.bot m.addBot'],
        ['pour chaque lettre a et chaque état q', 'for each letter a and each state q', 'm.loopA'],
        ['  si aucune transition par a ne part de q : ajouter q –a→ puits', '  if no transition on a leaves q: add q –a→ sink', 'm.test0 m.add'],
        ['renvoyer l’automate complété', 'return the completed automaton', 'm.ret']
      ]
    },
    determinize: {
      title: ['Déterminisation (construction des sous-ensembles)', 'Determinization (subset construction)'], fns: { m: 'determinisation', r: 'determinisation_etats' },
      lines: [
        ['P ← ensemble des états initiaux', 'P ← set of initial states', 'm.ini'],
        ['créer l’état initial P (final si P contient un état final)', 'create the initial state P (final if P contains a final state)', 'm.fin1 m.lab m.s m.A m.add'],
        ['pour chaque ensemble P créé et pas encore traité', 'for each created set P not yet processed', 'm.alpha m.etatsS m.call r.test r.s r.N r.rec'],
        ['  pour chaque lettre a', '  for each letter a', 'r.loopA'],
        ['    Q ← successeurs de P par a', '    Q ← successors of P on a', 'r.S'],
        ['    si Q est vide : passer à la lettre suivante', '    if Q is empty: go to the next letter', 'r.nonEmpty'],
        ['    si Q est nouveau : créer l’état Q (final si Q contient un état final)', '    if Q is new: create state Q (final if Q contains a final state)', 'r.lab r.new r.loopE r.s2 r.append r.addState r.etats r.dejaVus'],
        ['    sinon : retrouver l’état Q déjà créé', '    otherwise: find the already created state Q', 'r.old r.r'],
        ['    ajouter la transition P –a→ Q', '    add the transition P –a→ Q', 'r.addT'],
        ['renvoyer l’automate construit', 'return the constructed automaton', 'r.ret m.ret']
      ]
    },
    complement: {
      title: ['Complémentaire', 'Complement'], fns: { m: 'complementaire' },
      lines: [
        ['copier l’automate', 'copy the automaton', 'm.copy'],
        ['s’il n’est pas déterministe : le déterminiser', 'if it is not deterministic: determinize it', 'm.det m.callDet'],
        ['s’il n’est pas complet : le compléter', 'if it is not complete: complete it', 'm.comp m.callComp'],
        ['pour chaque état : échanger final et non final', 'for each state: swap final and non-final', 'm.S m.loop m.flip'],
        ['renvoyer l’automate obtenu', 'return the resulting automaton', 'm.ret']
      ]
    },
    intersection: {
      title: ['Intersection (automate produit)', 'Intersection (product automaton)'], fns: { m: 'intersection', r: 'intersection_etats' },
      lines: [
        ['pour chaque état initial p de A et q de B : créer l’état (p, q)', 'for each initial state p of A and q of B: create state (p, q)', 'm.A m.ini0 m.ini1 m.next m.s m.add m.append'],
        ['pour chaque couple (p, q) créé et pas encore traité', 'for each created pair (p, q) not yet processed', 'm.alpha m.call r.test r.s1 r.T1 r.dejaVus r.rec'],
        ['  pour chaque lettre a, chaque p –a→ p′ dans A et q –a→ q′ dans B', '  for each letter a, each p –a→ p′ in A and q –a→ q′ in B', 'r.T1a'],
        ['    créer (p′, q′) s’il est nouveau (final si p′ et q′ sont finals)', '    create (p′, q′) if it is new (final if p′ and q′ are final)', 'r.new r.s2 r.add r.append r.old'],
        ['    ajouter la transition (p, q) –a→ (p′, q′)', '    add the transition (p, q) –a→ (p′, q′)', 'r.addT1 r.addT2'],
        ['renvoyer l’automate produit', 'return the product automaton', 'r.ret']
      ]
    },
    union: {
      title: ['Union (produit d’automates complets)', 'Union (product of complete automata)'], fns: { m: 'union', r: 'union_etats' },
      lines: [
        ['compléter A et B sur l’ensemble de leurs lettres', 'complete A and B on all their letters', 'm.A m.alpha m.a0 m.a1'],
        ['pour chaque état initial p de A et q de B : créer l’état (p, q)', 'for each initial state p of A and q of B: create state (p, q)', 'm.ini0 m.ini1 m.next m.s m.add m.append'],
        ['pour chaque couple (p, q) créé et pas encore traité', 'for each created pair (p, q) not yet processed', 'm.call r.test r.s1 r.T1 r.dejaVus r.rec'],
        ['  pour chaque lettre a, chaque p –a→ p′ et q –a→ q′', '  for each letter a, each p –a→ p′ and q –a→ q′', 'r.T1a'],
        ['    créer (p′, q′) s’il est nouveau (final si p′ ou q′ est final)', '    create (p′, q′) if it is new (final if p′ or q′ is final)', 'r.new r.s2 r.add r.append r.old'],
        ['    ajouter la transition (p, q) –a→ (p′, q′)', '    add the transition (p, q) –a→ (p′, q′)', 'r.addT1 r.addT2'],
        ['renvoyer l’automate produit', 'return the product automaton', 'r.ret']
      ]
    },
    concat: {
      title: ['Concaténation (sans ε-transition)', 'Concatenation (without ε-transitions)'], fns: { m: 'concatenation' },
      lines: [
        ['copier A et B, renommer les états de B', 'copy A and B, rename the states of B', 'm.copy1 m.copy2 m.prefix'],
        ['noter si A reconnaît le mot vide ε', 'note whether A accepts the empty word ε', 'm.b'],
        ['pour chaque transition p –a→ f de A vers un état final f', 'for each transition p –a→ f of A to a final state f', 'm.fin1 m.init2 m.trans m.jonction m.s'],
        ['  ajouter p –a→ i pour chaque état initial i de B', '  add p –a→ i for each initial state i of B', 'm.add'],
        ['si A ne reconnaît pas ε : les initiaux de B ne sont plus initiaux', 'if A does not accept ε: the initial states of B are no longer initial', 'm.notB m.noInit'],
        ['les états finals de A ne sont plus finals', 'the final states of A are no longer final', 'm.noFin'],
        ['renvoyer l’automate obtenu', 'return the resulting automaton', 'm.ret']
      ]
    },
    plus: {
      title: ['Itération positive L⁺ (sans ε-transition)', 'Positive closure L⁺ (without ε-transitions)'], fns: { m: 'plus' },
      lines: [
        ['copier l’automate', 'copy the automaton', 'm.copy m.fin m.init'],
        ['pour chaque transition p –a→ f vers un état final f', 'for each transition p –a→ f to a final state f', 'm.jonction'],
        ['  ajouter p –a→ i pour chaque état initial i', '  add p –a→ i for each initial state i', 'm.add'],
        ['renvoyer l’automate obtenu', 'return the resulting automaton', 'm.ret']
      ]
    },
    star: {
      title: ['Étoile L*', 'Kleene star L*'], fns: { m: 'etoile' },
      lines: [
        ['construire l’automate de L⁺', 'build the automaton of L⁺', 'm.plus'],
        ['ajouter un nouvel état isolé, initial et final (pour ε)', 'add a new isolated state, initial and final (for ε)', 'm.s m.add'],
        ['renvoyer l’automate obtenu', 'return the resulting automaton', 'm.ret']
      ]
    },
    minimize: {
      title: ['Minimisation (algorithme de Moore)', 'Minimization (Moore’s algorithm)'], fns: { m: 'minimisation' },
      lines: [
        ['déterminiser puis compléter l’automate', 'determinize then complete the automaton', 'm.det m.comp'],
        ['partition initiale : états finals / non finals', 'initial partition: final / non-final states', 'm.init m.nb'],
        ['répéter', 'repeat', 'm.while'],
        ['  signature de q : sa classe et la classe de son successeur par chaque lettre', '  signature of q: its class and the class of its successor on each letter', 'm.sig'],
        ['  nouvelles classes : une par signature distincte', '  new classes: one per distinct signature', 'm.num m.new'],
        ['jusqu’à ce que le nombre de classes ne change plus', 'until the number of classes no longer changes', 'm.stable m.update'],
        ['construire l’automate quotient', 'build the quotient automaton', 'm.ret']
      ]
    },
    quotient: {
      title: ['Automate quotient', 'Quotient automaton'], fns: { m: 'quotient' },
      lines: [
        ['un état par classe (initial ou final si l’un de ses éléments l’est)', 'one state per class (initial or final if one of its members is)', 'm.Q m.create m.B'],
        ['pour chaque transition p –a→ p′ : ajouter [p] –a→ [p′]', 'for each transition p –a→ p′: add [p] –a→ [p′]', 'm.add'],
        ['renvoyer l’automate quotient', 'return the quotient automaton', 'm.ret']
      ]
    },
  };

  /* index : fonction du moteur → étiquette → { listing, line } */
  const index = {}, listingOf = {};
  for (const [key, listing] of Object.entries(listings)) {
    for (const fn of Object.values(listing.fns)) { listingOf[fn] = key; index[fn] = {}; }
    listing.lines.forEach(([, , labels], line) => {
      for (const label of labels.split(/\s+/).filter(Boolean)) {
        const [alias, name] = label.split('.');
        const fn = listing.fns[alias];
        if (!fn || Object.hasOwn(index[fn], name)) throw new Error(`Étiquette invalide ou dupliquée : ${key} ${label}`);
        index[fn][name] = { listing: key, line };
      }
    });
  }
  const locate = (fn, label) => (index[fn] ? index[fn][label] : undefined);

  const api = { listings, listingOf, locate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AutomataPseudo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
