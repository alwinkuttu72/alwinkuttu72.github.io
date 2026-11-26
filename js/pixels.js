/* Pixel helpers: draws pixel-art grids as crisp SVG, and a 5x7 bitmap font for the console screen. */
(function(){
  const NS = 'http://www.w3.org/2000/svg';

  // Turn a grid of characters into SVG rects (one path per colour, merged runs per row).
  function gridToSVG(svg, grid, pal){
    const h = grid.length, w = grid[0].length;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('xmlns', NS);
    const paths = {};
    grid.forEach((row, y) => {
      let x = 0;
      while (x < w){
        const c = row[x];
        if (c === '.' || !pal[c]) { x++; continue; }
        let x2 = x; while (x2 < w && row[x2] === c) x2++;
        (paths[c] = paths[c] || []).push(`M${x} ${y}h${x2 - x}v1H${x}z`);
        x = x2;
      }
    });
    svg.innerHTML = Object.entries(paths).map(([c, d]) =>
      `<path class="${c === 'E' ? 'pupil' : ''}" fill="${pal[c]}" d="${d.join('')}"/>`).join('');
  }
  const INK = {'#':'#141210','o':'#ffffff'};

  function drawAll(root){
    (root || document).querySelectorAll('svg[data-art]').forEach(svg => {
      const g = window.ART[svg.dataset.art]; if (g) gridToSVG(svg, g, INK);
    });
    [['#avatar','avatar'],['#avatarWave','avatarWave']].forEach(([sel, key]) => {
      const av = (root || document).querySelector(sel);
      if (!av || !window.ART[key]) return;
      gridToSVG(av, window.ART[key], window.AVATAR_PAL);
      // eyelids for blinking (cover the 3x2 eyes)
      const S = window.AVATAR_PAL.S, k = window.AVATAR_PAL.k;
      av.insertAdjacentHTML('beforeend', `<g class="lid"><rect x="14" y="19" width="3" height="2" fill="${S}"/><rect x="24" y="19" width="3" height="2" fill="${S}"/><rect x="14" y="20" width="3" height="1" fill="${k}"/><rect x="24" y="20" width="3" height="1" fill="${k}"/></g>`);
    });
  }

  // ---------- 5x7 bitmap font ----------
  const F = {
    A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01110100011000010000100001000101110',
    D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',
    G:'01110100011000010111100011000101111',H:'10001100011000111111100011000110001',I:'01110001000010000100001000010001110',
    J:'00111000100001000010000101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',
    M:'10001110111010110101100011000110001',N:'10001100011100110101100111000110001',O:'01110100011000110001100011000101110',
    P:'11110100011000111110100001000010000',Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',
    S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110',
    V:'10001100011000110001100010101000100',W:'10001100011000110101101011010101010',X:'10001100010101000100010101000110001',
    Y:'10001100010101000100001000010000100',Z:'11111000010001000100010001000011111',
    '0':'01110100011001110101110011000101110','1':'00100011000010000100001000010001110','2':'01110100010000100010001000100011111',
    '3':'11111000100010000010000011000101110','4':'00010001100101010010111110001000010','5':'11111100001111000001000011000101110',
    '6':'00110010001000011110100011000101110','7':'11111000010001000100010000100001000','8':'01110100011000101110100011000101110',
    '9':'01110100011000101111000010001001100',
    ':':'00000011000110000000011000110000000','.':'00000000000000000000000000110001100','!':'00100001000010000100001000000000100',
    '?':'01110100010000100010001000000000100','-':'00000000000000011111000000000000000','>':'01000001000001000001000100010001000',
    '<':'00010001000100010000010000010000010','/':'00001000100001000100010000100010000',',':'00000000000000000000011000010001000',
    "'":'01100001000100000000000000000000000','@':'01110100011011110101101111000001111','(':'00010001000100001000010000010000010',
    ')':'01000001000001000010000100010001000','+':'00000001000010011111001000010000000','=':'00000000001111100000111110000000000',
    '*':'00000010101111111111011100010000000',' ':'00000000000000000000000000000000000'
  };
  function text(ctx, str, x, y, color, scale){
    scale = scale || 1; ctx.fillStyle = color;
    str = String(str).toUpperCase();
    for (let i = 0; i < str.length; i++){
      const g = F[str[i]] || F['?'];
      for (let p = 0; p < 35; p++) if (g[p] === '1')
        ctx.fillRect(x + (p % 5) * scale, y + Math.floor(p / 5) * scale, scale, scale);
      x += 6 * scale;
    }
  }
  const width = (str, scale) => (String(str).length * 6 - 1) * (scale || 1);
  function center(ctx, str, y, color, scale, W){
    text(ctx, str, Math.round(((W || 160) - width(str, scale)) / 2), y, color, scale);
  }

  window.PX = { drawAll, gridToSVG, text, center, width };
  drawAll();
})();
