/* Case study pages: click any image to see it full size. */
(function(){
  const lb = document.getElementById('lb'); if (!lb) return;
  const img = lb.querySelector('img');
  const close = () => { lb.classList.remove('open'); img.src = ''; };
  document.querySelectorAll('figure.f .frame').forEach(f => {
    f.setAttribute('tabindex', '0'); f.setAttribute('role', 'button');
    const open = () => { const i = f.querySelector('img'); img.src = i.src; img.alt = i.alt; lb.classList.add('open'); lb.querySelector('button').focus(); };
    f.addEventListener('click', open);
    f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); } });
  });
  lb.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // gallery arrows
  document.querySelectorAll('.galnav button').forEach(b => b.addEventListener('click', () => {
    const g = document.getElementById(b.dataset.g); if (!g) return;
    const w = g.firstElementChild ? g.firstElementChild.getBoundingClientRect().width + 16 : 220;
    g.scrollBy({ left: w * +b.dataset.d, behavior: 'smooth' });
  }));
  document.querySelectorAll('.gal').forEach(g => g.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ e.preventDefault(); g.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * 220, behavior: 'smooth' }); }
  }));
  // label table cells for the stacked phone layout
  document.querySelectorAll('table.stack').forEach(t => {
    const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent);
    t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => td.dataset.l = heads[i] || ''));
  });
})();
