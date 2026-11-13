/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(text) {
  const pattern = /\*\*([\s\S]+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|<kbd>(.*?)<\/kbd>/g;
  let html = '', start = 0, match;
  while ((match = pattern.exec(text))) {
    html += escape(text.slice(start, match.index));
    if (match[1]) html += `<strong>${inline(match[1])}</strong>`;
    else if (match[2]) html += `<code>${escape(match[2])}</code>`;
    else if (match[3]) {
      if (!/^(?:#|\.\/|https?:\/\/)/.test(match[4])) throw new Error(`Lien non pris en charge : ${match[4]}`);
      html += `<a href="${escape(match[4])}">${inline(match[3])}</a>`;
    } else html += `<kbd>${escape(match[5])}</kbd>`;
    start = pattern.lastIndex;
  }
  return html + escape(text.slice(start));
}
const headingId = text => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
const cells = line => line.trim().slice(1, -1).split('|').map(cell => cell.trim());
const listItem = line => line.match(/^(?:([-*])\s+|(\d+)\.\s+)(.*)$/);

function render(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n'), out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level} id="${escape(headingId(heading[2]))}">${inline(heading[2])}</h${level}>`);
      i++; continue;
    }
    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      if (i === lines.length) throw new Error('Bloc de code non terminé.');
      i++;
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const row = cells(lines[i++]);
        if (row.length !== header.length) throw new Error('Nombre de colonnes incohérent dans le tableau.');
        rows.push(`<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`);
      }
      out.push(`<div class="table-wrap"><table><thead><tr>${header.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
      continue;
    }
    const firstItem = listItem(line);
    if (firstItem) {
      const tag = firstItem[2] ? 'ol' : 'ul', items = [];
      while (i < lines.length) {
        const item = listItem(lines[i]);
        if (!item || Boolean(item[2]) !== Boolean(firstItem[2])) break;
        const parts = [item[3]]; i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) parts.push(lines[i++].trim());
        items.push(`<li>${inline(parts.join(' '))}</li>`);
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,6}\s|```|\|)/.test(lines[i]) && !listItem(lines[i])) paragraph.push(lines[i++].trim());
    if (!paragraph.length) throw new Error(`Syntaxe Markdown non prise en charge : ${lines[i]}`);
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}
function generated(readmes) {
  const contents = { fr: render(readmes.fr), en: render(readmes.en) };
  return `/* Copyright (C) 2026 Antoine Genitrini. SPDX-License-Identifier: GPL-3.0-only */\n/* Généré depuis les README par scripts/update-help.js. */\n'use strict';\nconst ReadmeHelp = ${JSON.stringify(contents)};\n`;
}
if (require.main === module) {
  const readmes = {
    fr: fs.readFileSync(path.join(root, 'README.md'), 'utf8'),
    en: fs.readFileSync(path.join(root, 'README.en.md'), 'utf8')
  };
  fs.writeFileSync(path.join(root, 'help-content.js'), generated(readmes));
}
module.exports = { render, generated };
