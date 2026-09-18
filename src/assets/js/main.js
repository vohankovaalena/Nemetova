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
    toggle.addEventListener('click', () => {
      const isOpen = navList.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navList.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navList.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
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

function wireForm(form, successMarkup) {
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.textContent = 'Odesílám…';
    submitBtn.disabled = true;

    try {
      if (await sendViaWeb3Forms(form)) {
        form.innerHTML = successMarkup;
      } else {
        throw new Error('Web3Forms error');
      }
    } catch (err) {
      alert('Zprávu se nepodařilo odeslat. Zkuste to prosím znovu nebo napište na info@nemetova.cz.');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

wireForm(
  document.getElementById('contactForm'),
  '<div class="form-success">Děkuji za zprávu! Ozvu se vám co nejdříve.</div>'
);
wireForm(
  document.getElementById('chatForm'),
  '<div class="form-success">Děkuji za zprávu! Ozvu se vám co nejdříve.</div>'
);

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
    panel.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');
    const first = panel.querySelector('input, textarea, button');
    if (first) first.focus();
  }

  function closeChat() {
    widget.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', () => {
    widget.classList.contains('is-open') ? closeChat() : openChat();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeChat);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && widget.classList.contains('is-open')) closeChat();
  });
}());
