/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
/*
 * Mise en page des automates : placement en couches de gauche à droite
 * (distance depuis les états initiaux, comme Graphviz avec rankdir=LR),
 * réduction des croisements par barycentres, tracé des arcs et des étiquettes.
 * Les positions sont calculées une fois pour toutes les étapes d'une même
 * scène : un état garde sa place pendant toute la construction.
 */
(function (root) {
  'use strict';

  const GAP_X = 120;

  function radius(label) {
    const n = [...String(label)].length;
    return Math.max(24, Math.min(66, 10 + n * 4.2));
  }

  /*
   * states : [{ id, label, initial }] dans l'ordre d'apparition.
   * transitions : [{ from, to }].
   * Renvoie { pos: Map(id → {x, y}), radius: Map(id → r), layer: Map(id → n) }.
   */
  function layered(states, transitions) {
    const known = new Set(states.map(s => s.id));
    const succ = new Map(), pred = new Map();
    for (const s of states) { succ.set(s.id, new Set()); pred.set(s.id, new Set()); }
    for (const t of transitions) {
      if (t.from === t.to || !known.has(t.from) || !known.has(t.to)) continue;
      succ.get(t.from).add(t.to); pred.get(t.to).add(t.from);
    }
    /* couches : parcours en largeur depuis les états initiaux, puis depuis les états restants */
    const layer = new Map(), discovery = [];
    const bfs = roots => {
      const queue = [];
      for (const id of roots) if (!layer.has(id)) { layer.set(id, 0); queue.push(id); discovery.push(id); }
      for (let k = 0; k < queue.length; k++) {
        const id = queue[k];
        for (const n of succ.get(id)) if (!layer.has(n)) { layer.set(n, layer.get(id) + 1); queue.push(n); discovery.push(n); }
      }
    };
    bfs(states.filter(s => s.initial).map(s => s.id));
    for (const s of states) if (!layer.has(s.id)) {
      /* état non accessible : on le place juste avant son premier successeur déjà placé */
      const next = [...succ.get(s.id)].filter(n => layer.has(n)).map(n => layer.get(n));
      if (next.length) { layer.set(s.id, Math.max(0, Math.min(...next) - 1)); discovery.push(s.id); bfs([]); }
      else bfs([s.id]);
    }
    const depth = Math.max(0, ...layer.values());
    const layers = Array.from({ length: depth + 1 }, () => []);
    for (const id of discovery) layers[layer.get(id)].push(id);

    /* ordre dans chaque couche : barycentres alternés (haut-bas) */
    const position = new Map();
    const index = () => layers.forEach(L => L.forEach((id, k) => position.set(id, k - (L.length - 1) / 2)));
    index();
    const sweep = (range, neighbours) => {
      for (const L of range) {
        const list = layers[L];
        const key = new Map(list.map((id, k) => {
          const ns = [...neighbours(id)].filter(n => layer.get(n) !== L && Math.abs(layer.get(n) - L) <= 1);
          return [id, ns.length ? ns.reduce((sum, n) => sum + position.get(n), 0) / ns.length : position.get(id)];
        }));
        list.sort((x, y) => key.get(x) - key.get(y));
        list.forEach((id, k) => position.set(id, k - (list.length - 1) / 2));
      }
    };
    const both = id => [...succ.get(id), ...pred.get(id)];
    for (let it = 0; it < 6; it++) {
      sweep(Array.from({ length: depth }, (_, k) => k + 1), both);
      sweep(Array.from({ length: depth }, (_, k) => depth - 1 - k), both);
    }

    /* coordonnées */
    const r = new Map(states.map(s => [s.id, radius(s.label)]));
    const maxR = Math.max(22, ...r.values());
    const dy = 3.1 * maxR + 34;
    const pos = new Map();
    let x = 0;
    layers.forEach((L, k) => {
      const here = Math.max(22, ...L.map(id => r.get(id)));
      if (k > 0) x += Math.max(22, ...layers[k - 1].map(id => r.get(id))) + here + GAP_X;
      L.forEach(id => pos.set(id, { x, y: position.get(id) * dy }));
    });
    return { pos, radius: r, layer };
  }

  /* Point d'une courbe quadratique. */
  const quad = (p, c, q, t) => ({
    x: (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * c.x + t * t * q.x,
    y: (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * c.y + t * t * q.y
  });

  /*
   * Arc de a (rayon ra) vers b (rayon rb). bend > 0 courbe l'arc vers la gauche
   * du sens de parcours (vers le haut pour un arc allant vers la droite).
   */
  function edgeGeometry(a, ra, b, rb, bend) {
    if (a === b || (a.x === b.x && a.y === b.y && ra === rb && bend === 'loop')) {
      const x = a.x, y = a.y, r = ra;
      return {
        d: `M ${x - r * 0.55} ${y - r * 0.84} C ${x - r * 1.5} ${y - r * 2.7}, ${x + r * 1.5} ${y - r * 2.7}, ${x + r * 0.55} ${y - r * 0.84}`,
        lx: x, ly: y - r * 2.25 - 7
      };
    }
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const nx = uy, ny = -ux;
    const c = { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend };
    const sl = Math.hypot(c.x - a.x, c.y - a.y) || 1, tl = Math.hypot(b.x - c.x, b.y - c.y) || 1;
    const s = { x: a.x + (c.x - a.x) / sl * ra, y: a.y + (c.y - a.y) / sl * ra };
    const e = { x: b.x - (b.x - c.x) / tl * (rb + 1.5), y: b.y - (b.y - c.y) / tl * (rb + 1.5) };
    const side = bend >= 0 ? 1 : -1;
    const at = t => { const m = quad(s, c, e, t); return { x: m.x + nx * 13 * side, y: m.y + ny * 13 * side + 4 }; };
    const m = at(0.5);
    return { d: `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`, lx: m.x, ly: m.y, at };
  }

  /* Courbure d'un arc selon les couches et la présence de l'arc inverse. */
  function bendFor(layerFrom, layerTo, a, b, hasReverse) {
    const span = Math.abs(layerFrom - layerTo);
    let bend = 0;
    if (span === 0) bend = 34 + 0.12 * Math.hypot(b.x - a.x, b.y - a.y);
    else if (span > 1) bend = 26 + 24 * (span - 1);
    if (hasReverse) bend = Math.max(bend, 22);
    return bend;
  }

  /* Affichage compact des symboles d'un arc (alphabets de textes). */
  const display = c => (c === ' ' ? '␣' : c === '\n' ? '↵' : c === '\t' ? '⇥' : c === ',' ? '‘,’' : c);
  const classOf = c => (/[0-9]/.test(c) ? 'd' : /[a-z]/.test(c) ? 'l' : /[A-Z]/.test(c) ? 'u' : null);
  function ranges(symbols) {
    const out = [];
    for (let i = 0; i < symbols.length;) {
      let j = i;
      const k = classOf(symbols[i]);
      while (k && j + 1 < symbols.length && classOf(symbols[j + 1]) === k && symbols[j + 1].codePointAt(0) === symbols[j].codePointAt(0) + 1) j++;
      if (j - i >= 2) out.push(`${symbols[i]}–${symbols[j]}`);
      else for (let m = i; m <= j; m++) out.push(display(symbols[m]));
      i = j + 1;
    }
    return out.join(', ');
  }
  function symbolLabel(symbols, alphabet) {
    if (symbols.length <= 4) return symbols.map(display).join(', ');
    const direct = ranges(symbols);
    const rest = alphabet.filter(c => !symbols.includes(c));
    if (!rest.length) return 'Σ';
    const complement = `Σ∖{${ranges(rest)}}`;
    return complement.length < direct.length ? complement : direct;
  }

  const api = { layered, edgeGeometry, bendFor, symbolLabel, radius, display };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AutomataLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
