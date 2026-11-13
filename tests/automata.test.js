/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Pseudo = require('../pseudo.js');
const { parse, run, operations, wordAccepted, toText } = require('../automata.js');
const i18n = require('../i18n.js');

const words = [''];
for (let length = 1; length <= 5; length++) for (const w of words.filter(x => x.length === length - 1)) words.push(w + 'a', w + 'b');
function randomAutomaton(seed) {
  let x = seed;
  const random = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; };
  const n = 1 + Math.floor(random() * 4);
  const states = Array.from({ length: n }, (_, i) => ({ id: String(i), label: String(i), initial: random() < .45, final: random() < .4 }));
  const transitions = [];
  for (const s of states) for (const symbol of 'ab') for (const t of states) if (random() < .3) transitions.push({ from: s.id, to: t.id, symbol });
  return { states, transitions };
}
const course = parse('#E: 0 1 2 3\n#I: 0\n#F: 3\n#T: (0 a 0)\n(0 b 0)\n(0 a 1)\n(1 a 2)\n(2 a 3)\n(3 a 3)\n(3 b 3)');
const auto2 = parse('#E: 0 1 2\n#I: 0\n#F: 2\n#T: (0 a 0) (0 b 1) (1 a 2) (1 b 2) (2 a 0) (2 b 1)');
const labels = g => g.states.map(s => s.label).sort();

test('lecture du format du TME', () => {
  const a = parse('#E: 0 01 2\n#I: 0\n#F: 1 2\n#T: (0 a 1)\n(0 a 01)\n(1 b 2)');
  assert.equal(a.states.length, 3); assert.equal(a.transitions.length, 2);
  const key = fn => error => { assert.equal(error.key, fn); return true; };
  assert.throws(() => parse('incorrect'), key('err.format'));
  assert.throws(() => parse('#E: 0\n#I: 1\n#F:\n#T:'), key('err.undeclared'));
  assert.throws(() => parse('#E: 0\n#I: 0\n#F:\n#T: (0 a 2)'), key('err.transitionState'));
  assert.throws(() => parse('#E: 0\n#I: 0\n#F:\n#T: (0 ab 0)'), key('err.transition'));
  assert.throws(() => parse('#E: x\n#I:\n#F:\n#T:'), key('err.ids'));
  assert.equal(parse('#E:\n#I:\n#F:\n#T:').states.length, 0);
  const sorted = g => ({ ...g, transitions: [...g.transitions].sort((x, y) => JSON.stringify(x) < JSON.stringify(y) ? -1 : 1) });
  assert.deepEqual(sorted(parse(toText(course))), sorted(course));
});

test('chaque étape désigne une ligne de pseudo-code et un message traduit', () => {
  const inputs = [course, auto2, parse('#E: 0 1\n#I: 0\n#F: 1\n#T: (0 a 1) (1 b 1)'), parse('#E: 0 1\n#I: 0 1\n#F: 0\n#T: (0 a 1) (1 a 0)'), parse('#E: 0\n#I:\n#F:\n#T:')];
  const options = { alphabet: 'ab', word: 'aba', states: ['0'], symbol: 'a', stateId: '1', initial: true, final: false, from: '0', to: '1' };
  const covered = new Set();
  for (const op of Object.keys(operations)) for (const a of inputs) for (const variant of [{}, { stateId: '7' }, { symbol: 'b' }, { word: '' }]) {
    let result;
    try { result = run(op, { ...options, ...variant, a, b: auto2 }); } catch (error) { assert.ok(error.key && i18n.messages[error.key], `${op}: ${error.message}`); continue; }
    assert.ok(result.frames.length > 0, op);
    for (const f of result.frames) {
      const listing = Pseudo.listings[f.listing];
      assert.ok(listing && listing.lines[f.line], `${op}: ${f.listing}:${f.line}`);
      covered.add(`${f.listing}:${f.line}`);
      for (const lang of ['fr', 'en']) {
        const text = i18n.message(lang, f.msg[0], f.msg[1]);
        assert.ok(text, `${op}: message ${f.msg[0]}`);
        const template = i18n.messages[f.msg[0]][lang === 'en' ? 1 : 0];
        for (const [, name] of template.matchAll(/\{(\w+)\}/g)) assert.ok(f.msg[1] && name in f.msg[1], `${op}: paramètre ${name} manquant dans ${f.msg[0]}`);
      }
      assert.ok(f.stack.length >= 1 && f.stack.every(k => Pseudo.listings[k]));
    }
  }
  /* toutes les lignes de pseudo-code sont surlignées au moins une fois */
  const missing = [];
  for (const [key, listing] of Object.entries(Pseudo.listings)) listing.lines.forEach((_, n) => { if (!covered.has(`${key}:${n}`)) missing.push(`${key}:${n + 1}`); });
  assert.deepEqual(missing, []);
});

test('les constructions reconnaissent le bon langage (automates aléatoires)', () => {
  const concat = (a, b, w) => { for (let i = 0; i <= w.length; i++) if (wordAccepted(a, w.slice(0, i)) && wordAccepted(b, w.slice(i))) return true; return false; };
  const plusOf = (a, w, memo = new Map()) => {
    if (memo.has(w)) return memo.get(w);
    let v = w === '' ? wordAccepted(a, '') : false;
    for (let i = 1; i <= w.length && !v; i++) if (wordAccepted(a, w.slice(0, i)) && (i === w.length || plusOf(a, w.slice(i), memo))) v = true;
    memo.set(w, v); return v;
  };
  for (let seed = 1; seed <= 250; seed++) {
    const a = randomAutomaton(seed), b = randomAutomaton(seed * 7919);
    const both = a.states.some(s => s.initial) && b.states.some(s => s.initial);
    const specs = {
      complete: w => wordAccepted(a, w), determinize: w => wordAccepted(a, w), minimize: w => wordAccepted(a, w),
      complement: w => !wordAccepted(a, w), intersection: w => wordAccepted(a, w) && wordAccepted(b, w),
      concat: w => concat(a, b, w), plus: w => plusOf(a, w), star: w => w === '' || plusOf(a, w)
    };
    if (both) specs.union = w => wordAccepted(a, w) || wordAccepted(b, w);
    for (const [op, spec] of Object.entries(specs)) {
      const { result } = run(op, { a, b, alphabet: 'ab' });
      for (const w of words) assert.equal(wordAccepted(result, w), spec(w), `${op}, graine ${seed}, mot « ${w} »`);
    }
  }
});

test('la minimisation donne un automate déterministe, complet et minimal', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const { result } = run('minimize', { a: randomAutomaton(seed), alphabet: 'ab' });
    for (const s of result.states) for (const c of 'ab') assert.equal(result.transitions.filter(t => t.from === s.id && t.symbol === c).length, 1);
    const signature = s => words.map(w => { let cur = s.id; for (const c of w) cur = result.transitions.find(t => t.from === cur && t.symbol === c).to; return result.states.find(x => x.id === cur).final ? 1 : 0; }).join('');
    const signatures = result.states.map(signature);
    assert.equal(new Set(signatures).size, signatures.length, `graine ${seed}`);
  }
});

test('comportements du corrigé du TME', () => {
  /* déterminisation : étiquettes {…} triées, comme newLabel */
  assert.deepEqual(labels(run('determinize', { a: course }).result), ['{0,1,2,3}', '{0,1,2}', '{0,1,3}', '{0,1}', '{0,3}', '{0}']);
  /* estComplet ne regarde que les états accessibles */
  const unreachable = parse('#E: 0 1\n#I: 0\n#F:\n#T: (0 a 0)');
  assert.equal(run('completeTest', { a: unreachable, alphabet: 'a' }).value, true);
  assert.equal(run('completeTest', { a: auto2, alphabet: 'abc' }).value, false);
  /* completeAutomate renvoie la copie si l'automate est déjà complet (accessible) */
  assert.equal(run('complete', { a: unreachable, alphabet: 'a' }).result.states.length, 2);
  const completed = run('complete', { a: course, alphabet: 'ab' }).result;
  assert.ok(completed.states.some(s => s.label === 'bot' && s.id === '4'));
  /* addState renvoie Faux si l'identifiant existe déjà */
  assert.equal(run('addState', { a: course, stateId: '2' }).value, false);
  assert.equal(run('addState', { a: course, stateId: '9', initial: true }).result.states.length, 5);
  /* concaténation : états de B préfixés par 2 */
  assert.ok(labels(run('concat', { a: course, b: auto2 }).result).includes('2_0'));
  /* union : plusieurs couples initiaux (correction du corrigé) */
  const twoInitials = parse('#E: 0 1\n#I: 0 1\n#F: 1\n#T: (0 a 1)');
  const u = run('union', { a: twoInitials, b: auto2 }).result;
  assert.equal(u.states.filter(s => s.initial).length, 2);
  for (const w of words) assert.equal(wordAccepted(u, w), wordAccepted(twoInitials, w) || wordAccepted(auto2, w), w);
  /* étoile : état isolé j, initial et final */
  assert.ok(run('star', { a: course }).result.states.some(s => s.label === 'j' && s.initial && s.final));
});

test('erreurs de saisie', () => {
  const a = parse('#E: 0 1\n#I: 0\n#F: 1\n#T: (0 a 1)');
  const cases = [
    ['addState', { stateId: 'x' }, 'err.stateId'], ['addTransition', { from: 'x', to: '1', symbol: 'a' }, 'err.endpoints'],
    ['addTransition', { from: '0', to: '1', symbol: '(' }, 'err.symbol'], ['successors', { states: ['9'], symbol: 'a' }, 'err.unknownState'],
    ['complement', { alphabet: 'b' }, 'err.alphabetMissing'], ['intersection', {}, 'err.needB'],
    ['star', { a: parse('#E:\n#I:\n#F:\n#T:') }, 'err.nextIdEmpty']
  ];
  for (const [op, extra, key] of cases) assert.throws(() => run(op, { a, ...extra }), error => error.key === key, op);
});
