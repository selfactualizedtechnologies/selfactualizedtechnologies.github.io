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

/* Phone film mirror. iPhone Safari puts a new video frame on screen as soon as it is decoded, while the
   words riding the iPad (filmtype) move on the page's next rendering pass, so on phones they trailed the
   film by one refresh and looked bouncy. Here the phone film is copied onto a canvas over the video in the
   same callbacks where filmtype moves the words, so each frame and its words reach the screen together.
   Phone (portrait) clip only: the desktop film is untouched. */
(() => {
  const hero = document.querySelector('[data-k-hero]');
  const video = hero && hero.querySelector('video[data-k-scrub]');
  if (!video || !('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return;
  let canvas = null, ctx = null;
  const draw = () => {
    if (!ctx || video.readyState < 2) return;
    try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch (e) {}
  };
  const onFrame = () => { draw(); video.requestVideoFrameCallback(onFrame); };
  const start = () => {
    if (canvas || !(video.videoWidth > 0 && video.videoWidth < video.videoHeight)) return;
    canvas = document.createElement('canvas');
    canvas.className = 'k-media sat-mirror';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { canvas = null; return; }
    video.after(canvas);
    draw();
    hero.classList.add('sat-mirror-on');
    video.requestVideoFrameCallback(onFrame);
  };
  video.addEventListener('seeked', draw);
  video.addEventListener('loadeddata', start);
  if (video.readyState >= 2) start();
  // after a source swap (below) the frame callbacks may have been dropped: arm them again
  hero.addEventListener('sat-film-swapped', () => { if (ctx) { draw(); video.requestVideoFrameCallback(onFrame); } });
})();

/* Phone film: start light, finish sharp. The engine downloads the whole film before it can move, and on a
   first visit the full phone film (5.2 MB) left the hero frozen on the poster for seconds. The engine now
   loads a light copy (hero-m-lite.mp4, 1.1 MB: the same 388 frames, size and timing, encoded smaller), so
   the film moves almost at once. Then the full-quality film downloads in the background and replaces it
   in place, at the same frame, between two seeks (never during one, or the engine would wait forever for
   a "seeked" that the source change cancels). Phones only: desktop never has data-src-mobile-full. */
(() => {
  const hero = document.querySelector('[data-k-hero]');
  const video = hero && hero.querySelector('video[data-k-scrub]');
  const full = video && video.dataset.srcMobileFull;
  if (!full) return;
  let state = 'wait', url = null, idle = null;
  const phoneClip = () => video.videoWidth > 0 && video.videoWidth < video.videoHeight;
  // point the film at a new source; once its first frame is decoded, seek to frame t. That seek always ends
  // in a "seeked", which also frees the engine if one of its own seeks was cut off by the source change.
  const load = (src, t, then) => {
    const on = () => {
      clearTimeout(guard);
      video.currentTime = t;
      hero.dispatchEvent(new Event('sat-film-swapped'));
      if (typeof hero._kick === 'function') hero._kick();   // the engine seeks on to the visitor's frame
      then(true);
    };
    const guard = setTimeout(() => { video.removeEventListener('loadeddata', on); then(false); }, 5000);
    video.addEventListener('loadeddata', on, { once: true });
    video.preload = 'auto';
    video.src = src;
    video.load();                                            // as the engine does: iPhone Safari needs it
  };
  const swap = () => {
    if (state !== 'have' || video.seeking) return;
    state = 'done'; clearTimeout(idle);
    const old = video.currentSrc || video.src, t = video.currentTime;
    load(url, t, ok => {
      if (ok) { try { if (old.startsWith('blob:')) URL.revokeObjectURL(old); } catch (e) {} return; }
      // the full film did not show a frame in time: go back to the light film rather than ever freeze
      try { URL.revokeObjectURL(url); } catch (e) {}
      load(old, t, () => {});
    });
  };
  const fetchFull = async () => {
    if (state !== 'wait' || !phoneClip()) return;
    state = 'loading';
    try {
      const res = await fetch(full);
      if (!res.ok) throw new Error('film ' + res.status);
      url = URL.createObjectURL(await res.blob());
      state = 'have';
      // swap right after the engine's next seek settles, or now if the visitor is not scrolling
      idle = setTimeout(swap, 250);
    } catch (e) { state = 'failed'; }  // keep the light film: it still plays every frame
  };
  // site.js runs after the engine, so this handler runs after the engine's own "seeked" handler
  video.addEventListener('seeked', () => { if (state === 'have') { clearTimeout(idle); if (!video.seeking) swap(); else idle = setTimeout(swap, 250); } });
  new MutationObserver(() => { if (hero.classList.contains('k-media-ready')) fetchFull(); })
    .observe(hero, { attributes: true, attributeFilter: ['class'] });
  if (hero.classList.contains('k-media-ready')) fetchFull();
})();
