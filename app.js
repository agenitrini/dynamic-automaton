/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const Layout = AutomataLayout, I18N = AutomataI18n, Pseudo = AutomataPseudo;
  const partitionColors = ['#fee2e2', '#dcfce7', '#dbeafe', '#fef3c7', '#ede9fe', '#cffafe', '#ffedd5', '#fce7f3', '#e2e8f0', '#ecfccb'];
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sampleA = '#E: 0 1 2 3\n#I: 0\n#F: 3\n#T: (0 a 0)\n(0 b 0)\n(0 a 1)\n(1 a 2)\n(2 a 3)\n(3 a 3)\n(3 b 3)';
  const sampleB = '#E: 0 1 2\n#I: 0\n#F: 2\n#T: (0 a 0) (0 b 1) (1 a 2) (1 b 2) (2 a 0) (2 b 1)';
  $('autoA').value = sampleA; $('autoB').value = sampleB;

  let lang = 'fr';
  try {
    const requested = new URLSearchParams(location.search).get('lang');
    lang = requested === 'fr' || requested === 'en' ? requested : localStorage.getItem('dt-lang') || (navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en');
  } catch (error) { console.warn('Language preference unavailable:', error); }
  if (lang !== 'fr' && lang !== 'en') lang = 'fr';
  const text = key => I18N.ui[lang][key];
  const msg = m => (Array.isArray(m) ? I18N.message(lang, m[0], m[1]) || m[0] : '');
  const errorText = e => (e && e.key ? I18N.message(lang, e.key, e.params) || e.key : String(e && e.message || e));

  function el(name, attrs, parent, content) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (content !== undefined) node.textContent = content;
    if (parent) parent.appendChild(node);
    return node;
  }
  const tween = (duration, step, done) => {
    const start = performance.now();
    let id = 0;
    const tick = now => {
      const t = Math.min(1, (now - start) / duration), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      step(e);
      if (t < 1) id = requestAnimationFrame(tick); else if (done) done();
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  };

  /* ---------------------------------------------------------------
   * Scènes : une mise en page commune à toutes les étapes d'une scène
   * --------------------------------------------------------------- */
  function buildScenes(frames) {
    const acc = new Map();
    for (const f of frames) {
      let e = acc.get(f.scene);
      if (!e) acc.set(f.scene, e = { states: new Map(), order: [], trans: new Map(), seen: new Set() });
      if (!f.graph || e.seen.has(f.graph)) continue;
      e.seen.add(f.graph);
      for (const s of f.graph.states) { if (!e.states.has(s.id)) e.order.push(s.id); e.states.set(s.id, s); }
      for (const t of f.graph.transitions) e.trans.set(`${t.from}|${t.symbol}|${t.to}`, t);
    }
    const scenes = new Map();
    for (const [key, e] of acc) {
      const trans = [...e.trans.values()];
      const lay = Layout.layered(e.order.map(id => e.states.get(id)), trans);
      scenes.set(key, {
        pos: lay.pos, base: new Map([...lay.pos].map(([id, p]) => [id, { ...p }])), radius: lay.radius, layer: lay.layer,
        alphabet: [...new Set(trans.map(t => t.symbol))].sort()
      });
    }
    return scenes;
  }

  /* ---------------------------------------------------------------
   * Vue SVG d'un automate, avec rendu incrémental et animations
   * --------------------------------------------------------------- */
  class GraphView {
    constructor(svg) {
      this.svg = svg; this.nodes = new Map(); this.edges = new Map();
      this.scene = null; this.sceneKey = null; this.box = null; this.custom = false; this.frame = null;
      this.stopBox = null; this.stopLayout = null; this.drag = null;
      const defs = el('defs', {}, svg);
      for (const [id, color] of [['arrow', '#68748e'], ['hot', '#d58216'], ['init', '#d54d65']]) {
        const m = el('marker', { id: `${svg.id}-${id}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 11, markerHeight: 11, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }, defs);
        el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }, m);
      }
      this.gEdges = el('g', {}, svg); this.gNodes = el('g', {}, svg); this.gLabels = el('g', {}, svg);
      this.emptyText = el('text', { class: 'empty-text', 'text-anchor': 'middle', x: 0, y: 0 }, svg);
      this.bindPointer();
    }
    clear() {
      this.gEdges.replaceChildren(); this.gNodes.replaceChildren(); this.gLabels.replaceChildren();
      this.nodes.clear(); this.edges.clear();
    }
    setScene(key, scene) {
      if (key === this.sceneKey) return false;
      if (this.stopLayout) this.stopLayout();
      this.clear(); this.sceneKey = key; this.scene = scene;
      return true;
    }
    pos(id) { return (this.scene && this.scene.pos.get(id)) || { x: 0, y: 0 }; }
    radius(id, label) { return (this.scene && this.scene.radius.get(id)) || Layout.radius(label === undefined ? id : label); }
    layerOf(id) { return this.scene && this.scene.layer.has(id) ? this.scene.layer.get(id) : 0; }

    render(frame, animate) {
      this.frame = frame;
      const graph = frame.graph || { states: [], transitions: [] };
      const anim = animate && !reducedMotion();
      const seen = new Set();
      for (const s of graph.states) {
        seen.add(s.id);
        let n = this.nodes.get(s.id);
        const isNew = !n;
        if (isNew) n = this.createNode(s);
        this.updateNode(n, s, frame);
        if (isNew && anim) {
          const p = this.pos(s.id);
          n.g.animate([{ opacity: 0, transform: `translate(${p.x}px, ${p.y}px) scale(.25)` }, { opacity: 1, transform: `translate(${p.x}px, ${p.y}px) scale(1)` }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.25)' });
        }
      }
      for (const [id, n] of this.nodes) if (!seen.has(id)) { this.nodes.delete(id); this.discard([n.g], anim); }

      const groups = new Map();
      for (const t of graph.transitions) {
        const key = `${t.from}→${t.to}`;
        if (!groups.has(key)) groups.set(key, { from: t.from, to: t.to, symbols: [] });
        groups.get(key).symbols.push(t.symbol);
      }
      const hot = new Set((frame.edges || []).map(t => `${t.from}→${t.to}`));
      const alphabet = this.scene ? this.scene.alphabet : [];
      for (const [key, group] of groups) {
        group.symbols.sort();
        let e = this.edges.get(key);
        const isNew = !e;
        if (isNew) {
          e = { from: group.from, to: group.to, path: el('path', { class: 'edge' }, this.gEdges), label: el('text', { class: 'edge-label' }, this.gLabels), text: '' };
          e.title = el('title', {}, e.label);
          this.edges.set(key, e);
        }
        const label = Layout.symbolLabel(group.symbols, alphabet);
        const isHot = hot.has(key);
        e.path.classList.toggle('hot', isHot); e.label.classList.toggle('hot', isHot);
        e.marker = `url(#${this.svg.id}-${isHot ? 'hot' : 'arrow'})`;
        if (!e.drawing) e.path.setAttribute('marker-end', e.marker);
        const changed = e.text !== label;
        if (!e.textNode) e.textNode = e.label.insertBefore(document.createTextNode(''), e.title);
        e.text = label; e.textNode.nodeValue = label;
        e.title.textContent = group.symbols.map(Layout.display).join(' ');
        e.isNew = isNew; e.changed = changed && !isNew;
      }
      for (const [key, e] of this.edges) if (!groups.has(key)) { this.edges.delete(key); this.discard([e.path, e.label], anim); }
      this.emptyText.textContent = graph.states.length ? '' : text('emptyGraph');
      this.placeAll();
      if (anim) for (const e of this.edges.values()) {
        if (e.isNew) this.drawIn(e);
        else if (e.changed) e.label.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 450 });
      }
    }
    drawIn(e) {
      let length = 0;
      try { length = e.path.getTotalLength(); } catch (error) { return; }
      if (!length) return;
      e.drawing = true; e.path.removeAttribute('marker-end');
      const a = e.path.animate([{ strokeDasharray: `${length} ${length}`, strokeDashoffset: length }, { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 }], { duration: 480, easing: 'ease-out' });
      e.label.animate([{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }], { duration: 520 });
      const finish = () => { e.drawing = false; e.path.setAttribute('marker-end', e.marker); };
      a.onfinish = finish; a.oncancel = finish;
    }
    discard(nodes, anim) {
      for (const n of nodes) {
        if (!anim) { n.remove(); continue; }
        const a = n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        a.onfinish = () => n.remove();
      }
    }
    createNode(s) {
      const g = el('g', { class: 'node', 'data-id': s.id }, this.gNodes);
      const n = {
        g, label: s.label,
        init: el('path', { class: 'init-arrow', 'marker-end': `url(#${this.svg.id}-init)` }, g),
        mark: el('circle', { class: 'mark-ring' }, g),
        circle: el('circle', { class: 'state' }, g),
        ring: el('circle', { class: 'final-ring' }, g),
        text: el('text', { class: 'state-label' }, g),
        title: el('title', {}, g)
      };
      this.nodes.set(s.id, n);
      return n;
    }
    updateNode(n, s, frame) {
      const r = this.radius(s.id, s.label);
      n.label = s.label;
      n.circle.setAttribute('r', r); n.ring.setAttribute('r', r - 5); n.mark.setAttribute('r', r + 6);
      n.init.setAttribute('d', `M ${-r - 40} 0 L ${-r - 1} 0`);
      const active = frame.active.includes(s.id), pending = Array.isArray(frame.pending) && frame.pending.includes(s.id);
      n.g.classList.toggle('is-initial', s.initial); n.g.classList.toggle('is-final', s.final);
      n.g.classList.toggle('active', active); n.g.classList.toggle('pending', pending && !active);
      n.g.classList.toggle('marked', (frame.marked || []).includes(s.id));
      const group = (frame.groups || []).findIndex(g => g.includes(s.id));
      n.circle.style.fill = !active && !pending && group >= 0 ? partitionColors[group % partitionColors.length] : '';
      if (n.text.textContent !== s.label) n.text.textContent = s.label;
      n.text.setAttribute('font-size', Math.max(9, Math.min(14, (r * 2 - 14) / Math.max(1, [...s.label].length) * 1.65)));
      n.title.textContent = `${s.label}${s.initial ? ' (init)' : ''}${s.final ? ' (fin)' : ''}`;
    }
    placeAll() {
      for (const [id, n] of this.nodes) { const p = this.pos(id); n.g.setAttribute('transform', `translate(${p.x} ${p.y})`); }
      for (const e of this.edges.values()) {
        const a = this.pos(e.from), ra = this.radius(e.from);
        let geo;
        if (e.from === e.to) geo = Layout.edgeGeometry(a, ra, a, ra, 0);
        else {
          const b = this.pos(e.to), rb = this.radius(e.to);
          geo = Layout.edgeGeometry(a, ra, b, rb, Layout.bendFor(this.layerOf(e.from), this.layerOf(e.to), a, b, this.edges.has(`${e.to}→${e.from}`)));
        }
        let { lx, ly } = geo;
        if (geo.at) {
          /* l'étiquette glisse le long de l'arc si elle tombe sur un état */
          const free = q => ![...this.nodes.keys()].some(id => { const p = this.pos(id); return Math.hypot(p.x - q.x, p.y - q.y) < this.radius(id) + 9; });
          const spot = [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8].map(geo.at).find(free);
          if (spot) ({ x: lx, y: ly } = spot);
        }
        e.path.setAttribute('d', geo.d);
        e.label.setAttribute('x', lx); e.label.setAttribute('y', ly);
      }
    }
    /* cadre englobant de toute la scène (pas seulement de l'étape) : caméra stable */
    bounds() {
      const ids = this.scene ? [...this.scene.pos.keys()] : [];
      if (!ids.length) return { x: -220, y: -130, w: 440, h: 260 };
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of ids) {
        const p = this.pos(id), r = this.radius(id);
        x0 = Math.min(x0, p.x - r - 50); x1 = Math.max(x1, p.x + r + 24);
        y0 = Math.min(y0, p.y - r * 2.7 - 26); y1 = Math.max(y1, p.y + r + 26);
      }
      let w = x1 - x0, h = y1 - y0;
      if (w < 420) { x0 -= (420 - w) / 2; w = 420; }
      if (h < 240) { y0 -= (240 - h) / 2; h = 240; }
      return { x: x0, y: y0, w, h };
    }
    applyBox() {
      const b = this.box;
      this.svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
      this.emptyText.setAttribute('x', b.x + b.w / 2); this.emptyText.setAttribute('y', b.y + b.h / 2);
    }
    fit(animate) {
      const target = this.bounds();
      if (this.stopBox) this.stopBox();
      if (!animate || !this.box || reducedMotion()) { this.box = target; this.applyBox(); return; }
      const from = { ...this.box };
      this.stopBox = tween(450, t => {
        this.box = { x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t, w: from.w + (target.w - from.w) * t, h: from.h + (target.h - from.h) * t };
        this.applyBox();
      });
    }
    zoom(factor, center) {
      if (!this.box) return;
      if (this.stopBox) this.stopBox();
      const b = this.box, c = center || { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      const w = Math.max(60, Math.min(100000, b.w * factor)), k = w / b.w;
      this.box = { x: c.x - (c.x - b.x) * k, y: c.y - (c.y - b.y) * k, w, h: b.h * k };
      this.custom = true; this.applyBox();
    }
    relayout() {
      if (!this.scene) return;
      if (this.stopLayout) this.stopLayout();
      const from = new Map([...this.scene.pos].map(([id, p]) => [id, { ...p }]));
      const to = this.scene.base;
      const step = t => {
        for (const [id, p] of from) { const q = to.get(id) || p; this.scene.pos.set(id, { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
        this.placeAll();
      };
      this.custom = false;
      if (reducedMotion()) { step(1); this.fit(false); return; }
      this.stopLayout = tween(500, step, () => { this.stopLayout = null; });
      this.fit(true);
    }
    toSvg(event) {
      const m = this.svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      return new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    }
    bindPointer() {
      const svg = this.svg;
      svg.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !this.box) return;
        const node = event.target.closest && event.target.closest('.node');
        if (node && this.scene && this.scene.pos.has(node.dataset.id)) {
          if (this.stopLayout) this.stopLayout();
          const p = this.scene.pos.get(node.dataset.id), q = this.toSvg(event);
          this.drag = { kind: 'node', id: node.dataset.id, dx: q.x - p.x, dy: q.y - p.y };
          node.classList.add('dragging');
        } else this.drag = { kind: 'pan', x: event.clientX, y: event.clientY, box: { ...this.box } };
        svg.setPointerCapture(event.pointerId);
      });
      svg.addEventListener('pointermove', event => {
        const d = this.drag;
        if (!d) return;
        if (d.kind === 'node') {
          const q = this.toSvg(event);
          this.scene.pos.set(d.id, { x: q.x - d.dx, y: q.y - d.dy });
          this.placeAll();
        } else {
          const rect = svg.getBoundingClientRect();
          const scale = Math.max(d.box.w / rect.width, d.box.h / rect.height);
          this.box = { ...d.box, x: d.box.x - (event.clientX - d.x) * scale, y: d.box.y - (event.clientY - d.y) * scale };
          this.custom = true; this.applyBox();
        }
      });
      const end = () => {
        if (this.drag && this.drag.kind === 'node') { const n = this.nodes.get(this.drag.id); if (n) n.g.classList.remove('dragging'); }
        this.drag = null;
      };
      svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
      svg.addEventListener('wheel', event => {
        if (!this.box) return;
        event.preventDefault();
        this.zoom(event.deltaY < 0 ? .9 : 1.1, this.toSvg(event));
      }, { passive: false });
    }
    highlight(ids) {
      const set = new Set(ids || []);
      for (const [id, n] of this.nodes) n.g.classList.toggle('active', set.has(id));
    }
  }

  const views = { main: new GraphView($('graph')), A: new GraphView($('previewA')), B: new GraphView($('previewB')) };

  /* ---------------------------------------------------------------
   * Aperçus des automates saisis
   * --------------------------------------------------------------- */
  const previews = { A: { graph: null, error: null, status: 'previewHint', serial: 0 }, B: { graph: null, error: null, status: 'previewHint', serial: 0 } };
  const blankFrame = graph => ({ graph, active: [], marked: [], pending: null, edges: [], groups: [] });
  function showPreview(which) {
    const p = previews[which], view = views[which];
    try {
      p.graph = Automata.parse($(`auto${which}`).value); p.error = null; p.status = null;
      view.setScene(`preview-${which}-${++p.serial}`, buildScenes([{ ...blankFrame(p.graph), scene: 'p' }]).get('p'));
      view.custom = false;
      view.render(blankFrame(p.graph), false);
      view.fit(false);
    } catch (error) {
      p.graph = null; p.error = error; p.status = null;
      view.setScene(`preview-${which}-${++p.serial}`, null); view.render(blankFrame(null), false);
    }
    updatePreviewStatus(which);
  }
  function updatePreviewStatus(which) {
    const p = previews[which], status = $(`previewStatus${which}`);
    status.classList.toggle('error', Boolean(p.error));
    status.textContent = p.error ? errorText(p.error) : p.status ? text(p.status) : '';
    for (const id of [`previewZoomIn${which}`, `previewZoomOut${which}`, `previewReset${which}`]) $(id).disabled = !p.graph;
  }
  function stalePreview(which) {
    const p = previews[which];
    if (p.graph || p.error) { p.error = null; p.status = 'previewStale'; updatePreviewStatus(which); }
  }

  /* ---------------------------------------------------------------
   * Exécution et lecture des étapes
   * --------------------------------------------------------------- */
  let run = null, index = 0, timer = null, lastError = null, messageOverride = null, runSerial = 0;
  let codeKey = null;

  function populateOperations() {
    const select = $('operation'), value = select.value;
    select.replaceChildren();
    const placeholder = new Option(text('chooseOperation'), '');
    placeholder.disabled = true; select.appendChild(placeholder);
    const groups = new Map();
    for (const [op, meta] of Object.entries(Automata.operations)) {
      if (!groups.has(meta.group)) { const g = document.createElement('optgroup'); g.label = text(`group.${meta.group}`); groups.set(meta.group, g); select.appendChild(g); }
      groups.get(meta.group).appendChild(new Option(I18N.operations[lang][op], op));
    }
    select.value = value;
  }
  function showFields() {
    const op = $('operation').value, meta = Automata.operations[op] || { fields: [] }, has = f => meta.fields.includes(f);
    $('editorB').hidden = !has('B');
    for (const [field, id] of [['alphabet', 'alphabetField'], ['word', 'wordField'], ['states', 'statesField'], ['symbol', 'symbolField'], ['stateId', 'stateIdField'], ['initial', 'initialField'], ['final', 'finalField'], ['from', 'fromField'], ['to', 'toField']])
      $(id).hidden = !has(field);
  }

  function launch() {
    pause();
    const op = $('operation').value;
    if (!op) return;
    const meta = Automata.operations[op];
    lastError = null; $('error').textContent = '';
    try {
      const a = Automata.parse($('autoA').value);
      const b = meta.fields.includes('B') ? Automata.parse($('autoB').value) : null;
      const statesText = $('states').value.trim();
      if (op === 'successors' && !/^\d+(?:\s+\d+)*$/u.test(statesText)) throw new Automata.AutomatonError('err.startStates');
      const states = op === 'successors' ? [...new Set(statesText.split(/\s+/u).map(s => BigInt(s).toString()))] : [];
      const result = Automata.run(op, {
        a, b, alphabet: $('alphabet').value, word: $('word').value, states, symbol: $('symbol').value,
        stateId: $('stateId').value, initial: $('isInitial').checked, final: $('isFinal').checked,
        from: $('from').value, to: $('to').value
      });
      run = { ...result, op, serial: ++runSerial, scenes: buildScenes(result.frames) };
      showPreview('A');
      if (b) showPreview('B');
      views.main.custom = false; views.main.sceneKey = null;
      $('useResult').hidden = !run.result; $('reuseHint').hidden = !run.result;
      buildLog();
      $('timeline').max = run.frames.length - 1;
      for (const id of ['first', 'prev', 'play', 'next', 'last', 'timeline', 'zoomIn', 'zoomOut', 'zoomReset', 'relayout']) $(id).disabled = false;
      codeKey = null;
      display(0, false);
    } catch (error) {
      if (!(error instanceof Automata.AutomatonError)) console.error(error);
      lastError = error;
      showError();
    }
  }
  function showError() {
    $('error').textContent = lastError ? `${errorText(lastError)}${run ? ` ${text('previous')}` : ''}` : '';
  }
  function buildLog() {
    const log = $('log');
    log.replaceChildren();
    if (!run) return;
    const fragment = document.createDocumentFragment();
    run.frames.forEach((frame, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${i + 1}. ${msg(frame.msg)}`;
      button.addEventListener('click', () => { pause(); display(i, false); });
      fragment.appendChild(button);
    });
    log.appendChild(fragment);
  }

  function display(i, animate) {
    if (!run) return;
    const previous = index;
    index = Math.max(0, Math.min(run.frames.length - 1, i));
    const f = run.frames[index];
    const changed = views.main.setScene(`${run.serial}:${f.scene}`, run.scenes.get(f.scene));
    views.main.render(f, animate && !changed);
    if (changed && !views.main.custom) views.main.fit(animate && index > 0);
    for (const which of ['A', 'B']) if (previews[which].graph) views[which].highlight(f.src && f.src[which]);
    messageOverride = null;
    $('message').textContent = msg(f.msg);
    $('graphTitle').textContent = I18N.operations[lang][run.op];
    $('counter').textContent = `${index + 1} / ${run.frames.length}`;
    $('timeline').value = index;
    renderCode(f);
    const buttons = $('log').children;
    if (buttons[previous]) buttons[previous].classList.remove('current');
    const current = buttons[index];
    if (current) {
      current.classList.add('current');
      const log = $('log'), top = current.offsetTop;
      if (top < log.scrollTop || top + current.offsetHeight > log.scrollTop + log.clientHeight) log.scrollTop = top - log.clientHeight / 2;
    }
    renderPartition(f); renderExecutions(f);
  }

  function renderCode(f) {
    const listing = Pseudo.listings[f.listing], li = lang === 'en' ? 1 : 0;
    const key = `${f.listing}:${lang}`;
    if (codeKey !== key) {
      codeKey = key;
      $('listingTitle').textContent = listing.title[li];
      $('code').replaceChildren(...listing.lines.map(line => { const item = document.createElement('li'); item.textContent = line[li]; return item; }));
    }
    [...$('code').children].forEach((item, n) => item.classList.toggle('current', n === f.line));
    $('callStack').textContent = f.stack.map(k => Pseudo.listings[k].title[li]).join(' ▸ ');
  }

  function renderPartition(f) {
    const p = f.partition;
    $('partitionPanel').hidden = !p;
    if (!p) return;
    const labels = new Map(f.graph.states.map(s => [s.id, s.label]));
    const list = $('partitionList');
    list.replaceChildren();
    p.classes.forEach((group, c) => {
      if (!group.length) return;
      const item = document.createElement('span');
      item.className = 'partition-class';
      item.style.backgroundColor = partitionColors[c % partitionColors.length];
      item.textContent = `C${c} = {${group.map(id => labels.get(id)).join(', ')}}`;
      list.appendChild(item);
    });
    $('signaturePanel').hidden = !p.rows;
    if (!p.rows) return;
    const body = $('signatureRows');
    body.replaceChildren();
    for (const row of p.rows) {
      const tr = document.createElement('tr');
      const signature = `C${row.sig[0]} · ${p.alphabet.map((a, k) => `${Layout.display(a)}→C${row.sig[k + 1]}`).join(', ')}`;
      for (const value of [labels.get(row.id), `C${row.cls}`, signature, row.next === null ? '' : `C${row.next}`]) {
        const td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
      }
      body.appendChild(tr);
    }
  }

  function renderExecutions(f) {
    const execution = f.execution, trace = run.executionTrace;
    $('executionPanel').hidden = !execution || !trace;
    if (!execution || !trace) return;
    const { word, nodes, truncatedAt } = trace;
    const { depth, isFinal } = execution;
    const shownDepth = truncatedAt !== null ? Math.min(depth, truncatedAt - 1) : depth;
    const truncated = truncatedAt !== null && depth >= truncatedAt;
    $('executionProgress').textContent = `${text('readPrefix')} : ${word.slice(0, depth).join('') || 'ε'} · ${text('remainingWord')} : ${word.slice(depth).join('') || 'ε'}`;
    $('executionWarning').hidden = !truncated;
    $('executionWarning').textContent = truncated ? text('executionTruncated') : '';
    $('executionEmpty').hidden = nodes.length > 0;
    const parents = new Set();
    nodes.forEach(node => { if (node.depth <= shownDepth && node.parent !== null) parents.add(node.parent); });
    const labels = new Map(f.graph.states.map(s => [s.id, s.label]));
    const finals = new Set(f.graph.states.filter(s => s.final).map(s => s.id));
    const list = $('executionList');
    list.replaceChildren();
    nodes.forEach((node, id) => {
      if (node.depth > shownDepth || parents.has(id)) return;
      const path = [];
      for (let cursor = id; cursor !== null; cursor = nodes[cursor].parent) path.push(nodes[cursor]);
      path.reverse();
      const item = document.createElement('li'), chain = document.createElement('span'), status = document.createElement('span');
      chain.className = 'execution-chain';
      chain.textContent = path.map((part, i) => (i ? ` ─${part.symbol}→ ${labels.get(part.state)}` : labels.get(part.state))).join('');
      status.className = 'execution-status';
      if (node.blockedAt !== null && node.blockedAt <= shownDepth) {
        status.classList.add('blocked');
        status.textContent = ` — ${text('executionBlocked')} « ${word[node.blockedAt - 1]} »`;
      } else if (isFinal && !truncated) {
        const accepted = finals.has(node.state);
        if (accepted) status.classList.add('accepted');
        status.textContent = ` — ${text(accepted ? 'executionAccepted' : 'executionRejected')}`;
      } else status.textContent = ` — ${text('executionRunning')}`;
      item.append(chain, status); list.appendChild(item);
    });
  }

  function pause() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    $('play').textContent = '▶'; $('play').setAttribute('aria-label', text('play')); $('play').title = text('play');
  }
  const delay = () => Math.round(2200 * 0.7 ** (Number($('speed').value) - 1));
  function tick() {
    if (!run || index >= run.frames.length - 1) { pause(); return; }
    display(index + 1, delay() > 300);
    timer = setTimeout(tick, delay());
  }
  function play() {
    if (timer !== null) { pause(); return; }
    if (!run) return;
    if (index === run.frames.length - 1) display(0, false);
    $('play').textContent = '❚❚'; $('play').setAttribute('aria-label', text('pause')); $('play').title = text('pause');
    timer = setTimeout(tick, delay());
  }

  /* ---------------------------------------------------------------
   * Langue
   * --------------------------------------------------------------- */
  function updateExpandButton(button, expanded) {
    const label = text(expanded ? 'collapseView' : 'expandView');
    button.textContent = label; button.title = label;
    button.setAttribute('aria-label', label); button.setAttribute('aria-expanded', String(expanded));
  }
  function applyLanguage() {
    document.documentElement.lang = lang;
    document.title = text('title');
    $('helpContent').lang = lang;
    $('helpContent').innerHTML = ReadmeHelp[lang];
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = text(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(node => {
      const label = text(node.dataset.i18nAria); node.setAttribute('aria-label', label);
      if (node.hasAttribute('title')) node.title = label;
    });
    populateOperations();
    $('languageText').textContent = lang === 'fr' ? 'EN' : 'FR';
    $('flagEN').toggleAttribute('hidden', lang !== 'fr');
    $('flagFR').toggleAttribute('hidden', lang !== 'en');
    $('language').title = text('switchLanguage'); $('language').setAttribute('aria-label', text('switchLanguage'));
    const playing = timer !== null;
    $('play').setAttribute('aria-label', text(playing ? 'pause' : 'play')); $('play').title = text(playing ? 'pause' : 'play');
    for (const which of ['A', 'B']) { updatePreviewStatus(which); updateExpandButton($(`previewExpand${which}`), $(`previewWrap${which}`).classList.contains('expanded')); }
    updateExpandButton($('graphExpand'), $('graphWrap').classList.contains('expanded'));
    for (const v of Object.values(views)) v.emptyText.textContent = v.frame && v.frame.graph && v.frame.graph.states.length ? '' : (v.frame ? text('emptyGraph') : '');
    if (run) {
      [...$('log').children].forEach((button, i) => { button.textContent = `${i + 1}. ${msg(run.frames[i].msg)}`; });
      codeKey = null;
      display(index, false);
      if (messageOverride) $('message').textContent = text(messageOverride);
    }
    showError();
  }

  /* ---------------------------------------------------------------
   * Événements
   * --------------------------------------------------------------- */
  $('operation').addEventListener('change', () => { showFields(); launch(); });
  for (const id of ['autoA', 'autoB', 'alphabet', 'word', 'states', 'symbol', 'stateId', 'isInitial', 'isFinal', 'from', 'to']) {
    $(id).addEventListener('change', () => {
      const op = $('operation').value;
      if (!op) return;
      const meta = Automata.operations[op];
      if (id === 'autoB' && !meta.fields.includes('B')) return;
      launch();
    });
  }
  for (const which of ['A', 'B']) {
    $(`previewButton${which}`).addEventListener('click', () => showPreview(which));
    $(`auto${which}`).addEventListener('input', () => stalePreview(which));
    const view = views[which];
    $(`previewZoomIn${which}`).addEventListener('click', () => view.zoom(.8));
    $(`previewZoomOut${which}`).addEventListener('click', () => view.zoom(1.25));
    $(`previewReset${which}`).addEventListener('click', () => { view.custom = false; view.relayout(); });
    $(`previewExpand${which}`).addEventListener('click', event => {
      const expanded = $(`previewWrap${which}`).classList.toggle('expanded');
      $(`editor${which}`).classList.toggle('preview-expanded', expanded);
      updateExpandButton(event.currentTarget, expanded);
    });
  }
  $('helpOpen').addEventListener('click', () => { pause(); $('helpDialog').showModal(); });
  $('helpClose').addEventListener('click', () => $('helpDialog').close());
  $('helpContent').addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (target && $('helpContent').contains(target)) { event.preventDefault(); target.scrollIntoView({ block: 'start' }); }
  });
  $('language').addEventListener('click', () => {
    lang = lang === 'fr' ? 'en' : 'fr';
    try { localStorage.setItem('dt-lang', lang); } catch (error) { console.warn('Language preference could not be saved:', error); }
    applyLanguage();
  });
  $('play').addEventListener('click', play);
  $('first').addEventListener('click', () => { pause(); display(0, false); });
  $('prev').addEventListener('click', () => { pause(); display(index - 1, false); });
  $('next').addEventListener('click', () => { pause(); display(index + 1, true); });
  $('last').addEventListener('click', () => { pause(); display(run ? run.frames.length - 1 : 0, false); });
  $('timeline').addEventListener('input', e => { pause(); display(Number(e.target.value), false); });
  $('zoomIn').addEventListener('click', () => views.main.zoom(.8));
  $('zoomOut').addEventListener('click', () => views.main.zoom(1.25));
  $('zoomReset').addEventListener('click', () => { views.main.custom = false; views.main.fit(true); });
  $('relayout').addEventListener('click', () => views.main.relayout());
  $('graphExpand').addEventListener('click', event => {
    const expanded = $('graphWrap').classList.toggle('expanded');
    $('workspace').classList.toggle('main-expanded', expanded);
    updateExpandButton(event.currentTarget, expanded);
    if (!views.main.custom) views.main.fit(false);
  });
  $('useResult').addEventListener('click', () => {
    if (!run || !run.result) return;
    $('autoA').value = Automata.toText(run.result);
    stalePreview('A');
    $('operation').value = '';
    showFields();
    $('useResult').hidden = true; $('reuseHint').hidden = true;
    $('autoA').focus();
    lastError = null; showError();
    messageOverride = 'copied'; $('message').textContent = text('copied');
  });
  document.addEventListener('keydown', e => {
    if ($('helpDialog').open) { if (e.key === 'Escape') { e.preventDefault(); $('helpDialog').close(); } return; }
    if (!run || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); play(); }
    if (e.key === 'ArrowLeft') { pause(); display(index - 1, false); }
    if (e.key === 'ArrowRight') { pause(); display(index + 1, true); }
  });

  applyLanguage();
  $('operation').value = '';
  showFields();
  showPreview('A'); showPreview('B');
})();
