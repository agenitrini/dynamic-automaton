/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { render, generated } = require('../scripts/update-help.js');

test('l’aide intégrée correspond au README', () => {
  const root = path.join(__dirname, '..');
  const readmes = { fr: fs.readFileSync(path.join(root, 'README.md'), 'utf8'), en: fs.readFileSync(path.join(root, 'README.en.md'), 'utf8') };
  assert.equal(fs.readFileSync(path.join(root, 'help-content.js'), 'utf8'), generated(readmes),
    'Exécutez node scripts/update-help.js après modification du README.');
  for (const markdown of Object.values(readmes)) {
    const html = render(markdown);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${match[1]}"`), match[1]);
    assert.match(html, /<table>/);
    assert.match(html, /<pre><code>#E:/);
  }
});
test('le rendu échappe le texte et refuse les liens dangereux', () => {
  assert.match(render('Texte <script> et `a < b`.'), /&lt;script&gt; et <code>a &lt; b<\/code>/);
  assert.throws(() => render('[clic](javascript:alert)'), /Lien non pris en charge/);
});
