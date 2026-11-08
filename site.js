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
