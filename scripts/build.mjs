// Builds the static site into _site/ and keeps the README index in sync.
//   node scripts/build.mjs           build site + rewrite README index
//   node scripts/build.mjs --check   validate notes, fail if README is stale (CI)
import { readFile, writeFile, readdir, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTES_DIR = path.join(ROOT, 'notes');
const OUT = path.join(ROOT, '_site');
const SITE_SRC = path.join(ROOT, 'site');
const README = path.join(ROOT, 'README.md');
const REPO_URL = 'https://github.com/salimkaboura8/dev-notes';
const SITE_URL = 'https://salimkaboura8.github.io/dev-notes/';
const SECTIONS = ['Problem', 'Why', 'Fix', 'Check'];
const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------- parsing

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const unquote = (v) => v.replace(/^(["'])(.*)\1$/, '$2');

function parseFrontmatter(src, file, errors) {
  const m = src.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    errors.push(`${file}: missing front matter (--- title/summary/tags/date ---)`);
    return { meta: {}, body: src };
  }
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const kv = line.match(/^([a-z]+):\s*(.*)$/);
    if (!kv) { errors.push(`${file}: unreadable front matter line "${line}"`); continue; }
    const [, key, raw] = kv;
    meta[key] = raw.startsWith('[')
      ? raw.replace(/^\[|\]$/g, '').split(',').map((t) => unquote(t.trim())).filter(Boolean)
      : unquote(raw.trim());
  }
  return { meta, body: m[2] };
}

function validate(note, errors) {
  const { file, meta, body } = note;
  for (const key of ['title', 'summary', 'tags', 'date']) {
    if (!meta[key] || (Array.isArray(meta[key]) && !meta[key].length)) errors.push(`${file}: "${key}" is required`);
  }
  if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) errors.push(`${file}: date must be YYYY-MM-DD`);
  if (meta.summary && meta.summary.length > 160) errors.push(`${file}: summary over 160 characters`);
  if (meta.tags && !Array.isArray(meta.tags)) errors.push(`${file}: tags must be a [list]`);
  for (const t of Array.isArray(meta.tags) ? meta.tags : []) {
    if (!/^[a-z0-9-]+$/.test(t)) errors.push(`${file}: tag "${t}" must be lowercase-kebab`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(file)) errors.push(`${file}: file name must be kebab-case .md`);
  const h1 = body.match(/^# (.+)$/m)?.[1]?.trim();
  if (h1 !== meta.title) errors.push(`${file}: first "# heading" must equal the title`);
  const h2 = [...body.matchAll(/^## (.+)$/gm)].map((x) => x[1].trim());
  if (h2.join('|') !== SECTIONS.join('|')) {
    errors.push(`${file}: sections must be exactly ${SECTIONS.map((s) => '## ' + s).join(', ')} (found: ${h2.join(', ') || 'none'})`);
  }
}

async function loadNotes() {
  const errors = [];
  const files = (await readdir(NOTES_DIR)).filter((f) => f.endsWith('.md')).sort();
  const notes = [];
  for (const file of files) {
    const src = await readFile(path.join(NOTES_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(src, file, errors);
    const note = { file, slug: file.replace(/\.md$/, ''), meta, body };
    validate(note, errors);
    notes.push(note);
  }
  const titles = new Map();
  for (const n of notes) {
    if (titles.has(n.meta.title)) errors.push(`${n.file}: same title as ${titles.get(n.meta.title)}`);
    titles.set(n.meta.title, n.file);
  }
  if (errors.length) {
    console.error(`✗ ${errors.length} problem(s) in notes/:\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }
  // Newest first, then alphabetical for a stable order.
  return notes.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || a.meta.title.localeCompare(b.meta.title));
}

// ---------------------------------------------------------------- README

function readmeIndex(notes) {
  const cell = (s) => s.replace(/\|/g, '\\|');
  const rows = notes.map(
    (n) => `| [${cell(n.meta.title)}](notes/${n.file}) | ${cell(n.meta.summary)} | ${n.meta.tags.map((t) => `\`${t}\``).join(' ')} |`,
  );
  return ['| Note | In one line | Tags |', '|---|---|---|', ...rows].join('\n');
}

async function syncReadme(notes) {
  const current = await readFile(README, 'utf8');
  const re = /(<!-- notes:start -->)[\s\S]*?(<!-- notes:end -->)/;
  if (!re.test(current)) {
    console.error('✗ README.md needs <!-- notes:start --> and <!-- notes:end --> markers');
    process.exit(1);
  }
  const count = /(badge\/notes-)\d+(-)/;
  const next = current
    .replace(re, `$1\n${readmeIndex(notes)}\n$2`)
    .replace(count, `$1${notes.length}$2`);
  if (next === current) return;
  if (CHECK) {
    console.error('✗ README.md index is out of date — run `npm run build` and commit');
    process.exit(1);
  }
  await writeFile(README, next);
  console.log('• README index updated');
}

// ---------------------------------------------------------------- site

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
);
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      if (depth === 1) return ''; // the page header shows the title
      const id = text.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const step = SECTIONS.findIndex((s) => s.toLowerCase() === id);
      const badge = step >= 0 ? `<span class="step-no">${step + 1}</span>` : '';
      return `<h${depth} id="${id}" class="section-h${step >= 0 ? ' step-' + id : ''}">${badge}${text}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      // notes/foo.md links → site pages
      const local = href.match(/^(?:\.\.?\/)?(?:notes\/)?([a-z0-9-]+)\.md$/);
      const target = local ? `${local[1]}.html` : href;
      const ext = /^https?:/.test(target) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${esc(target)}"${title ? ` title="${esc(title)}"` : ''}${ext}>${text}</a>`;
    },
  },
});

const fmtDate = (d) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const readingTime = (body) => Math.max(1, Math.round(body.split(/\s+/).length / 200));

function layout({ title, description, body, depth = 0, bodyClass = '' }) {
  const up = depth ? '../' : './';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="theme-color" content="#0b0f14" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f7faf9" media="(prefers-color-scheme: light)">
<link rel="icon" href="${up}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}style.css">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<script src="${up}app.js" defer></script>
</head>
<body class="${bodyClass}">
<div class="aurora" aria-hidden="true"><span></span><span></span><span></span></div>
<header class="topbar">
  <a class="brand" href="${up}index.html"><span class="brand-mark">❯</span> dev-notes</a>
  <nav>
    <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>
    <button class="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle theme">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="sun" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/><path class="moon" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
    </button>
  </nav>
</header>
${body}
<footer class="foot">
  <p>Written while shipping a real app · <a href="${REPO_URL}" target="_blank" rel="noopener">source</a> · MIT</p>
</footer>
</body>
</html>
`;
}

function indexPage(notes) {
  const all = [...new Set(notes.flatMap((n) => n.meta.tags))].sort();
  const counts = Object.fromEntries(all.map((t) => [t, notes.filter((n) => n.meta.tags.includes(t)).length]));
  // Chips only for tags shared by 2+ notes; rarer tags stay searchable by text.
  const tags = all.filter((t) => counts[t] > 1).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  const cards = notes
    .map(
      (n, i) => `
    <a class="card" href="notes/${n.slug}.html" style="--i:${i}" data-tags="${esc(n.meta.tags.join(' '))}"
       data-text="${esc((n.meta.title + ' ' + n.meta.summary + ' ' + n.meta.tags.join(' ')).toLowerCase())}">
      <div class="card-meta"><time datetime="${n.meta.date}">${fmtDate(n.meta.date)}</time><span>${readingTime(n.body)} min</span></div>
      <h2 style="view-transition-name: t-${n.slug}">${esc(n.meta.title)}</h2>
      <p>${esc(n.meta.summary)}</p>
      <ul class="tags">${n.meta.tags.map((t) => `<li>#${esc(t)}</li>`).join('')}</ul>
      <span class="card-arrow" aria-hidden="true">→</span>
    </a>`,
    )
    .join('');

  const body = `
<main class="wrap">
  <section class="hero">
    <p class="eyebrow">field notes · ${notes.length} entries</p>
    <h1 class="hero-title"><span>Things that cost me time once,</span><br><span class="grad">so they won't twice.</span></h1>
    <p class="hero-sub" data-typed="Problem → Why → Fix → Check. Every note, same four steps."></p>
    <div class="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"/></svg>
      <input id="q" type="search" placeholder="Search notes…" autocomplete="off" aria-label="Search notes">
      <kbd>/</kbd>
    </div>
    <div class="chips" role="toolbar" aria-label="Filter by tag">
      <button type="button" class="chip active" data-tag="">all <b>${notes.length}</b></button>
      ${tags.map((t) => `<button type="button" class="chip" data-tag="${esc(t)}">#${esc(t)} <b>${counts[t]}</b></button>`).join('\n      ')}
    </div>
  </section>
  <section class="grid" id="grid" aria-live="polite">${cards}
  </section>
  <p class="empty" id="empty" hidden>No note matches. Try another word or tag.</p>
</main>`;
  return layout({
    title: 'dev-notes — field notes from shipping a real app',
    description: 'Practical Problem → Why → Fix → Check notes on Ionic, Capacitor, Angular, FastAPI, Supabase and deploys.',
    body,
    bodyClass: 'home',
  });
}

function notePage(n, prev, next) {
  const html = marked.parse(n.body);
  const steps = SECTIONS.map(
    (s, i) => `<a href="#${s.toLowerCase()}" data-step="${s.toLowerCase()}"><span>${i + 1}</span>${s}</a>`,
  ).join('');
  const pager = (x, dir) =>
    x
      ? `<a class="pager-${dir}" href="${x.slug}.html"><small>${dir === 'prev' ? '← Newer' : 'Older →'}</small>${esc(x.meta.title)}</a>`
      : '<span></span>';
  const body = `
<div class="progress" aria-hidden="true"><span></span></div>
<main class="wrap note">
  <a class="back" href="../index.html">← All notes</a>
  <header class="note-head">
    <div class="card-meta"><time datetime="${n.meta.date}">${fmtDate(n.meta.date)}</time><span>${readingTime(n.body)} min read</span></div>
    <h1 style="view-transition-name: t-${n.slug}">${esc(n.meta.title)}</h1>
    <p class="lede">${esc(n.meta.summary)}</p>
    <ul class="tags">${n.meta.tags.map((t) => `<li><a href="../index.html#tag=${esc(t)}">#${esc(t)}</a></li>`).join('')}</ul>
  </header>
  <nav class="steps" aria-label="Sections">${steps}</nav>
  <article class="prose">${html}</article>
  <nav class="pager">${pager(prev, 'prev')}${pager(next, 'next')}</nav>
  <p class="edit"><a href="${REPO_URL}/blob/main/notes/${n.file}" target="_blank" rel="noopener">Edit this note on GitHub</a></p>
</main>`;
  return layout({ title: `${n.meta.title} — dev-notes`, description: n.meta.summary, body, depth: 1, bodyClass: 'note-page' });
}

async function buildSite(notes) {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'notes'), { recursive: true });
  await mkdir(path.join(OUT, 'assets'), { recursive: true });
  await writeFile(path.join(OUT, 'index.html'), indexPage(notes));
  for (const [i, n] of notes.entries()) {
    await writeFile(path.join(OUT, 'notes', `${n.slug}.html`), notePage(n, notes[i - 1], notes[i + 1]));
  }
  for (const f of ['style.css', 'app.js']) await copyFile(path.join(SITE_SRC, f), path.join(OUT, f));
  for (const f of await readdir(path.join(ROOT, 'assets'))) {
    await copyFile(path.join(ROOT, 'assets', f), path.join(OUT, 'assets', f));
  }
  await writeFile(
    path.join(OUT, '404.html'),
    layout({
      title: 'Not found — dev-notes',
      description: 'Page not found',
      body: '<main class="wrap"><section class="hero"><h1 class="hero-title"><span class="grad">404</span></h1><p class="hero-sub">This note does not exist (yet). <a href="/dev-notes/">All notes →</a></p></section></main>',
    }).replaceAll('href="./', 'href="/dev-notes/').replaceAll('src="./', 'src="/dev-notes/'),
  );
  const urls = ['', ...notes.map((n) => `notes/${n.slug}.html`)];
  await writeFile(
    path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  await writeFile(path.join(OUT, '.nojekyll'), '');
  console.log(`• site built: ${notes.length} notes → _site/`);
}

// ---------------------------------------------------------------- main

const notes = await loadNotes();
await syncReadme(notes);
if (CHECK) {
  console.log(`✓ ${notes.length} notes valid, README index up to date`);
} else {
  if (!existsSync(SITE_SRC)) throw new Error('site/ folder missing');
  await buildSite(notes);
}
