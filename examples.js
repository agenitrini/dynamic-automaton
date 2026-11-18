/* Copyright (C) 2026 Amaury Curiel & Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
/* Banque d'exemples du cours : automates au format du TME, opération à lancer et explication. */
(function (root) {
  'use strict';
  const groups = {
    complement: ['Complémentaire', 'Complement'],
    determinize: ['Déterminisation', 'Determinization'],
    intersection: ['Intersection', 'Intersection'],
  };

  const abaChain = '#E: 1 2 3 4\n#I: 1\n#F: 4\n#T: (1 a 2)\n(2 b 3)\n(3 a 4)';
  const endsWithAba = '#E: 1 2 3 4\n#I: 1\n#F: 4\n#T: (1 a 1)\n(1 b 1)\n(1 a 2)\n(2 b 3)\n(3 a 4)';
  const containsA = '#E: 1 2\n#I: 1\n#F: 2\n#T: (1 a 1)\n(1 b 1)\n(1 a 2)\n(2 a 2)\n(2 b 2)';

  const examples = [
    {
      id: 'complIncomplete', group: 'complement', op: 'complement', a: abaChain, alphabet: 'ab',
      title: ['L(A) = {aba} : automate non complet', 'L(A) = {aba}: incomplete automaton'],
      note: [
        'Échanger simplement états finaux et non finaux donnerait un automate qui n’accepte pas aa, alors que aa appartient à A* ∖ {aba} : il faut d’abord compléter l’automate (état puits).',
        'Merely swapping final and non-final states would give an automaton that rejects aa, although aa belongs to A* ∖ {aba}: the automaton must first be completed (sink state).',
      ],
    },
    {
      id: 'complIncompleteNaive', group: 'complement', op: 'accept', word: 'aa',
      a: '#E: 1 2 3 4\n#I: 1\n#F: 1 2 3\n#T: (1 a 2)\n(2 b 3)\n(3 a 4)',
      title: ['Piège : calcul naïf du complémentaire de {aba}, mot aa', 'Pitfall: naive swap for {aba}, word aa'],
      note: [
        'États finaux et non finaux ont été échangés sans compléter l’automate. Le mot aa, qui devrait être accepté par le complémentaire, se bloque.',
        'Final and non-final states were swapped without completing the automaton. The word aa, which the complement should accept, gets stuck.',
      ],
    },
    {
      id: 'complNondetAba', group: 'complement', op: 'complement', a: endsWithAba, alphabet: 'ab',
      title: ['Mots finissant par aba : automate non déterministe', 'Words ending with aba: nondeterministic automaton'],
      note: [
        'Le complémentaire est l’ensemble des mots qui ne se terminent pas par aba. L’automate n’est pas déterministe : il faut le déterminiser (et le compléter) avant d’échanger les états finaux.',
        'The complement is the set of words that do not end with aba. The automaton is nondeterministic: it must be determinized (and completed) before swapping final states.',
      ],
    },
    {
      id: 'complNondetAbaNaive', group: 'complement', op: 'accept', word: 'aba',
      a: '#E: 1 2 3 4\n#I: 1\n#F: 1 2 3\n#T: (1 a 1)\n(1 b 1)\n(1 a 2)\n(2 b 3)\n(3 a 4)',
      title: ['Piège : calcul naïf du complémentaire, mot aba', 'Pitfall: naive swap, word aba'],
      note: [
        'Calcul naïf du complémentaire (échange des états finaux) sur l’automate non déterministe : le mot aba est accepté (par l’exécution qui reste dans l’état 1) alors qu’il se termine par aba.',
        'Swapping final states on the nondeterministic automaton: the word aba is accepted (by the run that stays in state 1) although it ends with aba.',
      ],
    },
    {
      id: 'complNondetA', group: 'complement', op: 'complement', a: containsA, alphabet: 'ab',
      title: ['L(A) = A*{a}A* : automate non déterministe', 'L(A) = A*{a}A*: nondeterministic automaton'],
      note: [
        'Le complémentaire est {b}*. Calculer le complémentaire en échangeant directement les états finaux ferait accepter le mot a ; la déterminisation préalable est indispensable.',
        'The complement is {b}*. Swapping final states directly would accept the word a; determinizing first is essential.',
      ],
    },
    {
      id: 'complNondetANaive', group: 'complement', op: 'accept', word: 'a',
      a: '#E: 1 2\n#I: 1\n#F: 1\n#T: (1 a 1)\n(1 b 1)\n(1 a 2)\n(2 a 2)\n(2 b 2)',
      title: ['Piège : calcul naïf du complémentaire de A*{a}A*, mot a', 'Pitfall: naive swap for A*{a}A*, word a'],
      note: [
        'Calcul naïf du complémentaire (échange des états finaux) sans déterminiser : le mot a est accepté alors qu’il n’appartient pas à {b}*.',
        'Swapping final states without determinizing: the word a is accepted although it does not belong to {b}*.',
      ],
    },
    {
      id: 'detA10', group: 'determinize', op: 'determinize',
      a: '#E: 0 1 2 3\n#I: 0\n#F: 3\n#T: (0 a 1)\n(0 a 2)\n(0 b 0)\n(0 b 3)\n(1 b 1)\n(2 a 0)\n(2 a 3)\n(2 b 1)\n(2 b 2)\n(3 a 1)\n(3 a 2)\n(3 b 3)',
      title: ['Automate A10', 'Automaton A10'],
      note: [
        'Construction des sous-ensembles : seuls {0}, {1, 2} et {0, 3} sont accessibles, l’automate déterministe obtenu a donc 3 états.',
        'Subset construction: only {0}, {1, 2} and {0, 3} are reachable, so the resulting deterministic automaton has 3 states.',
      ],
    },
    {
      id: 'interBinary', group: 'intersection', op: 'intersection',
      a: '#E: 0 1\n#I: 0\n#F: 0\n#T: (0 0 0)\n(0 1 1)\n(1 0 0)\n(1 1 1)',
      b: '#E: 0 1 2\n#I: 0\n#F: 0\n#T: (0 0 0)\n(0 1 1)\n(1 0 2)\n(1 1 0)\n(2 0 1)\n(2 1 2)',
      title: ['Multiples de 2 et multiples de 3 en binaire', 'Multiples of 2 and multiples of 3 in binary'],
      note: [
        'A lit un entier en binaire et accepte les multiples de 2 (état = dernier bit) ; B accepte les multiples de 3 (état i = reste i, soit 3K + i). Le produit accepte les multiples de 6.',
        'A reads an integer in binary and accepts multiples of 2 (state = last bit); B accepts multiples of 3 (state i = remainder i, i.e. 3K + i). The product accepts multiples of 6.',
      ],
    },
    {
      id: 'interAb', group: 'intersection', op: 'intersection',
      a: '#E: 1 2 3\n#I: 1\n#F: 3\n#T: (1 b 1)\n(1 a 2)\n(2 a 2)\n(2 b 3)\n(3 a 3)\n(3 b 3)',
      b: '#E: 1 2 3\n#I: 1\n#F: 3\n#T: (1 b 2)\n(2 b 2)\n(2 a 3)\n(3 a 3)\n(3 b 2)',
      title: ['Contient ab et commence par b, finit par a', 'Contains ab, and starts with b, ends with a'],
      note: [
        'A reconnaît les mots contenant le facteur ab, B les mots commençant par b et finissant par a. Seuls les couples accessibles depuis (1, 1) sont construits : depuis (1, 1), la lettre a ne mène à aucun couple car B n’a pas de transition a depuis 1.',
        'A recognizes the words containing the factor ab, B the words starting with b and ending with a. Only pairs reachable from (1, 1) are built: from (1, 1), the letter a leads to no pair because B has no a-transition from 1.',
      ],
    },
  ];

  const api = { groups, examples };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AutomataExamples = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
