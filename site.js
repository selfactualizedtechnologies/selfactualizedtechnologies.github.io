/* Self Actualized Technologies: small project behaviour (the engine files stay unchanged). */
(() => {
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('[data-k-hero]');
  if (!header || !hero) return;
  const update = () => header.classList.toggle('solid', hero.getBoundingClientRect().bottom < 80);
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
})();

/* Stable hero height on phones. The engine sizes the hero as span x 100vh; when a phone browser's
   toolbar shows or hides, the viewport height changes and every section below the hero would jump by
   span x that change (about 1000 px on an iPhone). Lock the height in pixels to the LARGE viewport,
   measured once, and only re-measure when the width changes (rotation). */
(() => {
  const hero = document.querySelector('[data-k-hero]');
  if (!hero) return;
  const span = Number(hero.dataset.kSpan || 3);
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const measure = () => Math.max(probe.offsetHeight || 0, window.innerHeight);
  let width = window.innerWidth, H = measure();
  const apply = () => {
    if (hero.classList.contains('k-static')) return;            // reduced motion: the engine's own layout
    const px = Math.round(span * H) + 'px';
    if (hero.style.height !== px) hero.style.height = px;
  };
  new MutationObserver(apply).observe(hero, { attributes: true, attributeFilter: ['style', 'class'] });
  // the interlude photo section is 86% of the screen tall: lock it the same way (small viewport)
  const inter = document.querySelector('.interlude');
  let small = window.innerHeight;
  const applyInter = () => { if (inter) inter.style.height = Math.round(Math.min(0.86 * small, 900)) + 'px'; };
  addEventListener('resize', () => {
    if (window.innerWidth !== width) { width = window.innerWidth; H = measure(); small = window.innerHeight; apply(); applyInter(); }
  }, { passive: true });
  apply(); applyInter();
})();

/* Photo Studio bar: closing it hides it for good on this browser. */
(() => {
  const close = document.querySelector('.promo-close');
  if (!close) return;
  close.addEventListener('click', () => {
    document.documentElement.classList.add('promo-off');
    if (document.activeElement === close) document.querySelector('.brand')?.focus();
    try { localStorage.setItem('sat-promo', 'closed'); } catch (e) {}
  });
})();

/* Still-photo fallback. If the film fails, or finishes downloading but the phone won't show it
   (Low Power Mode can do this), the hero becomes the engine's static layout: the poster with every
   caption stacked over it, one screen tall, instead of twelve screens of a frozen picture. */
(() => {
  const hero = document.querySelector('[data-k-hero]');
  if (!hero) return;
  const ring = hero.querySelector('.k-ring');
  let still = false, timer = null;
  const fallBack = () => {
    if (hero.classList.contains('k-media-ready') && !hero.classList.contains('k-media-failed')) return;
    still = true; clearTimeout(timer);
    hero.classList.add('k-static', 'k-still');
    hero.style.height = '';
    if (ring) ring.hidden = true;
  };
  new MutationObserver(() => {
    const c = hero.classList;
    if (c.contains('k-media-failed') && !still) fallBack();
    else if (c.contains('k-media-ready')) clearTimeout(timer);
    // the engine re-checks its mode on rotation and would clear the static class: keep the fallback
    if (still && !c.contains('k-static')) { c.add('k-static'); hero.style.height = ''; }
  }).observe(hero, { attributes: true, attributeFilter: ['class'] });
  if (ring) new MutationObserver(() => {
    if (!timer && !still && ring.style.getPropertyValue('--k-load').trim() === '1') timer = setTimeout(fallBack, 6000);
  }).observe(ring, { attributes: true, attributeFilter: ['style'] });
})();
