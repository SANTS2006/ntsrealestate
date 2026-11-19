/* NTS Real Estate System — site behaviour: smooth scroll, scroll effects, reveals, tilt, WhatsApp, forms */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const safe = (fn) => { try { return fn(); } catch { return null; } };

  /* ───────── Custom inertia scroll (mouse wheel only; keyboard / scrollbar / touch stay native) ───────── */
  let smoothTo = (y) => scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  if (finePointer && !reduce) {
    let target = scrollY, current = scrollY, raf = 0;
    const max = () => document.documentElement.scrollHeight - innerHeight;
    const tick = () => {
      current += (target - current) * 0.085;
      if (Math.abs(target - current) < 0.4) { current = target; scrollTo(0, current); raf = 0; return; }
      scrollTo(0, current);
      raf = requestAnimationFrame(tick);
    };
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented) return;
      if (e.target.closest('textarea, select, [data-native-scroll], .nav-links')) return;
      e.preventDefault();
      if (!raf) { target = current = scrollY; }
      target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 34 : 1), 0, max());
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: false });
    addEventListener('scroll', () => { if (!raf) target = current = scrollY; }, { passive: true });
    smoothTo = (y) => { target = clamp(y, 0, max()); if (!raf) raf = requestAnimationFrame(tick); };
  }

  // in-page anchors
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const el = $(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    smoothTo(el.getBoundingClientRect().top + scrollY - 90);
  });

  /* ───────── Header + mobile menu ───────── */
  const header = $('.site-header');
  const links = $('#nav-links');
  const toggle = $('#nav-toggle');
  const setMenu = (open) => {
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle?.addEventListener('click', () => setMenu(!links.classList.contains('open')));
  links?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ───────── Split headings into animated words ───────── */
  $$('[data-split]').forEach((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = 'w';
            const s = document.createElement('span'); s.textContent = part; w.append(s);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    $$('.w > span', el).forEach((s, i) => s.style.setProperty('--i', i));
  });

  /* ───────── Reveal on scroll + counters ───────── */
  const countUp = (el) => {
    const end = parseFloat(el.dataset.count), suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = end + suffix; return; }
    const t0 = performance.now(), dur = 1700;
    const step = (t) => {
      const p = clamp((t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(end * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      $$('[data-count]', en.target).forEach(countUp);
      if (en.target.hasAttribute('data-count')) countUp(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, [data-split], [data-count]').forEach((el) => {
    if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay + 'ms');
    io.observe(el);
  });
  // safety net: never leave content hidden if observer misses (e.g. printing)
  addEventListener('beforeprint', () => $$('.reveal, [data-split]').forEach((e) => e.classList.add('in')));

  /* ───────── Card spotlight + 3D tilt ───────── */
  if (finePointer) {
    $$('.card, .face').forEach((c) => c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', e.clientX - r.left + 'px');
      c.style.setProperty('--my', e.clientY - r.top + 'px');
    }));
    if (!reduce) {
      $$('[data-tilt]').forEach((c) => {
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          c.style.transform = `perspective(900px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateZ(8px)`;
        });
        c.addEventListener('pointerleave', () => { c.style.transform = ''; });
      });
      // magnetic buttons
      $$('.btn-primary, .btn-wa, .btn-ghost').forEach((b) => {
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          b.style.setProperty('--bx', (e.clientX - r.left - r.width / 2) * 0.14 + 'px');
          b.style.setProperty('--by', (e.clientY - r.top - r.height / 2) * 0.22 + 'px');
        });
        b.addEventListener('pointerleave', () => { b.style.setProperty('--bx', '0px'); b.style.setProperty('--by', '0px'); });
      });
    }
  }
  // flip cards: tap to flip on touch devices
  $$('.flip').forEach((f) => {
    f.addEventListener('click', () => { if (!finePointer) f.classList.toggle('on'); });
    f.tabIndex = 0;
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.classList.toggle('on'); } });
  });

  /* ───────── Scroll-linked effects (one rAF-coalesced handler) ───────── */
  const toTop = $('#to-top');
  const parallax = $$('[data-parallax]');
  const dash = $('[data-scroll3d]');
  let lastY = scrollY, ticking = false, mx = 0, my = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; if (dash) onScroll(); }, { passive: true });

  function frame() {
    ticking = false;
    const y = scrollY;
    header?.classList.toggle('scrolled', y > 30);
    header?.classList.toggle('hide', y > 520 && y > lastY + 2 && !links.classList.contains('open'));
    if (y < lastY - 2) header?.classList.remove('hide');
    lastY = y;
    toTop?.classList.toggle('show', y > 900);

    if (!reduce) parallax.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const k = parseFloat(el.dataset.parallax) || 0.15;
      el.style.transform = `translate3d(0, ${(r.top + r.height / 2 - innerHeight / 2) * -k}px, 0)`;
    });


    if (dash && !reduce) {
      const r = dash.getBoundingClientRect();
      const c = clamp((r.top + r.height / 2 - innerHeight / 2) / (innerHeight / 2), -1, 1);
      dash.style.setProperty('--rx', 6 + Math.max(c, 0) * 26 + Math.min(c, 0) * 10 - my * 6 + 'deg');
      dash.style.setProperty('--ry', -4 + c * -16 + mx * 10 + 'deg');
      dash.style.setProperty('--rz', c * 2 + 'deg');
    }
    window.__scrollFx?.(y);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  toTop?.addEventListener('click', () => smoothTo(0));

  /* ───────── Feature filter tabs ───────── */
  const tabs = $$('.tab[data-filter]');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => { x.classList.toggle('on', x === t); x.setAttribute('aria-pressed', String(x === t)); });
    const f = t.dataset.filter;
    $$('.fcard').forEach((c, i) => {
      const show = f === 'all' || c.dataset.cat === f;
      c.classList.toggle('off', !show);
      if (show) { c.style.opacity = 0; c.style.transform = 'translateY(18px)'; setTimeout(() => { c.style.opacity = ''; c.style.transform = ''; }, 30 + i * 18); }
    });
  }));

  /* ───────── Pillar explorer: tabs + autoplay (pauses on hover/focus, off-screen and after a manual pick) ───────── */
  $$('[data-pillars]').forEach((root) => {
    const tabs = $$('.pillar-tab', root), panels = $$('.pillar-panel', root);
    let current = 0;
    const show = (n, focus) => {
      current = (n + tabs.length) % tabs.length;
      tabs.forEach((t, i) => { const on = i === current; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      panels.forEach((p, i) => { const on = i === current; p.classList.toggle('on', on); on ? p.removeAttribute('aria-hidden') : p.setAttribute('aria-hidden', 'true'); });
      if (focus) tabs[current].focus();
      const t = tabs[current];
      if (innerWidth <= 900) t.parentElement.scrollTo({ left: t.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
    };
    const stopAuto = () => root.classList.remove('autoplay', 'paused');
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { stopAuto(); show(i); });
      t.addEventListener('keydown', (e) => {
        const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); stopAuto(); show(current + k, true); }
      });
      t.addEventListener('animationend', (e) => { if (e.pseudoElement === '::after' && root.classList.contains('autoplay')) show(current + 1); });
    });
    if (reduce) return;
    root.classList.add('autoplay', 'paused');
    new IntersectionObserver(([e]) => root.classList.toggle('paused', !e.isIntersecting), { threshold: 0.35 }).observe(root);
    const wrap = $('.pillars-wrap', root);
    wrap.addEventListener('pointerenter', () => root.classList.add('paused'));
    wrap.addEventListener('pointerleave', () => { if (root.classList.contains('autoplay')) root.classList.remove('paused'); });
  });

  /* ───────── Contact + demo forms → platform administrators (API) ───────── */
  $$('form[data-api-form]').forEach((form) => {
    const status = $('[data-status]', form);
    const panel = form.parentElement.querySelector('.form-success');
    const btn = $('button[type="submit"]', form);
    const say = (msg, bad) => { if (!status) return; status.textContent = msg; status.style.color = bad ? '#ff8a8a' : ''; };
    const fail = (name, msg) => { const el = form.elements[name]; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } say(msg, true); };

    form.addEventListener('input', (e) => e.target.removeAttribute?.('aria-invalid'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      const d = Object.fromEntries(new FormData(form));
      const clean = (v) => (typeof v === 'string' ? v.trim() : '');
      if (!clean(d.name)) return fail('name', 'Please enter your name.');
      if (form.dataset.kind === 'demo' && !clean(d.company)) return fail('company', 'Please enter your company.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(d.email))) return fail('email', 'Please enter a valid email address.');
      if (form.dataset.kind === 'demo' && !clean(d.phone)) return fail('phone', 'Please enter a phone or WhatsApp number.');
      if (form.dataset.kind === 'contact' && clean(d.message).length < 10) return fail('message', 'Please write a short message (at least 10 characters).');

      const payload = { kind: form.dataset.kind, source: location.pathname };
      for (const k of ['name', 'email', 'phone', 'company', 'interest', 'portfolioSize', 'message', 'website']) if (clean(d[k])) payload[k] = clean(d[k]);

      btn.disabled = true; const label = btn.innerHTML; btn.textContent = 'Sending…'; say('Sending…');
      try {
        const res = await fetch('/api/v1/public/platform-inquiries', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.details?.[0]?.message || json?.error?.message || json?.message || 'Something went wrong. Please try again, or message us on WhatsApp.');
        form.hidden = true;
        if (panel) { panel.hidden = false; panel.focus(); panel.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
      } catch (err) {
        say(err.message || 'Could not send your message. Please try again, or message us on WhatsApp.', true);
        btn.disabled = false; btn.innerHTML = label;
      }
    });
  });

  /* ───────── Hidden shortcut: click empty navbar space 5 times → platform admin sign-in ───────── */
  if (header) {
    let taps = 0, timer = 0;
    header.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, select, textarea')) { taps = 0; return; } // only blank space counts
      taps += 1; clearTimeout(timer);
      timer = setTimeout(() => { taps = 0; }, 2500); // five clicks in a quick burst
      if (taps >= 5) { taps = 0; location.assign('/platform-admin/login'); }
    });
  }
})();
