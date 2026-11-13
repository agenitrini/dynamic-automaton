/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { layered, symbolLabel, edgeGeometry } = require('../layout.js');
const { run, parse } = require('../automata.js');

test('placement en couches : initial à gauche, aucun chevauchement', () => {
  const a = parse('#E: 0 1 2 3 4 5\n#I: 0\n#F: 5\n#T: (0 a 1) (0 b 2) (1 a 3) (2 a 3) (3 a 4) (4 b 5) (5 a 0) (1 b 5)');
  const { result } = run('determinize', { a });
  const { pos, radius, layer } = layered(result.states, result.transitions);
  assert.equal(pos.size, result.states.length);
  const initial = result.states.find(s => s.initial).id;
  assert.equal(layer.get(initial), 0);
  for (const s of result.states) assert.ok(pos.get(s.id).x >= pos.get(initial).x);
  const ids = [...pos.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const p = pos.get(ids[i]), q = pos.get(ids[j]);
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > radius.get(ids[i]) + radius.get(ids[j]) + 20, `${ids[i]} / ${ids[j]}`);
  }
});

test('états non accessibles et automate vide', () => {
  assert.equal(layered([], []).pos.size, 0);
  const { pos } = layered([{ id: '0', label: '0', initial: false }, { id: '1', label: '1', initial: false }], [{ from: '0', to: '1' }]);
  assert.ok(pos.get('0').x < pos.get('1').x);
});

test('étiquettes compactes des arcs', () => {
  const sigma = [...' ,.0123456789abcdefg'];
  assert.equal(symbolLabel(['a', 'b'], sigma), 'a, b');
  assert.equal(symbolLabel([...'0123456789'], sigma), '0–9');
  assert.equal(symbolLabel(sigma.filter(c => !/[0-9]/.test(c)), sigma), 'Σ∖{0–9}');
  assert.equal(symbolLabel(sigma, sigma), 'Σ');
  assert.equal(symbolLabel([' ', ',', '.', 'a'], sigma), '␣, ‘,’, ., a');
});

test('géométrie : boucle au-dessus, arc entre deux états', () => {
  const p = { x: 0, y: 0 };
  assert.ok(edgeGeometry(p, 30, p, 30, 0).ly < -30);
  const g = edgeGeometry({ x: 0, y: 0 }, 30, { x: 200, y: 0 }, 30, 0);
  assert.match(g.d, /^M 30 0 Q 100 0 168\.5 0$/);
});
