/* Copyright (C) 2026 Amaury Curiel & Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, run, operations, wordAccepted } = require('../automata.js');
const { groups, examples } = require('../examples.js');

const byId = id => examples.find(e => e.id === id);
const exec = ex => run(ex.op, { a: parse(ex.a), b: ex.b ? parse(ex.b) : null, alphabet: ex.alphabet || '', word: ex.word || '' });
const binaryWords = [];
for (let n = 0; n < 64; n++) binaryWords.push(n.toString(2));

test('les exemples sont bien formés et s’exécutent', () => {
  const ids = new Set();
  for (const ex of examples) {
    assert.ok(!ids.has(ex.id), ex.id); ids.add(ex.id);
    assert.ok(groups[ex.group], ex.id);
    assert.ok(operations[ex.op], ex.id);
    assert.equal(ex.title.length, 2); assert.equal(ex.note.length, 2);
    assert.equal(Boolean(ex.b), operations[ex.op].fields.includes('B'), ex.id);
    assert.ok(exec(ex).frames.length > 0, ex.id);
  }
});

test('les pièges du complémentaire donnent le résultat annoncé', () => {
  assert.equal(wordAccepted(parse(byId('complIncompleteNaive').a), 'aa'), false);
  assert.equal(wordAccepted(parse(byId('complNondetAbaNaive').a), 'aba'), true);
  assert.equal(wordAccepted(parse(byId('complNondetANaive').a), 'a'), true);
});

test('le complémentaire calculé est correct', () => {
  const c1 = exec(byId('complIncomplete')).result;
  assert.equal(wordAccepted(c1, 'aa'), true); assert.equal(wordAccepted(c1, 'aba'), false);
  const c2 = exec(byId('complNondetAba')).result;
  assert.equal(wordAccepted(c2, 'aba'), false); assert.equal(wordAccepted(c2, 'abab'), true); assert.equal(wordAccepted(c2, 'bbaba'), false);
  const c3 = exec(byId('complNondetA')).result;
  assert.equal(wordAccepted(c3, 'a'), false); assert.equal(wordAccepted(c3, 'bbb'), true); assert.equal(wordAccepted(c3, ''), true);
});

test('la déterminisation de A10 a 3 états', () => {
  assert.equal(exec(byId('detA10')).result.states.length, 3);
});

test('l’intersection binaire reconnaît les multiples de 6', () => {
  const product = exec(byId('interBinary')).result;
  for (const w of binaryWords) assert.equal(wordAccepted(product, w), parseInt(w, 2) % 6 === 0, w);
});
