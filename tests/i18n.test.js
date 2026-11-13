/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../i18n.js');
const Pseudo = require('../pseudo.js');
const { operations } = require('../automata.js');

test('les deux langues ont les mêmes libellés', () => {
  assert.deepEqual(Object.keys(i18n.ui.fr).sort(), Object.keys(i18n.ui.en).sort());
  for (const lang of ['fr', 'en']) for (const op of Object.keys(operations)) assert.ok(i18n.operations[lang][op], `${lang} ${op}`);
  for (const group of new Set(Object.values(operations).map(m => m.group))) assert.ok(i18n.ui.fr[`group.${group}`]);
});

test('les messages ont les mêmes paramètres en français et en anglais', () => {
  const params = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [key, [fr, en]] of Object.entries(i18n.messages)) assert.deepEqual(params(fr), params(en), key);
});

test('les messages utilisés par le moteur existent', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'automata.js'), 'utf8');
  for (const [, key] of source.matchAll(/'((?:ret|addState|removeState|addTransition|removeTransition|succ|acc|isdet|iscomp|comp|det|compl|prod|union|concat|plus|star|min|quot|err)\.\w+)'/g))
    assert.ok(i18n.messages[key], key);
});

test('le pseudo-code est bilingue et ne contient pas de code Python', () => {
  for (const [key, listing] of Object.entries(Pseudo.listings)) {
    assert.equal(listing.title.length, 2, key);
    for (const [fr, en] of listing.lines) {
      assert.ok(fr && en, key);
      assert.doesNotMatch(`${fr} ${en}`, /\bdef |self\.|\.add\(|\.append\(|DejaVus|ListeEtatsATraiter|\bfor\b.*\bin\b.*:/, key);
    }
  }
});
