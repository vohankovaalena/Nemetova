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
