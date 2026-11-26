/* Page-level motion: stepped scroll reveals, pixel-dissolve page transitions, copy email. */
(function(){
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reveal on scroll
  const rv = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) rv.forEach(e => e.classList.add('in'));
  else {
    const revealer = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting){ e.target.classList.add('in'); revealer.unobserve(e.target); }
    }), { rootMargin:'0px 0px -8% 0px' });
    rv.forEach((e, i) => { e.style.transitionDelay = (i % 4) * 70 + 'ms'; revealer.observe(e); });
  }

  // pixel dissolve between pages
  const wipe = document.createElement('div');
  wipe.className = 'wipe'; wipe.setAttribute('aria-hidden', 'true');
  const cols = 16, rows = 10;
  wipe.style.gridTemplate = `repeat(${rows},1fr)/repeat(${cols},1fr)`;
  const cells = [];
  for (let i = 0; i < cols * rows; i++){ const c = document.createElement('i'); cells.push(c); wipe.appendChild(c); }
  const shuffle = () => cells.forEach(c => c.style.transitionDelay = Math.floor(Math.random() * 8) * 45 + 'ms');
  document.body.appendChild(wipe);
  function reveal(){
    if (reduce){ wipe.classList.add('out'); return; }
    shuffle(); wipe.classList.remove('cover');
    requestAnimationFrame(() => requestAnimationFrame(() => wipe.classList.add('out')));
  }
  reveal();
  window.addEventListener('pageshow', e => { if (e.persisted){ wipe.classList.remove('cover'); wipe.classList.add('out'); } });

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || reduce || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || /^https?:/.test(href)) return;
    e.preventDefault();
    shuffle(); wipe.classList.remove('out'); wipe.classList.add('cover');
    setTimeout(() => { location.href = a.href; }, 420);
  });

  // interactive avatar: eyes follow the cursor, wave on hover, jump + talk on click
  const avw = document.getElementById('avwrap');
  if (avw){
    const card = avw.closest('.avatar-card'), bubble = document.getElementById('bubble'), fx = document.getElementById('fx'), xpEl = document.getElementById('xp');
    let lastDx = 0, raf = 0, mx = 0;
    window.addEventListener('pointermove', e => {
      mx = e.clientX; if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = avw.getBoundingClientRect(), cx = r.left + r.width / 2;
        const dx = mx < cx - 40 ? -1 : mx > cx + 40 ? 1 : 0;
        if (dx !== lastDx){ lastDx = dx; avw.querySelectorAll('.pupil').forEach(p => p.setAttribute('transform', `translate(${dx} 0)`)); }
      });
    }, { passive:true });

    // typewriter speech bubble
    let typeT = null;
    function say(t){
      clearInterval(typeT);
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      if (reduce){ bubble.textContent = t; return; }
      let i = 0; bubble.textContent = '';
      const cur = document.createElement('span'); cur.className = 'cur';
      const node = document.createTextNode(''); bubble.append(node, cur);
      typeT = setInterval(() => {
        node.data = t.slice(0, ++i);
        if (i >= t.length){ clearInterval(typeT); setTimeout(() => cur.remove(), 900); }
      }, 28);
    }
    const LINES = ['Press START up top!', 'Try Tetris on the console!', 'Hire me? I bring snacks.', 'Research first, pixels second.',
      'My Snake high score is a secret.', 'Level 4 is locked… for now.', 'Okay, okay, that tickles!', 'Achievement unlocked: curiosity.',
      'I design for humans. And cats.', 'You found the easter egg. Kind of.'];
    let xp = 0, li = 0, greeted = false;
    avw.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !greeted){ greeted = true; say('Oh hey there!'); } });
    avw.addEventListener('click', () => {
      card.classList.add('played');
      xp += 10; xpEl.textContent = xp;
      say(LINES[li++ % LINES.length]);
      if (window.ASbeep){ window.ASbeep(520, .06, 'square', 900); setTimeout(() => window.ASbeep(1040, .07), 90); }
      if (reduce) return;
      avw.classList.remove('jump'); card.classList.remove('jumping'); void avw.offsetWidth;
      avw.classList.add('jump'); card.classList.add('jumping');
      clearTimeout(avw._t); avw._t = setTimeout(() => { avw.classList.remove('jump'); card.classList.remove('jumping'); }, 640);
      const r = card.getBoundingClientRect(), a = avw.getBoundingClientRect();
      for (let i = 0; i < 4; i++){
        const s = document.createElement('span');
        if (i === 0) s.textContent = '+10 XP'; else s.className = 'heart';
        s.style.left = (a.left - r.left + a.width * (0.25 + Math.random() * 0.5)) + 'px';
        s.style.top = (a.top - r.top + a.height * (0.08 + Math.random() * 0.15)) + 'px';
        s.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
        s.style.animationDelay = i * 80 + 'ms';
        fx.appendChild(s); setTimeout(() => s.remove(), 1400);
      }
    });
    avw.addEventListener('focus', () => avw.classList.add('wave'));
    avw.addEventListener('blur', () => avw.classList.remove('wave'));
    avw.addEventListener('touchstart', () => { avw.classList.add('wave'); clearTimeout(avw._w); avw._w = setTimeout(() => avw.classList.remove('wave'), 1400); }, { passive:true });
  }

  // hide the résumé button until a resume.pdf is actually uploaded
  const cv = document.getElementById('resume');
  if (cv) fetch(cv.getAttribute('href'), { method:'HEAD' }).then(r => { if (!r.ok) cv.remove(); }).catch(() => cv.remove());

  // copy email
  const copy = document.getElementById('copy');
  copy && copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copy.dataset.mail); copy.textContent = 'Copied!'; }
    catch(e){ copy.textContent = copy.dataset.mail; }
    setTimeout(() => copy.textContent = 'Copy email', 1800);
  });
})();
