/* Copyright (C) 2026 Amaury Curiel & Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
/*
 * Moteur des automates : lecture du format du TME et exécution tracée des
 * algorithmes du TME (même comportement que le corrigé). Chaque étape
 * (« frame ») mémorise la ligne de pseudo-code concernée (voir pseudo.js),
 * les algorithmes en cours d'appel et l'état de l'automate observé.
 */
(function (root) {
  'use strict';
  const Pseudo = root.AutomataPseudo || (typeof require === 'function' ? require('./pseudo.js') : null);
  const LIMITS = { states: 150, transitions: 1500, frames: 6000, word: 60 };

  class AutomatonError extends Error {
    constructor(key, params = {}) { super(key); this.key = key; this.params = params; }
  }
  const fail = (key, params) => { throw new AutomatonError(key, params); };

  /* ---------- ordre canonique (les ensembles Python sont parcourus dans cet ordre) ---------- */
  const cmpId = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
  const cmpSym = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const byId = (x, y) => cmpId(x.id, y.id);
  const byTrans = (x, y) => cmpId(x.from, y.from) || cmpSym(x.symbol, y.symbol) || cmpId(x.to, y.to);
  const ids = states => states.map(s => s.id);
  const sameT = (t, u) => t.from === u.from && t.symbol === u.symbol && t.to === u.to;
  const addUnique = (list, state) => { if (!list.some(s => s.id === state.id)) list.push(state); list.sort(byId); };

  /* ---------- automates : { states: [{id,label,initial,final}], transitions: [{from,symbol,to}], v } ---------- */
  const G = {
    make: (states = [], transitions = []) => ({ states, transitions, v: 0 }),
    copy: g => G.make(g.states.map(s => ({ ...s })), g.transitions.map(t => ({ from: t.from, symbol: t.symbol, to: t.to }))),
    get: (g, id) => g.states.find(s => s.id === id),
    has: (g, id) => g.states.some(s => s.id === id),
    states: g => [...g.states].sort(byId),
    initials: g => G.states(g).filter(s => s.initial),
    finals: g => G.states(g).filter(s => s.final),
    from: (g, id) => g.transitions.filter(t => t.from === id).sort(byTrans),
    hasT: (g, t) => g.transitions.some(u => sameT(t, u)),
    alphabet: g => [...new Set(g.transitions.map(t => t.symbol))].sort(cmpSym),
    succ(g, stateIds, a) {
      const out = [];
      for (const t of g.transitions) if (stateIds.includes(t.from) && t.symbol === a) addUnique(out, G.get(g, t.to));
      return out;
    },
    addState(g, s) {
      if (g.states.length >= LIMITS.states) fail('err.tooManyStates', { n: LIMITS.states });
      g.states.push(s); g.v++;
    },
    removeState(g, id) { g.states = g.states.filter(s => s.id !== id); g.v++; },
    addT(g, t) {
      if (G.hasT(g, t)) return false;
      if (g.transitions.length >= LIMITS.transitions) fail('err.tooManyTransitions', { n: LIMITS.transitions });
      g.transitions.push({ from: t.from, symbol: t.symbol, to: t.to }); g.v++;
      return true;
    },
    removeT(g, t) { g.transitions = g.transitions.filter(u => !sameT(t, u)); g.v++; },
    touch(g) { g.v++; },
    nextId(g) {
      if (!g.states.length) fail('err.nextIdEmpty');
      return String(g.states.reduce((m, s) => (BigInt(s.id) > m ? BigInt(s.id) : m), -1n) + 1n);
    }
  };
  const newLabel = S => {
    const L = S.map(s => s.label).sort();
    let ch = '{';
    for (const s of L) ch += s + ',';
    return ch.slice(0, -1) + '}';
  };
  const accepts = (g, word) => {
    let active = ids(G.initials(g));
    for (const c of word) active = ids(G.succ(g, active, c));
    return active.some(id => G.get(g, id).final);
  };

  /* ---------- mots et signatures dans les messages ---------- */
  const py = {
    str: s => `'${s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/'/g, "\\'")}'`,
    tuple: arr => `(${arr.join(', ')}${arr.length === 1 ? ',' : ''})`
  };
  const show = s => s.replace(/\n/g, '↵').replace(/ /g, '␣');
  /* notation mathématique pour les messages */
  const ml = s => s.label;
  const ms = arr => (arr.length ? `{${arr.map(ml).join(', ')}}` : '∅');
  const mstrs = arr => (arr.length ? `{${arr.map(show).join(', ')}}` : '∅');
  const mref = (g, id) => { const s = G.get(g, id); return s ? s.label : id; };
  const mt = (g, t) => `${mref(g, t.from)} –${show(t.symbol)}→ ${mref(g, t.to)}`;

  /* ---------- trace ---------- */
  class Tracer {
    constructor() {
      this.frames = []; this.stack = []; this.view = null; this.scene = 'main'; this.muted = 0;
      this.cache = new WeakMap();
    }
    call(fn) {
      if (!Pseudo.listingOf[fn]) throw new Error(`Fonction inconnue : ${fn}`);
      this.stack.push({ fn });
    }
    ret() { this.stack.pop(); }
    show(graph, scene) { this.view = graph; this.scene = scene; }
    /* « pas par-dessus » : l'appel s'exécute sans produire d'étapes. */
    over(fn) {
      const saved = [this.view, this.scene];
      this.muted++;
      try { return fn(); } finally { this.muted--; [this.view, this.scene] = saved; }
    }
    snapshot(g) {
      if (!g) return null;
      const cached = this.cache.get(g);
      if (cached && cached.v === g.v) return cached.snap;
      const snap = { states: g.states.map(s => ({ ...s })), transitions: g.transitions.map(t => ({ ...t })) };
      this.cache.set(g, { v: g.v, snap });
      return snap;
    }
    step(line, msg, o = {}) {
      const top = this.stack[this.stack.length - 1];
      const loc = Pseudo.locate(top.fn, line);
      if (!loc) throw new Error(`Étape inconnue : ${top.fn}.${line}`);
      if (this.muted) return;
      if (this.frames.length >= LIMITS.frames) fail('err.tooManyFrames', { n: LIMITS.frames });
      this.frames.push({
        listing: loc.listing, line: loc.line, msg,
        stack: this.stack.map(e => Pseudo.listingOf[e.fn]).filter((key, i, all) => key !== all[i - 1]),
        graph: this.snapshot(o.view || this.view), scene: o.scene || this.scene,
        active: o.active || [], marked: o.marked || [], pending: o.pending || null, edges: o.edges || [],
        groups: o.groups || [], src: o.src || null, execution: o.execution || null,
        partition: o.partition || null, ref: o.ref || null, board: o.board || null
      });
    }
  }

  /* =====================================================================
   * Fonctions de base (automateBase.py)
   * ===================================================================== */
  function addState(T, self, state) {
    T.call('addState');
    
    const exists = G.has(self, state.id);
    T.step('test', [exists ? 'addState.exists' : 'addState.absent', { s: ml(state) }], { active: exists ? [state.id] : [] });
    if (exists) { T.step('false', ['ret.false'], { active: [state.id] }); T.ret(); return false; }
    G.addState(self, state); 
    T.step('add', ['addState.add', { s: ml(state) }], { active: [state.id] });
    T.step('true', ['ret.true'], { active: [state.id] });
    T.ret(); return true;
  }

  function removeState(T, self, id) {
    const state = G.get(self, id) || { id, label: id, initial: false, final: false };
    T.call('removeState');
    
    const exists = G.has(self, id);
    T.step('test', [exists ? 'removeState.exists' : 'removeState.absent', { s: ml(state) }], { active: exists ? [id] : [] });
    if (!exists) { T.step('false', ['ret.false']); T.ret(); return false; }
    const copyT = [...self.transitions].sort(byTrans);
    
    T.step('copy', ['removeState.copy', { n: copyT.length }], { active: [id] });
    for (const t of copyT) {
      const text = mt(self, t), hit = t.from === id || t.to === id;
      
      T.step('cond', [hit ? 'removeState.hit' : 'removeState.miss', { t: text }], { active: [id], edges: [t] });
      if (hit) { G.removeT(self, t); T.step('remove', ['removeState.removed', { t: text }], { active: [id] }); }
    }
    G.removeState(self, id); 
    T.step('removeState', ['removeState.done', { s: ml(state) }]);
    T.step('true', ['ret.true']);
    T.ret(); return true;
  }

  function addTransition(T, self, t) {
    const known = id => G.get(self, id);
    const src = known(t.from) ? { ...known(t.from) } : { id: t.from, label: t.from, initial: false, final: false };
    const dst = known(t.to) ? { ...known(t.to) } : { id: t.to, label: t.to, initial: false, final: false };
    const text = `${src.label} –${show(t.symbol)}→ ${dst.label}`;
    T.call('addTransition');
    
    const exists = G.hasT(self, t);
    T.step('test', [exists ? 'addTransition.exists' : 'addTransition.absent', { t: text }], { active: [t.from, t.to].filter(known), edges: exists ? [t] : [] });
    if (exists) { T.step('false', ['ret.false'], { edges: [t] }); T.ret(); return false; }
    let trouveSrc = false, trouveDest = false;
    
    T.step('initDest', ['addTransition.search']);
    for (const s of G.states(self)) {
      
      if (s.id === t.from) { trouveSrc = true; T.step('foundSrc', ['addTransition.foundSrc', { s: ml(s) }], { active: [s.id] }); }
      if (s.id === t.to) { trouveDest = true; T.step('foundDest', ['addTransition.foundDest', { s: ml(s) }], { active: [s.id] }); }
    }
    if (!trouveSrc) { G.addState(self, src); T.step('addSrc', ['addTransition.addState', { s: ml(src) }], { active: [src.id] }); }
    if (!trouveDest && t.to !== t.from) { G.addState(self, dst); T.step('addDest', ['addTransition.addState', { s: ml(dst) }], { active: [dst.id] }); }
    G.addT(self, t); 
    T.step('add', ['addTransition.add', { t: text }], { active: [t.from, t.to], edges: [t] });
    T.step('true', ['ret.true'], { edges: [t] });
    T.ret(); return true;
  }

  function removeTransition(T, self, t) {
    const text = mt(self, t);
    T.call('removeTransition');
    
    const exists = G.hasT(self, t);
    T.step('test', [exists ? 'removeTransition.exists' : 'removeTransition.absent', { t: text }], { active: [t.from, t.to].filter(id => G.has(self, id)), edges: exists ? [t] : [] });
    if (!exists) { T.step('false', ['ret.false']); T.ret(); return false; }
    G.removeT(self, t); 
    T.step('remove', ['removeTransition.done', { t: text }], { active: [t.from, t.to] });
    T.step('true', ['ret.true']);
    T.ret(); return true;
  }

  /* =====================================================================
   * 3. Tests et complétion
   * ===================================================================== */
  const cloneRows = rows => rows.map(r => ({ ...r, cells: r.cells ? { ...r.cells } : undefined }));

  function succ(T, g, setStates, lettre) {
    T.call('succ');
    
    const S = [];
    const succRows = setStates.map(s => ({ id: s.id, label: s.label, outgoing: '', matched: '', status: 'todo' }));
    const succBoard = (activeState = null) => (T.muted ? null : {
      kind: 'succTable', symbol: lettre, activeState, result: ms(S),
      rows: succRows.map(r => ({ ...r }))
    });
    
    T.step('init', ['succ.init'], { pending: ids(setStates), board: succBoard() });
    setStates.forEach((s, k) => {
      const pending = ids(setStates.slice(k + 1));
      const row = succRows[k];
      row.status = 'active';
      
      T.step('loopS', ['succ.state', { s: s.label }], { active: [s.id], pending, marked: ids(S), board: succBoard(s.id) });
      const S2 = G.from(g, s.id);
      row.outgoing = S2.map(t => `${show(t.symbol)}→${mref(g, t.to)}`).join(', ') || '—';
      const matchedList = [];
      
      T.step('S2', ['succ.S2', { s: s.label, n: S2.length }], { active: [s.id], edges: S2, pending, marked: ids(S), board: succBoard(s.id) });
      for (const l of S2) {
        const ok = l.symbol === lettre;
        
        T.step('test', [ok ? 'succ.match' : 'succ.noMatch', { t: mt(g, l), a: lettre }], { active: [s.id], edges: [l], pending, marked: ids(S), board: succBoard(s.id) });
        if (ok) {
          const target = G.get(g, l.to);
          addUnique(S, target);
          matchedList.push(target.label);
          row.matched = matchedList.join(', ');
          T.step('add', ['succ.add', { q: target.label }], { active: [s.id], edges: [l], pending, marked: ids(S), board: succBoard(s.id) });
        }
      }
      if (!row.matched) row.matched = '—';
      row.status = 'done';
    });
    T.step('ret', ['succ.ret', { S: ms(S) }], { marked: ids(S), board: succBoard() });
    T.ret(); return S;
  }

  function accepte(T, g, word) {
    const mot = word.join('');
    T.call('accepte');
    
    const ini = G.initials(g);
    const chain = [{ symbol: null, states: ms(ini) }];
    const accBoard = (depth, isFinal = false, accepted = null) => (T.muted ? null : {
      kind: 'wordRibbon', word, depth, isFinal, accepted, chain: chain.map(c => ({ ...c }))
    });
    T.step('call', ['acc.start', { I: ms(ini) }], { active: ids(ini), execution: { depth: 0 }, board: accBoard(0) });
    const r = accepteEtats(T, g, ini, word, 0, word.length, chain, accBoard);
    T.ret(); return r;
  }
  function accepteEtats(T, g, setStates, chars, depth, total, chain, accBoard) {
    const mot = chars.join(''), act = ids(setStates);
    T.call('accepte_etats');
    
    T.step('empty', [mot === '' ? 'acc.emptyYes' : 'acc.emptyNo', { mot: py.str(mot) }], { active: act, execution: { depth }, board: accBoard(depth) });
    let r = false;
    if (mot === '') {
      for (const s of setStates) {
        
        T.step('fin', [s.final ? 'acc.isFinal' : 'acc.notFinal', { s: s.label }], { active: [s.id], marked: act, execution: { depth, isFinal: true }, board: accBoard(depth, true, null) });
        if (s.final) { r = true; T.step('true', ['acc.accepted'], { active: [s.id], execution: { depth, isFinal: true }, board: accBoard(depth, true, true) }); break; }
      }
      if (!r) T.step('false', ['acc.rejected'], { active: act, execution: { depth, isFinal: true }, board: accBoard(depth, true, false) });
    } else {
      const a = chars[0];
      const S = T.over(() => succ(T, g, setStates, a));
      const edges = g.transitions.filter(t => act.includes(t.from) && t.symbol === a);
      chain.push({ symbol: a, states: ms(S) });
      
      T.step('succ', ['acc.succ', { a, S: ms(S) }], { active: ids(S), edges, execution: { depth: depth + 1 }, board: accBoard(depth + 1) });
      T.step('rec', ['acc.rec', { mot: py.str(chars.slice(1).join('')) }], { active: ids(S), execution: { depth: depth + 1 }, board: accBoard(depth + 1) });
      r = accepteEtats(T, g, S, chars.slice(1), depth + 1, total, chain, accBoard);
    }
    T.ret(); return r;
  }
  /* Arbre des exécutions (panneau « Exécutions ») : indépendant du code. */
  function executionTree(g, word) {
    const nodes = ids(G.initials(g)).map(state => ({ state, parent: null, symbol: null, depth: 0, blockedAt: null }));
    const trace = { word, nodes, truncatedAt: null };
    let frontier = nodes.map((_, i) => i), leaves = frontier.length;
    word.forEach((c, i) => {
      if (trace.truncatedAt !== null) return;
      const additions = [], blocked = [];
      let nextLeaves = leaves;
      for (const parent of frontier) {
        const out = g.transitions.filter(t => t.from === nodes[parent].state && t.symbol === c);
        if (!out.length) blocked.push(parent);
        else { nextLeaves += out.length - 1; for (const t of out) additions.push({ state: t.to, parent, symbol: c, depth: i + 1, blockedAt: null }); }
        if (nodes.length + additions.length > 4000 || nextLeaves > 256) { trace.truncatedAt = i + 1; return; }
      }
      for (const parent of blocked) nodes[parent].blockedAt = i + 1;
      frontier = additions.map((_, k) => nodes.length + k);
      nodes.push(...additions);
      leaves = nextLeaves;
    });
    return trace;
  }

  function estDeterministe(T, g) {
    T.call('estDeterministe');
    let L = G.initials(g);
    const allStates = G.states(g), A = G.alphabet(g);
    const rows = allStates.map(s => ({ id: s.id, label: s.label, initial: s.initial, final: s.final, cells: {} }));
    const rowMap = new Map(rows.map(r => [r.id, r]));
    const checkBoard = (activeRow = null, activeSymbol = null, failedCell = null) => (T.muted ? null : {
      kind: 'checkTable', mode: 'det', alphabet: A, initCount: L.length, initOk: L.length === 1,
      activeRow, activeSymbol, failedCell, rows: cloneRows(rows)
    });
    
    T.step('ini', ['isdet.ini', { n: L.length }], { active: ids(L), board: checkBoard() });
    if (L.length !== 1) { T.step('false1', ['isdet.notOne', { n: L.length }], { active: ids(L), board: checkBoard() }); T.ret(); return false; }
    L = allStates; 
    T.step('all', ['isdet.all'], { pending: ids(L), board: checkBoard() });
    T.step('alpha', ['isdet.alpha', { A: mstrs(A) }], { pending: ids(L), board: checkBoard() });
    for (const [k, s] of L.entries()) {
      
      const pending = ids(L.slice(k + 1));
      const row = rowMap.get(s.id);
      for (const a of A) {
        
        const dest = G.succ(g, [s.id], a), edges = G.from(g, s.id).filter(t => t.symbol === a);
        const failDet = dest.length > 1;
        row.cells[a] = { text: dest.length ? ms(dest) : '—', status: failDet ? 'fail' : 'ok' };
        T.step('test', ['isdet.test', { s: s.label, a, n: dest.length }], { active: [s.id], edges, pending, marked: ids(dest), board: checkBoard(s.id, a, failDet ? `${s.id}|${a}` : null) });
        if (failDet) { T.step('false2', ['isdet.no', { s: s.label, a }], { active: [s.id], edges, marked: ids(dest), board: checkBoard(s.id, a, `${s.id}|${a}`) }); T.ret(); return false; }
      }
    }
    T.step('true', ['isdet.yes'], { board: checkBoard() });
    T.ret(); return true;
  }

  function estComplet(T, g, Alphabet) {
    T.call('estComplet');
    
    const ini = G.initials(g);
    const rows = [], rowMap = new Map();
    const ensureRow = s => {
      if (!rowMap.has(s.id)) {
        const r = { id: s.id, label: s.label, initial: s.initial, final: s.final, cells: {} };
        rowMap.set(s.id, r); rows.push(r);
      }
      return rowMap.get(s.id);
    };
    ini.forEach(ensureRow);
    const compCheckBoard = (activeRow = null, activeSymbol = null, failedCell = null) => (T.muted ? null : {
      kind: 'checkTable', mode: 'comp', alphabet: Alphabet, initCount: ini.length, initOk: true,
      activeRow, activeSymbol, failedCell, rows: cloneRows(rows)
    });
    T.step('call', ['iscomp.start', { I: ms(ini) }], { pending: ids(ini), board: compCheckBoard() });
    const r = estCompletEtats(T, g, ini, Alphabet, [], 0, ensureRow, compCheckBoard);
    T.ret(); return r;
  }
  function estCompletEtats(T, g, setStates, Alphabet, visited, depth, ensureRow, compCheckBoard) {
    T.call('estComplet_etats');
    
    T.step('empty', [setStates.length ? 'iscomp.nonEmpty' : 'iscomp.empty'], { pending: ids(setStates), marked: ids(visited), board: compCheckBoard() });
    if (!setStates.length) { T.step('true', ['iscomp.yes'], { marked: ids(visited), board: compCheckBoard() }); T.ret(); return true; }
    let newStates = [];
    
    for (const [k, s] of setStates.entries()) {
      const S = G.from(g, s.id), A = [...new Set(S.map(t => t.symbol))].sort(cmpSym), pending = ids(setStates.slice(k + 1));
      const row = ensureRow(s);
      
      T.step('A', ['iscomp.letters', { s: s.label, A: mstrs(A) }], { active: [s.id], edges: S, pending, marked: ids(visited), board: compCheckBoard(s.id) });
      const missing = Alphabet.find(a => !A.includes(a));
      for (const a of Alphabet) {
        const dest = G.succ(g, [s.id], a);
        if (dest.length) row.cells[a] = { text: ms(dest), status: 'ok' };
        else if (a === missing) row.cells[a] = { text: '∅', status: 'fail' };
      }
      if (missing !== undefined) {
        
        T.step('test', ['iscomp.missing', { s: s.label, a: missing }], { active: [s.id], pending, board: compCheckBoard(s.id, missing, `${s.id}|${missing}`) });
        T.step('false', ['iscomp.no'], { active: [s.id], board: compCheckBoard(s.id, missing, `${s.id}|${missing}`) });
        T.ret(); return false;
      }
      T.step('loopA', ['iscomp.allLetters', { s: s.label }], { active: [s.id], edges: S, pending, marked: ids(visited), board: compCheckBoard(s.id) });
      const D = [];
      for (const t of S) addUnique(D, G.get(g, t.to));
      for (const d of D) if (!visited.some(x => x.id === d.id)) { addUnique(newStates, d); ensureRow(d); }
      
      T.step('union', ['iscomp.new', { N: ms(newStates) }], { active: [s.id], pending, marked: ids(newStates), board: compCheckBoard(s.id) });
    }
    const seen = [...visited];
    for (const s of setStates) addUnique(seen, s);
    T.step('rec', ['iscomp.rec', { N: ms(newStates) }], { pending: ids(newStates), marked: ids(seen), board: compCheckBoard() });
    const r = estCompletEtats(T, g, newStates, Alphabet, seen, depth + 1, ensureRow, compCheckBoard);
    T.ret(); return r;
  }

  function completeAutomate(T, g, Alphabet, scene) {
    T.call('completeAutomate');
    
    const gSnap = T.snapshot(g);
    const auto2 = G.copy(g);
    const rows = G.states(auto2).map(s => {
      const cells = {};
      for (const a of Alphabet) {
        const dest = G.succ(auto2, [s.id], a);
        cells[a] = { targets: dest.length ? dest.map(d => d.label).join(', ') : '—', missing: !dest.length, added: false };
      }
      return { id: s.id, label: s.label, initial: s.initial, final: s.final, cells };
    });
    const rowMap = new Map(rows.map(r => [r.id, r]));
    const compRef = (active = [], edges = []) => (T.muted ? null : { A: { titleKey: 'refInitialA', graph: gSnap, active, edges } });
    const compBoard = (activeRow = null, activeSymbol = null) => (T.muted ? null : {
      kind: 'compTable', alphabet: Alphabet, activeRow, activeSymbol, rows: cloneRows(rows)
    });
    T.show(auto2, scene); 
    T.step('copy', ['comp.copy'], { ref: compRef(), board: compBoard() });
    const complete = T.over(() => estComplet(T, auto2, Alphabet));
    T.step('test', [complete ? 'comp.complete' : 'comp.incomplete'], { ref: compRef(), board: compBoard() });
    if (complete) { T.step('retCopy', ['comp.retCopy'], { ref: compRef(), board: compBoard() }); T.ret(); return auto2; }
    const bot = { id: G.nextId(auto2), label: 'bot', initial: false, final: false };
    
    T.step('bot', ['comp.bot', { id: bot.id }], { ref: compRef(), board: compBoard() });
    G.addState(auto2, bot);
    const botRow = { id: bot.id, label: bot.label, initial: false, final: false, cells: {} };
    for (const a of Alphabet) botRow.cells[a] = { targets: '—', missing: true, added: false };
    rows.push(botRow); rowMap.set(bot.id, botRow);
    T.step('addBot', ['comp.addBot'], { active: [bot.id], ref: compRef(), board: compBoard(bot.id) });
    for (const a of Alphabet) {
      
      T.step('loopA', ['comp.letter', { a }], { ref: compRef(), board: compBoard(null, a) });
      const states = G.states(auto2);
      states.forEach((s, k) => {
        const pending = ids(states.slice(k + 1)), has = G.succ(auto2, [s.id], a).length > 0;
        const origEdges = G.has(gSnap, s.id) ? G.from(gSnap, s.id).filter(t => t.symbol === a) : [];
        
        T.step('test0', [has ? 'comp.has' : 'comp.missing', { s: s.label, a }], { active: [s.id], pending, edges: G.from(auto2, s.id).filter(t => t.symbol === a), ref: compRef(G.has(gSnap, s.id) ? [s.id] : [], origEdges), board: compBoard(s.id, a) });
        if (!has) {
          const t = { from: s.id, symbol: a, to: bot.id };
          
          G.addT(auto2, t);
          rowMap.get(s.id).cells[a] = { targets: bot.label, missing: false, added: true };
          T.step('add', ['comp.add', { s: s.label, a }], { active: [s.id], edges: [t], pending, ref: compRef(G.has(gSnap, s.id) ? [s.id] : []), board: compBoard(s.id, a) });
        }
      });
    }
    T.step('ret', ['comp.done', { n: auto2.transitions.length }], { ref: compRef(), board: compBoard() });
    T.ret(); return auto2;
  }

  /* =====================================================================
   * 4. Déterminisation
   * ===================================================================== */

  function determinisation(T, g, scene = 'det', srcKey = null) {
    const src = list => (srcKey ? { [srcKey]: list } : null);
    T.call('determinisation');
    const gSnap = T.snapshot(g), detAlpha = G.alphabet(g);
    const tableRows = [], rowMap = new Map();
    const detRef = (active = [], marked = [], edges = []) => (T.muted ? null : {
      A: { titleKey: 'refInitialA', graph: gSnap, active, marked, edges }
    });
    const detBoard = (activeRow = null, activeSymbol = null, highlightRow = null) => (T.muted ? null : {
      kind: 'detTable', alphabet: detAlpha, activeRow, activeSymbol, highlightRow,
      rows: cloneRows(tableRows)
    });
    const Ini = G.initials(g);
    
    T.step('ini', ['det.ini', { I: ms(Ini) }], { src: src(ids(Ini)), ref: detRef(ids(Ini)), board: detBoard() });
    let fin = false;
    
    for (const e of Ini) {
      
      if (e.final) { fin = true; T.step('fin1', ['det.iniFinal', { e: e.label }], { src: src([e.id]), ref: detRef(ids(Ini), [e.id]), board: detBoard() }); }
    }
    const lab = newLabel(Ini);
    
    T.step('lab', ['det.lab', { lab }], { src: src(ids(Ini)), ref: detRef(ids(Ini)), board: detBoard() });
    const s = { id: '0', label: lab, initial: true, final: fin };
    
    T.step('s', ['det.s0', { lab }], { src: src(ids(Ini)), ref: detRef(ids(Ini)), board: detBoard() });
    const A = G.make();
    T.show(A, scene); 
    T.step('A', ['det.A'], { ref: detRef(ids(Ini)), board: detBoard() });
    G.addState(A, s);
    const initRow = { id: s.id, label: s.label, setLabel: ms(Ini), initial: true, final: fin, status: 'todo', cells: {} };
    tableRows.push(initRow); rowMap.set(s.id, initRow);
    T.step('add', ['det.add', { lab }], { active: [s.id], src: src(ids(Ini)), ref: detRef(ids(Ini)), board: detBoard(null, null, s.id) });
    const Alphabet = detAlpha;
    
    T.step('alpha', ['det.alpha', { A: mstrs(Alphabet) }], { ref: detRef(), board: detBoard() });
    const Etats = new Map([[s.id, Ini]]);
    
    T.step('etatsS', ['det.etats', { lab }], { ref: detRef(ids(Ini)), board: detBoard(null, null, s.id) });
    T.step('call', ['det.call'], { pending: [s.id], ref: detRef(), board: detBoard() });
    determinisationEtats(T, A, g, Alphabet, [s], 0, Etats, new Set([lab]), src, { gSnap, tableRows, rowMap, detRef, detBoard });
    
    T.step('ret', ['det.done', { n: A.states.length }], { ref: detRef(), board: detBoard() });
    T.ret(); return A;
  }

  function determinisationEtats(T, self, auto, Alphabet, queue, i, Etats, visited, src, ctx) {
    T.call('determinisation_etats');
    const { tableRows, rowMap, detRef, detBoard } = ctx;
   
    if (i >= queue.length) {
      T.step('test', ['det.end', { i, n: queue.length }], { ref: detRef(), board: detBoard() });
      T.step('ret', ['det.endRet'], { ref: detRef(), board: detBoard() });
      T.ret(); return;
    }
    const pending = () => ids(queue.slice(i + 1));
    T.step('test', ['det.test', { i, n: queue.length }], { pending: ids(queue.slice(i)), ref: detRef(), board: detBoard() });
    const s = queue[i], row = rowMap.get(s.id);
    row.status = 'active';
    
    T.step('s', ['det.current', { lab: s.label }], { active: [s.id], pending: pending(), ref: detRef(ids(Etats.get(s.id))), board: detBoard(s.id) });
    const N = Etats.get(s.id);
    
    T.step('N', ['det.N', { lab: s.label, N: ms(N) }], { active: [s.id], pending: pending(), src: src(ids(N)), ref: detRef(ids(N)), board: detBoard(s.id) });
    for (const a of Alphabet) {
      
      T.step('loopA', ['det.letter', { a }], { active: [s.id], pending: pending(), src: src(ids(N)), ref: detRef(ids(N)), board: detBoard(s.id, a) });
      const S = T.over(() => succ(T, auto, N, a));
      const edgesA = auto.transitions.filter(t => ids(N).includes(t.from) && t.symbol === a);
      
      T.step('S', ['det.S', { N: ms(N), a, S: ms(S) }], { active: [s.id], pending: pending(), src: src(ids(S)), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a) });
      if (!S.length) {
        row.cells[a] = { empty: true, targetLabel: '∅' };
        T.step('nonEmpty', ['det.emptyS', { a }], { active: [s.id], pending: pending(), ref: detRef(ids(N), [], edgesA), board: detBoard(s.id, a) });
        continue;
      }
      const lab = newLabel(S);
      
      T.step('lab', ['det.lab', { lab }], { active: [s.id], pending: pending(), src: src(ids(S)), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a) });
      let t;
      if (!visited.has(lab)) {
        const fin = S.some(e => e.final);
        
        T.step('new', ['det.new', { lab }], { active: [s.id], pending: pending(), src: src(ids(S)), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a) });
        T.step('loopE', [fin ? 'det.finYes' : 'det.finNo', { lab }], { active: [s.id], pending: pending(), src: src(ids(S)), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a) });
        const s2 = { id: G.nextId(self), label: lab, initial: false, final: fin };
        
        T.step('s2', ['det.s2', { lab, id: s2.id }], { active: [s.id], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a) });
        queue.push(s2);
        T.step('append', ['det.append', { lab }], { active: [s.id], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a) });
        G.addState(self, s2);
        const newRow = { id: s2.id, label: s2.label, setLabel: ms(S), initial: false, final: fin, status: 'todo', cells: {} };
        tableRows.push(newRow); rowMap.set(s2.id, newRow);
        T.step('addState', ['det.addState', { lab }], { active: [s.id, s2.id], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a, s2.id) });
        Etats.set(s2.id, S);
        T.step('etats', ['det.etatsNew', { lab }], { active: [s.id, s2.id], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a, s2.id) });
        t = { from: s.id, symbol: a, to: s2.id };
        
        visited.add(lab);
        T.step('dejaVus', ['det.memo', { lab }], { active: [s.id, s2.id], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a, s2.id) });
      } else {
        T.step('old', ['det.old', { lab }], { active: [s.id], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a) });
        const r = self.states.find(x => x.label === lab);
        
        T.step('r', ['det.found', { lab }], { active: [s.id, r.id], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a, r.id) });
        t = { from: s.id, symbol: a, to: r.id };
        
      }
      G.addT(self, t);
      row.cells[a] = { empty: false, targetId: t.to, targetLabel: lab };
      T.step('addT', ['det.addT', { from: s.label, a, to: lab }], { active: [s.id], edges: [t], pending: pending(), ref: detRef(ids(N), ids(S), edgesA), board: detBoard(s.id, a, t.to) });
    }
    row.status = 'done';
    T.step('rec', ['det.rec', { i: i + 1 }], { pending: ids(queue.slice(i + 1)), ref: detRef(), board: detBoard() });
    determinisationEtats(T, self, auto, Alphabet, queue, i + 1, Etats, visited, src, ctx);
    T.ret();
  }

  /* =====================================================================
   * 5.1 Opérations ensemblistes
   * ===================================================================== */
  function complementaire(T, g, Alphabet) {
    T.call('complementaire');
    
    const gSnap = T.snapshot(g);
    let A = G.copy(g), scene = 'copy';
    T.show(A, scene); 
    T.step('copy', ['compl.copy'], { ref: { A: { titleKey: 'refInitialA', graph: gSnap } } });
    const det = T.over(() => estDeterministe(T, g));
    T.step('det', [det ? 'compl.isDet' : 'compl.notDet'], { ref: { A: { titleKey: 'refInitialA', graph: gSnap } } });
    if (!det) {
      scene = 'det';
      A = determinisation(T, A, scene, 'A');
      T.show(A, scene); 
      T.step('callDet', ['compl.detDone', { n: A.states.length }], { ref: { A: { titleKey: 'refInitialA', graph: gSnap } } });
    }
    const complete = T.over(() => estComplet(T, A, Alphabet));
    T.step('comp', [complete ? 'compl.isComplete' : 'compl.notComplete'], { ref: { A: { titleKey: 'refInitialA', graph: gSnap } } });
    if (!complete) {
      A = completeAutomate(T, A, Alphabet, scene);
      T.show(A, scene); 
      T.step('callComp', ['compl.compDone'], { ref: { A: { titleKey: 'refInitialA', graph: gSnap } } });
    }
    const S = G.states(A);
    const complRows = S.map(s => ({ id: s.id, label: s.label, before: s.final, after: s.final, flipped: false }));
    const complRowMap = new Map(complRows.map(r => [r.id, r]));
    const complBoard = (activeRow = null) => (T.muted ? null : {
      kind: 'complTable', activeRow, rows: complRows.map(r => ({ ...r }))
    });
    const complRef = () => (T.muted ? null : { A: { titleKey: 'refInitialA', graph: gSnap } });
    
    T.step('S', ['compl.flipAll'], { pending: ids(S), ref: complRef(), board: complBoard() });
    S.forEach((s, k) => {
      
      T.step('loop', ['compl.state', { s: s.label }], { active: [s.id], pending: ids(S.slice(k + 1)), ref: complRef(), board: complBoard(s.id) });
      s.final = !s.final; G.touch(A);
      const r = complRowMap.get(s.id); r.after = s.final; r.flipped = true;
      
      T.step('flip', [s.final ? 'compl.nowFinal' : 'compl.nowNotFinal', { s: s.label }], { active: [s.id], pending: ids(S.slice(k + 1)), ref: complRef(), board: complBoard(s.id) });
    });
    T.step('ret', ['compl.done'], { ref: complRef(), board: complBoard() });
    T.ret(); return A;
  }

  function productInit(T, A, gA, gB, list, Etats, isUnion, ctx) {
    const Ini0 = G.initials(gA), Ini1 = G.initials(gB);
    const { prodRef, prodBoard, tableRows, rowMap } = ctx;
    
    T.step('ini0', ['prod.ini0', { I: ms(Ini0) }], { src: { A: ids(Ini0) }, ref: prodRef(ids(Ini0), []), board: prodBoard() });
    
    T.step('ini1', ['prod.ini1', { I: ms(Ini1) }], { src: { B: ids(Ini1) }, ref: prodRef([], ids(Ini1)), board: prodBoard() });
    
    let nextId = 0;
    
    T.step('next', ['prod.prepare'], { ref: prodRef(ids(Ini0), ids(Ini1)), board: prodBoard() });
    for (const s0 of Ini0) for (const s1 of Ini1) {
      const lab = `(${s0.label}, ${s1.label})`;
      const fin = isUnion ? s0.final || s1.final : s0.final && s1.final;
      const s = { id: String(nextId), label: lab, initial: true, final: fin };
      
      T.step('s', ['prod.initPair', { lab }], { src: { A: [s0.id], B: [s1.id] }, ref: prodRef([s0.id], [s1.id]), board: prodBoard() });
      nextId++; 
      G.addState(A, s);
      const row = { id: s.id, label: lab, pLabel: s0.label, qLabel: s1.label, initial: true, final: fin, status: 'todo', cells: {} };
      tableRows.push(row); rowMap.set(s.id, row);
      T.step('add', ['prod.addInit', { lab }], { active: [s.id], src: { A: [s0.id], B: [s1.id] }, ref: prodRef([s0.id], [s1.id]), board: prodBoard(null, null, s.id) });
      Etats.set(lab, { s, L: [s0, s1] }); list.push(lab);
      
      T.step('append', ['prod.append', { lab }], { pending: list.map(l => Etats.get(l).s.id), ref: prodRef([s0.id], [s1.id]), board: prodBoard(null, null, s.id) });
    }
  }

  function intersection(T, gA, gB) {
    T.call('intersection');
    const A = G.make();
    const snapA = T.snapshot(gA), snapB = T.snapshot(gB);
    const alphabet = [...new Set([...G.alphabet(gA), ...G.alphabet(gB)])].sort(cmpSym);
    const tableRows = [], rowMap = new Map();
    const prodRef = (actA = [], actB = [], markA = [], markB = [], edgesA = [], edgesB = []) => (T.muted ? null : {
      A: { titleKey: 'refInitialA', graph: snapA, active: actA, marked: markA, edges: edgesA },
      B: { titleKey: 'refInitialB', graph: snapB, active: actB, marked: markB, edges: edgesB }
    });
    const prodBoard = (activeRow = null, activeSymbol = null, highlightRow = null) => (T.muted ? null : {
      kind: 'prodTable', alphabet, activeRow, activeSymbol, highlightRow, rows: cloneRows(tableRows)
    });
    const ctx = { tableRows, rowMap, prodRef, prodBoard };
    T.show(A, 'prod'); 
    T.step('A', ['prod.A'], { ref: prodRef(), board: prodBoard() });
    const list = [], Etats = new Map();
    productInit(T, A, gA, gB, list, Etats, false, ctx);
    
    T.step('alpha', ['prod.alpha', { A: mstrs(alphabet) }], { ref: prodRef(), board: prodBoard() });
    T.step('call', ['prod.call'], { ref: prodRef(), board: prodBoard() });
    productEtats(T, 'intersection_etats', A, gA, gB, alphabet, list, 0, new Set(), Etats, false, ctx);
    T.ret(); return A;
  }

  function union(T, gA, gB) {
    T.call('union');
    const A = G.make();
    const snapA0 = T.snapshot(gA), snapB0 = T.snapshot(gB);
    const alphabet = [...new Set([...G.alphabet(gA), ...G.alphabet(gB)])].sort(cmpSym);
    const tableRows = [], rowMap = new Map();
    let refGraphA = snapA0, refGraphB = snapB0;
    const prodRef = (actA = [], actB = [], markA = [], markB = [], edgesA = [], edgesB = []) => (T.muted ? null : {
      A: { titleKey: 'refInitialA', graph: refGraphA, active: actA, marked: markA, edges: edgesA },
      B: { titleKey: 'refInitialB', graph: refGraphB, active: actB, marked: markB, edges: edgesB }
    });
    const prodBoard = (activeRow = null, activeSymbol = null, highlightRow = null) => (T.muted ? null : {
      kind: 'prodTable', alphabet, activeRow, activeSymbol, highlightRow, rows: cloneRows(tableRows)
    });
    const ctx = { tableRows, rowMap, prodRef, prodBoard };
    T.show(A, 'prod'); 
    T.step('A', ['prod.A'], { ref: prodRef(), board: prodBoard() });
    
    T.step('alpha', ['prod.alpha', { A: mstrs(alphabet) }], { ref: prodRef(), board: prodBoard() });
    const a0 = T.over(() => completeAutomate(T, gA, alphabet, 'a0'));
    
    T.step('a0', [a0.states.length > gA.states.length ? 'union.completed' : 'union.alreadyComplete', { x: 'A' }], { view: a0, scene: 'a0', ref: prodRef() });
    const a1 = T.over(() => completeAutomate(T, gB, alphabet, 'a1'));
    
    T.step('a1', [a1.states.length > gB.states.length ? 'union.completed' : 'union.alreadyComplete', { x: 'B' }], { view: a1, scene: 'a1', ref: prodRef() });
    refGraphA = T.snapshot(a0); refGraphB = T.snapshot(a1);
    const list = [], Etats = new Map();
    productInit(T, A, gA, gB, list, Etats, true, ctx);
    T.step('call', ['prod.call'], { ref: prodRef(), board: prodBoard() });
    productEtats(T, 'union_etats', A, a0, a1, alphabet, list, 0, new Set(), Etats, true, ctx);
    const without = [['A', gA], ['B', gB]].filter(([, g]) => !G.initials(g).length).map(([x]) => x);
    if (without.length) T.step('call', ['union.noInitial', { x: without.join(', ') }], { ref: prodRef(), board: prodBoard() });
    T.ret(); return A;
  }

  function productEtats(T, name, self, auto0, auto1, alphabet, list, index, visited, Etats, isUnion, ctx) {
    T.call(name);
    const { tableRows, rowMap, prodRef, prodBoard } = ctx;
    const pendingFrom = k => list.slice(k).map(l => Etats.get(l).s.id);
   
    if (index >= list.length) {
      T.step('test', ['prod.end'], { ref: prodRef(), board: prodBoard() });
      T.step('ret', ['prod.done', { n: self.states.length }], { ref: prodRef(), board: prodBoard() });
      T.ret(); return self;
    }
    T.step('test', ['prod.test', { i: index, n: list.length }], { pending: pendingFrom(index), ref: prodRef(), board: prodBoard() });
    const { s, L } = Etats.get(list[index]), [s0, s1] = L;
    const row = rowMap.get(s.id); row.status = 'active';
    const src = (x, y) => ({ A: x, B: y });
    
    T.step('s1', ['prod.current', { lab: s.label }], { active: [s.id], pending: pendingFrom(index + 1), src: src([s0.id], [s1.id]), ref: prodRef([s0.id], [s1.id]), board: prodBoard(s.id) });
    const T0 = G.from(auto0, s0.id), T1 = G.from(auto1, s1.id);
    
    T.step('T1', ['prod.transitions', { n0: T0.length, n1: T1.length }], { active: [s.id], pending: pendingFrom(index + 1), src: src([s0.id], [s1.id]), ref: prodRef([s0.id], [s1.id], [], [], T0, T1), board: prodBoard(s.id) });
    for (const a of alphabet) {
      const T0a = [], T1a = [];
      for (const t of T0) if (t.symbol === a) addUnique(T0a, G.get(auto0, t.to));
      for (const t of T1) if (t.symbol === a) addUnique(T1a, G.get(auto1, t.to));
      const edges0 = T0.filter(t => t.symbol === a), edges1 = T1.filter(t => t.symbol === a);
      
      T.step('T1a', ['prod.letter', { a, A: ms(T0a), B: ms(T1a) }], { active: [s.id], pending: pendingFrom(index + 1), src: src(ids(T0a), ids(T1a)), ref: prodRef([s0.id], [s1.id], ids(T0a), ids(T1a), edges0, edges1), board: prodBoard(s.id, a) });
      for (const f0 of T0a) for (const f1 of T1a) {
        const lab = `(${f0.label}, ${f1.label})`;
        const e0 = edges0.filter(t => t.to === f0.id), e1 = edges1.filter(t => t.to === f1.id);
        
        let s2;
        if (!visited.has(lab) && !list.slice(index).includes(lab)) {
          const init = f0.initial && f1.initial, fin = isUnion ? f0.final || f1.final : f0.final && f1.final;
          s2 = { id: G.nextId(self), label: lab, initial: init, final: fin };
          
          T.step('new', ['prod.new', { lab }], { active: [s.id], pending: pendingFrom(index + 1), src: src([f0.id], [f1.id]), ref: prodRef([s0.id], [s1.id], [f0.id], [f1.id], e0, e1), board: prodBoard(s.id, a) });
          T.step('s2', [fin ? 'prod.newFinal' : 'prod.newNotFinal', { lab, id: s2.id }], { active: [s.id], pending: pendingFrom(index + 1), src: src([f0.id], [f1.id]), ref: prodRef([s0.id], [s1.id], [f0.id], [f1.id], e0, e1), board: prodBoard(s.id, a) });
          G.addState(self, s2);
          const newRow = { id: s2.id, label: lab, pLabel: f0.label, qLabel: f1.label, initial: init, final: fin, status: 'todo', cells: {} };
          tableRows.push(newRow); rowMap.set(s2.id, newRow);
          T.step('add', ['prod.addState', { lab }], { active: [s.id, s2.id], pending: pendingFrom(index + 1), ref: prodRef([s0.id], [s1.id], [f0.id], [f1.id], e0, e1), board: prodBoard(s.id, a, s2.id) });
          const t = { from: s.id, symbol: a, to: s2.id };
          G.addT(self, t);
          if (!row.cells[a]) row.cells[a] = [];
          row.cells[a].push(lab);
          T.step('addT1', ['prod.addT', { from: s.label, a, to: lab }], { active: [s.id], edges: [t], pending: pendingFrom(index + 1), ref: prodRef([s0.id], [s1.id], [f0.id], [f1.id], e0, e1), board: prodBoard(s.id, a, s2.id) });
          Etats.set(lab, { s: s2, L: [f0, f1] }); list.push(lab);
          T.step('append', ['prod.append', { lab }], { active: [s.id], pending: pendingFrom(index + 1), ref: prodRef([s0.id], [s1.id], [f0.id], [f1.id], e0, e1), board: prodBoard(s.id, a, s2.id) });
        } else {
          s2 = Etats.get(lab).s;
          
          T.step('old', ['prod.old', { lab }], { active: [s.id, s2.id], pending: pendingFrom(index + 1), src: src([f0.id], [f1.id]), ref: prodRef([s0.id], [s1.id], [f0.id], [f1.id], e0, e1), board: prodBoard(s.id, a, s2.id) });
          const t = { from: s.id, symbol: a, to: s2.id };
          const added = G.addT(self, t);
          if (added) {
            if (!row.cells[a]) row.cells[a] = [];
            row.cells[a].push(lab);
          }
          T.step('addT2', [added ? 'prod.addT' : 'prod.existingT', { from: s.label, a, to: lab }], { active: [s.id], edges: [t], pending: pendingFrom(index + 1), ref: prodRef([s0.id], [s1.id], [f0.id], [f1.id], e0, e1), board: prodBoard(s.id, a, s2.id) });
        }
      }
    }
    index++; visited.add(s.label); row.status = 'done';
    T.step('dejaVus', ['prod.processed', { lab: s.label }], { pending: pendingFrom(index), ref: prodRef(), board: prodBoard() });
    T.step('rec', ['prod.rec', { i: index }], { pending: pendingFrom(index), ref: prodRef(), board: prodBoard() });
    const r = productEtats(T, name, self, auto0, auto1, alphabet, list, index, visited, Etats, isUnion, ctx);
    T.ret(); return r;
  }

  /* =====================================================================
   * 5.2 Opérations rationnelles
   * ===================================================================== */
  function concatenation(T, gA, gB) {
    T.call('concatenation');
    const snapA = T.snapshot(gA), snapB = T.snapshot(gB);
    const auto1 = G.copy(gA), auto2 = G.copy(gB);
    const concatRef = (actA = [], markA = [], edgesA = [], actB = [], markB = []) => (T.muted ? null : {
      A: { titleKey: 'refInitialA', graph: snapA, active: actA, marked: markA, edges: edgesA },
      B: { titleKey: 'refInitialB', graph: snapB, active: actB, marked: markB }
    });
    T.show(auto1, 'concatA'); 
    T.step('copy1', ['concat.copy', { x: 'A' }], { ref: concatRef() });
    
    T.step('copy2', ['concat.copy', { x: 'B' }], { view: auto2, scene: 'concatB', ref: concatRef() });
    const b = accepts(auto1, []);
    
    T.step('b', [b ? 'concat.epsYes' : 'concat.epsNo'], { active: ids(G.initials(auto1)), ref: concatRef(ids(G.initials(auto1))) });
    /* prefixStates(2) : id ↦ 2·10^len(id) + id, label ↦ '2_' + label (state.py) */
    const rename = new Map(), origB = new Map();
    for (const s of auto2.states) {
      const id = String(2n * 10n ** BigInt(s.id.length) + BigInt(s.id));
      if (G.has(auto1, id)) fail('err.concatCollision', { id, old: s.id });
      rename.set(s.id, id); origB.set(id, s.id); s.id = id; s.label = `2_${s.label}`;
    }
    for (const t of auto2.transitions) { t.from = rename.get(t.from); t.to = rename.get(t.to); }
    const V = G.make([...auto1.states, ...auto2.states], [...auto1.transitions, ...auto2.transitions]);
    T.show(V, 'concat'); 
    T.step('prefix', ['concat.prefix'], { active: ids(auto2.states), ref: concatRef() });
    const setFin1 = G.finals(auto1), setInit2 = G.initials(auto2);
    const origInit2 = setInit2.map(s => origB.get(s.id));
    
    T.step('fin1', ['concat.fin1', { S: ms(setFin1) }], { marked: ids(setFin1), ref: concatRef([], ids(setFin1), [], [], []) });
    
    T.step('init2', ['concat.init2', { S: ms(setInit2) }], { marked: ids(setInit2), ref: concatRef([], ids(setFin1), [], [], origInit2) });
    
    T.step('trans', ['concat.trans', { n: V.transitions.length }], { ref: concatRef([], ids(setFin1), [], [], origInit2) });
    const jonction = auto1.transitions.filter(t => G.get(auto1, t.to).final).sort(byTrans);
    const juncRows = jonction.map(t => ({ sourceText: mt(V, t), added: [], done: false }));
    const juncBoard = (activeIndex = -1) => (T.muted ? null : {
      kind: 'junctionTable', activeIndex,
      rows: juncRows.map(r => ({ ...r, added: [...r.added] }))
    });
    
    T.step('jonction', ['concat.jonction', { n: jonction.length }], { edges: jonction, ref: concatRef([], ids(setFin1), jonction, [], origInit2), board: juncBoard() });
    jonction.forEach((t, k) => {
      
      T.step('s', ['concat.junction', { t: mt(V, t) }], { active: [t.from], edges: [t], pending: [...new Set(jonction.slice(k + 1).map(u => u.from))], ref: concatRef([t.from], [t.to], [t], [], origInit2), board: juncBoard(k) });
      for (const i2 of setInit2) {
        const n = { from: t.from, symbol: t.symbol, to: i2.id };
        const added = G.addT(V, n);
        juncRows[k].added.push(mt(V, n));
        
        T.step('add', [added ? 'concat.add' : 'concat.existing', { t: mt(V, n) }], { active: [t.from, i2.id], edges: [n], ref: concatRef([t.from], [t.to], [t], [origB.get(i2.id)], []), board: juncBoard(k) });
      }
      juncRows[k].done = true;
    });
    T.step('notB', [b ? 'concat.keepInit' : 'concat.dropInit'], { ref: concatRef([], [], [], [], origInit2), board: juncBoard() });
    if (!b) for (const s of setInit2) {
      s.initial = false; G.touch(V);
      
      T.step('noInit', ['concat.noInit', { s: s.label }], { active: [s.id], ref: concatRef([], [], [], [origB.get(s.id)], []), board: juncBoard() });
    }
    for (const s of setFin1) {
      s.final = false; G.touch(V);
      
      T.step('noFin', ['concat.noFin', { s: s.label }], { active: [s.id], ref: concatRef([s.id], [], [], [], []), board: juncBoard() });
    }
    /* Correction par rapport au corrigé : celui-ci renvoie Automate(setTrans),
       qui perd les états isolés (et parfois le mot vide). On garde tous les états. */
    T.step('ret', ['concat.ret'], { ref: concatRef(), board: juncBoard() });
    T.ret(); return V;
  }

  function plus(T, g, scene) {
    T.call('plus');
    const snap = T.snapshot(g);
    const a = G.copy(g);
    const plusRef = (active = [], marked = [], edges = []) => (T.muted ? null : {
      A: { titleKey: 'refInitialA', graph: snap, active, marked, edges }
    });
    T.show(a, scene); 
    T.step('copy', ['plus.copy'], { ref: plusRef() });
    const setFin = G.finals(a), setInit = G.initials(a);
    
    T.step('fin', ['plus.fin', { S: ms(setFin) }], { marked: ids(setFin), ref: plusRef([], ids(setFin)) });
    
    T.step('init', ['plus.init', { S: ms(setInit) }], { marked: ids(setInit), ref: plusRef(ids(setInit), ids(setFin)) });
    const jonction = a.transitions.filter(t => G.get(a, t.to).final).sort(byTrans);
    const juncRows = jonction.map(t => ({ sourceText: mt(a, t), added: [], done: false }));
    const juncBoard = (activeIndex = -1) => (T.muted ? null : {
      kind: 'junctionTable', activeIndex,
      rows: juncRows.map(r => ({ ...r, added: [...r.added] }))
    });
    
    T.step('jonction', ['plus.jonction', { n: jonction.length }], { edges: jonction, ref: plusRef(ids(setInit), ids(setFin), jonction), board: juncBoard() });
    for (const i of setInit) jonction.forEach((t, k) => {
      const n = { from: t.from, symbol: t.symbol, to: i.id };
      const added = G.addT(a, n);
      juncRows[k].added.push(mt(a, n));
      if (i === setInit[setInit.length - 1]) juncRows[k].done = true;
      
      T.step('add', [added ? 'plus.add' : 'plus.existing', { t: mt(a, n), from: mt(a, t) }], { active: [t.from, i.id], edges: [n], ref: plusRef([t.from, i.id], [t.to], [t]), board: juncBoard(k) });
    });
    T.step('ret', ['plus.done'], { ref: plusRef(), board: juncBoard() });
    T.ret(); return a;
  }

  function etoile(T, g) {
    T.call('etoile');
    const snap = T.snapshot(g);
    const starRef = () => (T.muted ? null : { A: { titleKey: 'refInitialA', graph: snap } });
    const autoplus = plus(T, g, 'star');
    T.show(autoplus, 'star'); 
    T.step('plus', ['star.plus'], { ref: starRef() });
    const s = { id: G.nextId(autoplus), label: 'j', initial: true, final: true };
    
    T.step('s', ['star.s', { id: s.id }], { ref: starRef() });
    G.addState(autoplus, s); 
    T.step('add', ['star.add'], { active: [s.id], ref: starRef() });
    T.step('ret', ['star.done'], { ref: starRef() });
    T.ret(); return autoplus;
  }

  /* =====================================================================
   * Minimisation (algorithme de Moore, cours 5bis)
   * ===================================================================== */
  function minimisation(T, g, Alphabet) {
    T.call('minimisation');
    
    let A = T.over(() => determinisation(T, g, 'min'));
    T.show(A, 'min'); 
    T.step('det', ['min.det', { n: A.states.length }]);
    A = T.over(() => completeAutomate(T, A, Alphabet, 'min'));
    T.show(A, 'min'); 
    T.step('comp', ['min.comp', { n: A.states.length }]);
    const states = G.states(A);
    const groupsOf = cl => {
      const groups = Array.from({ length: Math.max(0, ...cl.values()) + 1 }, () => []);
      for (const s of states) groups[cl.get(s.id)].push(s.id);
      return groups;
    };
    let classe = new Map(states.map(s => [s.id, s.final ? 1 : 0]));
    const history = [{ iter: 0, classes: groupsOf(classe) }];
    const partition = (rows = null, activeState = null, cls = classe) => ({
      classes: groupsOf(cls), rows, alphabet: Alphabet, activeState,
      history: history.map(h => ({ iter: h.iter, classes: h.classes }))
    });
    
    T.step('init', ['min.init'], { groups: groupsOf(classe), partition: partition() });
    let nb = new Set(classe.values()).size;
    
    T.step('nb', ['min.nb', { nb }], { groups: groupsOf(classe), partition: partition() });
    let stable = false, iteration = 0, lastRows = null;
    
    while (!stable) {
      iteration++;
      T.step('while', ['min.iter', { k: iteration }], { groups: groupsOf(classe), partition: partition() });
      const signatures = new Map(), rows = [];
      
      states.forEach((s, k) => {
        const sig = [classe.get(s.id), ...Alphabet.map(a => classe.get(G.succ(A, [s.id], a)[0].id))];
        signatures.set(s.id, sig); rows.push({ id: s.id, cls: classe.get(s.id), sig, next: null });
        
        T.step('sig', ['min.sig', { s: s.label, sig: py.tuple(sig) }], { active: [s.id], edges: G.from(A, s.id).filter(t => Alphabet.includes(t.symbol)), pending: ids(states.slice(k + 1)), groups: groupsOf(classe), partition: partition(rows.map(r => ({ ...r })), s.id) });
      });
      const keys = [...new Map([...signatures.values()].map(sig => [sig.join(','), sig])).values()]
        .sort((x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
      const numeros = new Map(keys.map((sig, n) => [sig.join(','), n]));
      
      T.step('num', ['min.number', { k: numeros.size }], { groups: groupsOf(classe), partition: partition(rows) });
      const nouvelle = new Map(states.map(s => [s.id, numeros.get(signatures.get(s.id).join(','))]));
      for (const r of rows) r.next = nouvelle.get(r.id);
      stable = numeros.size === nb;
      if (!stable) history.push({ iter: iteration, classes: groupsOf(nouvelle) });
      
      T.step('new', ['min.new'], { groups: groupsOf(nouvelle), partition: partition(rows, null, nouvelle) });
      
      T.step('stable', [stable ? 'min.stable' : 'min.notStable', { a: nb, b: numeros.size }], { groups: groupsOf(nouvelle), partition: partition(rows, null, nouvelle) });
      classe = nouvelle; nb = numeros.size; lastRows = rows;
      
      T.step('update', ['min.update', { nb }], { groups: groupsOf(classe), partition: partition() });
    }
    const finalPartition = partition(lastRows);
    const ASnap = T.snapshot(A);
    const finalGroups = groupsOf(classe);
    const B = quotient(T, A, classe, finalGroups, { partition: finalPartition, ASnap });
    
    T.step('ret', ['min.done', { n: B.states.length }], {
      partition: finalPartition,
      ref: T.muted ? null : { A: { titleKey: 'refPartitionedA', graph: ASnap, groups: finalGroups } }
    });
    T.ret(); return B;
  }

  function quotient(T, A, classe, groups, extra = {}) {
    T.call('quotient');
    const states = G.states(A), Q = new Map();
    const ASnap = extra.ASnap || T.snapshot(A);
    const qRef = (active = [], marked = [], edges = []) => (T.muted ? null : {
      A: { titleKey: 'refPartitionedA', graph: ASnap, groups, active, marked, edges }
    });
    
    T.step('Q', ['quot.Q'], { groups, partition: extra.partition || null, ref: qRef() });
    for (const s of states) {
      const c = classe.get(s.id);
      if (Q.has(c)) continue;
      const C = states.filter(e => classe.get(e.id) === c);
      const q = { id: String(c), label: newLabel(C), initial: C.some(e => e.initial), final: C.some(e => e.final) };
      Q.set(c, q);
      
      T.step('create', ['quot.create', { c, lab: q.label }], { active: ids(C), groups, partition: extra.partition || null, ref: qRef(ids(C)) });
    }
    const B = G.make([...Q.values()].sort(byId).map(q => ({ ...q })), []);
    T.show(B, 'quot'); 
    T.step('B', ['quot.B', { n: B.states.length }], { partition: extra.partition || null, ref: qRef() });
    for (const t of [...A.transitions].sort(byTrans)) {
      const n = { from: String(classe.get(t.from)), symbol: t.symbol, to: String(classe.get(t.to)) };
      const added = G.addT(B, n);
      
      T.step('add', [added ? 'quot.add' : 'quot.dup', { t: mt(A, t), q: mt(B, n) }], { active: [n.from], edges: [n], partition: extra.partition || null, ref: qRef([t.from], [t.to], [t]) });
    }
    T.step('ret', ['quot.done'], { partition: extra.partition || null, ref: qRef() });
    T.ret(); return B;
  }

  /* =====================================================================
   * Lecture du format du TME
   * ===================================================================== */
  function parse(text) {
    const match = /^\s*#E:\s*([\s\S]*?)#I:\s*([\s\S]*?)#F:\s*([\s\S]*?)#T:\s*([\s\S]*)$/u.exec(text);
    if (!match) fail('err.format');
    function list(part, section) {
      const value = part.trim();
      if (!value) return [];
      const parts = value.split(/\s+/u);
      const bad = parts.find(s => !/^\d+$/u.test(s));
      if (bad !== undefined) fail('err.ids', { section, value: bad });
      return [...new Set(parts.map(s => BigInt(s).toString()))];
    }
    const states = list(match[1], '#E'), ini = list(match[2], '#I'), fin = list(match[3], '#F');
    const undeclared = [...ini, ...fin].find(id => !states.includes(id));
    if (undeclared !== undefined) fail('err.undeclared', { id: undeclared });
    const transitions = [];
    let rest = match[4];
    const regex = /^\s*\(\s*(\d+)\s+([^\s()])\s+(\d+)\s*\)/u;
    while (rest.trim()) {
      const m = regex.exec(rest);
      if (!m) fail('err.transition', { near: rest.trim().slice(0, 40) });
      const from = BigInt(m[1]).toString(), to = BigInt(m[3]).toString(), symbol = m[2];
      if (!states.includes(from) || !states.includes(to)) fail('err.transitionState', { t: `(${from} ${symbol} ${to})` });
      if (!transitions.some(t => t.from === from && t.to === to && t.symbol === symbol)) transitions.push({ from, symbol, to });
      rest = rest.slice(m[0].length);
    }
    if (states.length > LIMITS.states || transitions.length > LIMITS.transitions) fail('err.inputTooBig', { s: LIMITS.states, t: LIMITS.transitions });
    return { states: states.map(id => ({ id, label: id, initial: ini.includes(id), final: fin.includes(id) })), transitions };
  }
  const formatTme = (states, transitions, mapId) =>
    `#E: ${states.map(s => mapId(s.id)).join(' ')}\n#I: ${states.filter(s => s.initial).map(s => mapId(s.id)).join(' ')}\n#F: ${states.filter(s => s.final).map(s => mapId(s.id)).join(' ')}\n#T: ${[...transitions].sort(byTrans).map(t => `(${mapId(t.from)} ${t.symbol} ${mapId(t.to)})`).join('\n')}`;
  const toText = g => {
    const states = G.states(g), rename = new Map(states.map((s, i) => [s.id, String(i)]));
    return formatTme(states, g.transitions, id => rename.get(id));
  };
  const toEditorText = g => formatTme(G.states(g), g.transitions, id => id);

  /* =====================================================================
   * Opérations proposées par l'interface
   * ===================================================================== */
  const operations = {
    addState: { group: 'construction', fields: ['stateId', 'initial', 'final'], listing: 'addState' },
    removeState: { group: 'construction', fields: ['stateId'], listing: 'removeState' },
    addTransition: { group: 'construction', fields: ['from', 'symbol', 'to'], listing: 'addTransition' },
    removeTransition: { group: 'construction', fields: ['from', 'symbol', 'to'], listing: 'removeTransition' },
    successors: { group: 'tests', fields: ['states', 'symbol'], listing: 'succ' },
    accept: { group: 'tests', fields: ['word'], listing: 'accept' },
    deterministic: { group: 'tests', fields: [], listing: 'isDet' },
    completeTest: { group: 'tests', fields: ['alphabet'], listing: 'isComplete' },
    complete: { group: 'transformations', fields: ['alphabet'], listing: 'complete' },
    determinize: { group: 'transformations', fields: [], listing: 'determinize' },
    complement: { group: 'transformations', fields: ['alphabet'], listing: 'complement' },
    intersection: { group: 'transformations', fields: ['B'], listing: 'intersection' },
    union: { group: 'transformations', fields: ['B'], listing: 'union' },
    concat: { group: 'transformations', fields: ['B'], listing: 'concat' },
    plus: { group: 'transformations', fields: [], listing: 'plus' },
    star: { group: 'transformations', fields: [], listing: 'star' },
    minimize: { group: 'transformations', fields: ['alphabet'], listing: 'minimize' }
  };

  const parseAlphabet = text => [...new Set([...(text || '')].filter(c => !/\s/u.test(c)))].sort(cmpSym);
  const parseId = (value, key) => {
    const v = String(value || '').trim();
    if (!/^\d+$/u.test(v)) fail(key);
    return BigInt(v).toString();
  };
  const parseSymbol = value => {
    const chars = [...String(value || '')];
    if (chars.length !== 1 || /[\s()]/u.test(chars[0])) fail('err.symbol');
    return chars[0];
  };

  function run(op, o = {}) {
    const meta = operations[op];
    if (!meta) fail('err.unknownOp');
    const T = new Tracer();
    const A = o.a ? G.copy(o.a) : null, B = o.b ? G.copy(o.b) : null;
    if (!A) fail('err.needA');
    if (meta.fields.includes('B') && !B) fail('err.needB');
    let result = null, value = null, executionTrace = null;
    const alphabet = () => parseAlphabet(o.alphabet);
    const requireLabels = Σ => {
      const missing = G.alphabet(A).filter(c => !Σ.includes(c));
      if (missing.length) fail('err.alphabetMissing', { missing: missing.join(' ') });
    };
    switch (op) {
      case 'addState': {
        const id = parseId(o.stateId, 'err.stateId');
        result = A; T.show(A, 'A');
        value = addState(T, A, { id, label: id, initial: Boolean(o.initial), final: Boolean(o.final) });
        break;
      }
      case 'removeState':
        result = A; T.show(A, 'A');
        value = removeState(T, A, parseId(o.stateId, 'err.stateId'));
        break;
      case 'addTransition': case 'removeTransition': {
        const t = { from: parseId(o.from, 'err.endpoints'), symbol: parseSymbol(o.symbol), to: parseId(o.to, 'err.endpoints') };
        result = A; T.show(A, 'A');
        value = op === 'addTransition' ? addTransition(T, A, t) : removeTransition(T, A, t);
        break;
      }
      case 'successors': {
        const list = [...new Set((o.states || []).map(String))];
        if (!list.length) fail('err.startStates');
        const unknown = list.find(id => !G.has(A, id));
        if (unknown !== undefined) fail('err.unknownState', { id: unknown });
        T.show(A, 'A');
        value = succ(T, A, list.map(id => G.get(A, id)).sort(byId), parseSymbol(o.symbol));
        break;
      }
      case 'accept': {
        const word = [...String(o.word || '')];
        if (word.length > LIMITS.word) fail('err.wordTooLong', { n: LIMITS.word });
        executionTrace = executionTree(A, word);
        T.show(A, 'A');
        value = accepte(T, A, word);
        break;
      }
      case 'deterministic': T.show(A, 'A'); value = estDeterministe(T, A); break;
      case 'completeTest': T.show(A, 'A'); value = estComplet(T, A, alphabet()); break;
      case 'complete': T.show(A, 'A'); result = completeAutomate(T, A, alphabet(), 'res'); break;
      case 'determinize': result = determinisation(T, A, 'det', 'A'); break;
      case 'complement': { const Σ = alphabet(); requireLabels(Σ); result = complementaire(T, A, Σ); break; }
      case 'intersection': result = intersection(T, A, B); break;
      case 'union': result = union(T, A, B); break;
      case 'concat': result = concatenation(T, A, B); break;
      case 'plus': result = plus(T, A, 'plus'); break;
      case 'star': result = etoile(T, A); break;
      case 'minimize': { const Σ = alphabet(); requireLabels(Σ); result = minimisation(T, A, Σ); break; }
      default: fail('err.unknownOp');
    }
    return { frames: T.frames, result, value, executionTrace, listing: meta.listing };
  }

  const api = {
    parse, run, operations, toText, toEditorText, LIMITS, AutomatonError,
    wordAccepted: (g, word) => accepts(g, [...word]),
    newLabel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Automata = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
