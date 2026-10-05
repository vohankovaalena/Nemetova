/* ===========================
   CONFIG
   ===========================
   Web3Forms public access key. Public-by-design identifier — it only permits
   delivery to the inbox configured at web3forms.com, so hardcoding it here is
   fine for this build-less static site.
   TODO: založit zdarma účet na https://web3forms.com s e-mailem info@nemetova.cz
   a nahradit YOUR_WEB3FORMS_ACCESS_KEY skutečným přístupovým klíčem.
*/
const CONFIG = {
  WEB3FORMS_ACCESS_KEY: 'YOUR_WEB3FORMS_ACCESS_KEY',
  WEB3FORMS_ENDPOINT: 'https://api.web3forms.com/submit',
  NAVBAR_SHADOW_THRESHOLD: 40,
};

/* ===========================
   FOCUS HELPERS
   ===========================
   Overlay (mobilní menu, chat) musí držet fokus uvnitř, dokud je otevřený —
   jinak Tab vypadne do stránky pod ním, kterou uživatel nevidí.
*/
const FOCUSABLE = [
  'a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]',
].map((sel) => `${sel}:not([disabled]):not([tabindex="-1"]):not([aria-hidden="true"])`).join(', ');

function focusablesIn(container) {
  // .hp-field (honeypot) a skrytá pole musí ven — jinak by na ně skočil fokus.
  return Array.from(container.querySelectorAll(FOCUSABLE))
    .filter((el) => el.type !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement));
}

function trapTab(container, e) {
  if (e.key !== 'Tab') return;
  const items = focusablesIn(container);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ===========================
   HEADER — scroll shadow + mobile menu
   =========================== */
(function () {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const navList = document.querySelector('.nav-list');

  if (header) {
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > CONFIG.NAVBAR_SHADOW_THRESHOLD);
    };
    onScroll();
    document.addEventListener('scroll', onScroll, { passive: true });
  }

  if (toggle && navList) {
    const setMenu = (isOpen, returnFocus) => {
      navList.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Zavřít menu' : 'Otevřít menu');
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (isOpen) {
        const first = focusablesIn(navList)[0];
        if (first) first.focus();
      } else if (returnFocus) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', () => {
      setMenu(!navList.classList.contains('is-open'), true);
    });

    navList.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenu(false, false));
    });

    document.addEventListener('click', (e) => {
      if (navList.classList.contains('is-open') && !navList.contains(e.target) && !toggle.contains(e.target)) {
        setMenu(false, false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!navList.classList.contains('is-open')) return;
      if (e.key === 'Escape') setMenu(false, true);
      else trapTab(navList, e);
    });
  }
}());

/* ===========================
   SCROLL REVEAL
   =========================== */
(function () {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    return;
  }

  document.documentElement.classList.add('reveal-ready');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  items.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 90}ms`;
    observer.observe(el);
  });
}());

/* ===========================
   FORM HANDLING (Web3Forms)
   ===========================
   Both the page contact form and the floating chat form post to Web3Forms via
   this shared helper — there is no backend. Each form carries a hidden
   `botcheck` honeypot (rejected server-side if filled).
*/
async function sendViaWeb3Forms(form) {
  const formData = new FormData(form);
  formData.append('access_key', CONFIG.WEB3FORMS_ACCESS_KEY);

  const response = await fetch(CONFIG.WEB3FORMS_ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });
  return response.ok;
}

function wireForm(form, status) {
  if (!form || !status) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    status.textContent = '';
    status.classList.remove('form-status--error');
    submitBtn.textContent = 'Odesílám…';
    submitBtn.disabled = true;

    try {
      if (!(await sendViaWeb3Forms(form))) throw new Error('Web3Forms error');
      // Formulář se schová, ale hlášení zůstane v DOM a dostane fokus —
      // jinak fokus spadne na <body> a odečítač neoznámí, co se stalo.
      form.hidden = true;
      status.textContent = 'Děkuji za zprávu! Ozvu se vám co nejdříve.';
      status.focus();
    } catch (err) {
      status.classList.add('form-status--error');
      status.textContent = 'Zprávu se nepodařilo odeslat. Zkuste to prosím znovu nebo napište na info@nemetova.cz.';
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      status.focus();
    }
  });
}

wireForm(document.getElementById('contactForm'), document.getElementById('contactFormStatus'));
wireForm(document.getElementById('chatForm'), document.getElementById('chatFormStatus'));

/* ===========================
   FLOATING CHAT WIDGET
   =========================== */
(function () {
  const widget = document.getElementById('chatWidget');
  const fab = document.getElementById('chatFab');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatPanelClose');

  if (!widget || !fab || !panel) return;

  function openChat() {
    widget.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
    // Panel je do teď visibility:hidden, fokus musí počkat na dokreslení.
    // Cílem je první pole formuláře, ne zavírací křížek.
    requestAnimationFrame(() => {
      const items = focusablesIn(panel);
      const target = items.find((el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) || items[0];
      if (target) target.focus();
    });
  }

  function closeChat(returnFocus = true) {
    widget.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
    if (returnFocus) fab.focus();
  }

  fab.addEventListener('click', () => {
    widget.classList.contains('is-open') ? closeChat() : openChat();
  });

  if (closeBtn) closeBtn.addEventListener('click', () => closeChat());

  document.addEventListener('keydown', (e) => {
    if (!widget.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeChat();
    else trapTab(panel, e);
  });
}());

/* ===========================
   CERTIFICATE CAROUSEL (O mně)
   ===========================
   Nekonečný posun: track je zdvojený (kopie je aria-hidden), takže smyčka
   navazuje bez skoku. Posun řídí requestAnimationFrame. Zastaví se při najetí
   myší, fokusu, tažení nebo při otevřeném lightboxu; lze ho pozastavit
   tlačítkem a při "omezit pohyb" nejede sám. Šipky posunou o jednu kartu.
   Klik na certifikát otevře lightbox.
*/
(function () {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const track = root.querySelector('[data-track]');
  const group = track.querySelector('[data-group]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  const toggle = root.querySelector('[data-toggle]');
  const SPEED = 28;        // px za sekundu
  const NUDGE_MS = 450;    // délka posunu šipkou
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const copy = group.cloneNode(true);
  copy.setAttribute('aria-hidden', 'true');
  copy.querySelectorAll('img').forEach((img) => { img.alt = ''; });
  copy.querySelectorAll('button').forEach((btn) => { btn.tabIndex = -1; });
  track.appendChild(copy);

  let loopDistance = 0;
  let offset = 0;          // neomezený; zobrazuje se modulo délka smyčky
  let tween = null;
  let last = 0;
  let userPaused = reduceMotion.matches;
  let holding = false;     // kurzor nebo fokus uvnitř
  let dragging = false;
  let lightboxOpen = false;

  const cardStep = () => {
    const card = group.querySelector('.cert-carousel__card');
    return card.getBoundingClientRect().width + parseFloat(getComputedStyle(group).columnGap);
  };

  function draw() {
    const x = loopDistance ? ((offset % loopDistance) + loopDistance) % loopDistance : 0;
    track.style.transform = `translate3d(${-x}px, 0, 0)`;
  }

  function recalc() {
    loopDistance = group.getBoundingClientRect().width;
    draw();
  }

  function nudge(direction) {
    const step = cardStep();
    if (!step) return;
    const base = tween ? tween.to : offset;
    tween = { from: offset, to: (Math.round(base / step) + direction) * step, start: null };
  }

  function frame(ts) {
    const dt = last ? (ts - last) / 1000 : 0;
    last = ts;
    if (tween) {
      if (tween.start === null) tween.start = ts;
      const t = Math.min(1, (ts - tween.start) / NUDGE_MS);
      offset = tween.from + (tween.to - tween.from) * (1 - Math.pow(1 - t, 3));
      if (t >= 1) tween = null;
      draw();
    } else if (!userPaused && !holding && !dragging && !lightboxOpen && !reduceMotion.matches) {
      offset += SPEED * dt;
      draw();
    }
    requestAnimationFrame(frame);
  }

  function renderToggle() {
    toggle.setAttribute('aria-label', userPaused ? 'Spustit posun' : 'Pozastavit posun');
    toggle.firstElementChild.textContent = userPaused ? '▶' : '❚❚';
  }

  prev.addEventListener('click', () => nudge(-1));
  next.addEventListener('click', () => nudge(1));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    renderToggle();
  });

  root.addEventListener('pointerenter', () => { holding = true; });
  root.addEventListener('pointerleave', () => { holding = false; });
  root.addEventListener('focusin', () => { holding = true; });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) holding = false;
  });

  // Tažení prstem na mobilu; vertikální gesto nechá stránce.
  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let horizontal = false;
  track.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startOffset = offset;
    horizontal = false;
    dragging = true;
    tween = null;
  }, { passive: true });
  track.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!horizontal) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) { dragging = false; return; }
      horizontal = true;
    }
    offset = startOffset - dx;
    draw();
  }, { passive: true });
  const endDrag = () => { dragging = false; };
  track.addEventListener('touchend', endDrag);
  track.addEventListener('touchcancel', endDrag);

  window.addEventListener('resize', recalc);
  window.addEventListener('load', recalc);

  /* ---------- Lightbox ---------- */
  const lightbox = document.querySelector('[data-lightbox]');
  const lbImg = lightbox.querySelector('[data-lightbox-img]');
  const lbClose = lightbox.querySelector('[data-lightbox-close]');
  const lbPrev = lightbox.querySelector('[data-lightbox-prev]');
  const lbNext = lightbox.querySelector('[data-lightbox-next]');
  const originals = Array.from(group.querySelectorAll('.cert-carousel__card img'));
  let current = 0;
  let returnFocus = null;

  function showLightbox(i) {
    current = (i + originals.length) % originals.length;
    lbImg.src = originals[current].getAttribute('src');
    lbImg.alt = originals[current].alt;
  }

  function openLightbox(i) {
    returnFocus = document.activeElement;
    showLightbox(i);
    lightbox.hidden = false;
    lightboxOpen = true;
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxOpen = false;
    document.body.style.overflow = '';
    if (returnFocus) returnFocus.focus();
  }

  track.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    if (!btn || btn.closest('[aria-hidden="true"]')) return;
    openLightbox(Number(btn.closest('[data-index]').dataset.index));
  });

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', () => showLightbox(current - 1));
  lbNext.addEventListener('click', () => showLightbox(current + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (!lightboxOpen) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') showLightbox(current - 1);
    else if (e.key === 'ArrowRight') showLightbox(current + 1);
    else trapTab(lightbox, e);
  });

  recalc();
  renderToggle();
  requestAnimationFrame(frame);
}());
