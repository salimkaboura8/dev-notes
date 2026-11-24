// dev-notes — progressive enhancement only: every page works without this file.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- theme toggle (persisted; falls back to the OS setting)
  const toggle = $('.theme-toggle');
  toggle?.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; };
    document.startViewTransition && !reduced ? document.startViewTransition(apply) : apply();
    try { localStorage.setItem('theme', next); } catch {}
  });

  // ---- typed subtitle
  const typed = $('[data-typed]');
  if (typed) {
    const text = typed.dataset.typed;
    if (reduced) typed.textContent = text;
    else {
      typed.classList.add('typing');
      let i = 0;
      const tick = () => {
        typed.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(tick, 28 + Math.random() * 40);
      };
      setTimeout(tick, 650);
    }
  }

  // ---- home: search + tag filter, state kept in the URL hash
  const grid = $('#grid');
  if (grid) {
    const q = $('#q');
    const cards = $$('.card', grid);
    const chips = $$('.chip');
    const empty = $('#empty');
    let tag = '';

    const readHash = () => {
      const h = new URLSearchParams(location.hash.slice(1));
      tag = h.get('tag') || '';
      q.value = h.get('q') || '';
    };
    const writeHash = () => {
      const h = new URLSearchParams();
      if (tag) h.set('tag', tag);
      if (q.value.trim()) h.set('q', q.value.trim());
      const s = h.toString();
      history.replaceState(null, '', s ? '#' + s : location.pathname);
    };
    const apply = () => {
      const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let shown = 0;
      cards.forEach((c) => {
        const ok = (!tag || c.dataset.tags.split(' ').includes(tag)) && words.every((w) => c.dataset.text.includes(w));
        c.classList.toggle('hide', !ok);
        if (ok) c.style.setProperty('--i', shown++);
      });
      chips.forEach((ch) => ch.classList.toggle('active', ch.dataset.tag === tag));
      empty.hidden = shown > 0;
    };
    const update = () => {
      const run = () => { apply(); writeHash(); };
      document.startViewTransition && !reduced ? document.startViewTransition(run) : run();
    };

    chips.forEach((ch) => ch.addEventListener('click', () => { tag = ch.dataset.tag === tag ? '' : ch.dataset.tag; update(); }));
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { apply(); writeHash(); }, 80); });
    addEventListener('hashchange', () => { readHash(); apply(); });
    addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); }
      if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; apply(); writeHash(); q.blur(); }
    });
    readHash();
    apply();

    // spotlight follows the pointer
    grid.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }

  // ---- note page: reading progress, active step, copy buttons
  const bar = $('.progress');
  if (bar) {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 1);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const steps = $$('.steps a');
  if (steps.length && 'IntersectionObserver' in window) {
    const heads = steps.map((a) => document.getElementById(a.dataset.step)).filter(Boolean);
    const setActive = (id) => {
      let passed = true;
      steps.forEach((a) => {
        const on = a.dataset.step === id;
        a.classList.toggle('active', on);
        a.classList.toggle('done', passed && !on);
        if (on) passed = false;
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -60% 0px' },
    );
    heads.forEach((h) => io.observe(h));
    setActive(heads[0]?.id);
  }

  $$('.prose pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'copy';
    btn.addEventListener('click', async () => {
      const text = pre.querySelector('code')?.innerText ?? pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      btn.textContent = 'copied ✓';
      btn.classList.add('ok');
      setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('ok'); }, 1600);
    });
    pre.append(btn);
  });
})();
