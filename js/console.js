/* The playable console: boot screen, menu and Snake. Works with the on-screen buttons, keyboard and swipes. */
(function(){
  const cv = document.getElementById('lcd'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = 160, H = 128;
  const C = { bg:'#0d0f0b', ink:'#e8f1d4', dim:'#2c3326', mid:'#6f7b62', red:'#e0336b', leaf:'#9bd35a' };
  const { text, center, width } = window.PX;
  const consoleEl = document.getElementById('console');
  const startBtn = consoleEl.querySelector('.b-start');

  // ---------- sound ----------
  let ac = null, soundOn = true;
  try { soundOn = localStorage.getItem('as-sound') !== 'off'; } catch(e){}
  const soundBtn = document.getElementById('sound');
  function syncSound(){ if (soundBtn){ soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off'; soundBtn.setAttribute('aria-pressed', soundOn); } }
  syncSound();
  soundBtn && soundBtn.addEventListener('click', () => {
    soundOn = !soundOn; syncSound();
    try { localStorage.setItem('as-sound', soundOn ? 'on' : 'off'); } catch(e){}
  });
  function beep(f, d, type, slide){
    if (!soundOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(.045, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02);
    } catch(e){}
  }

  window.ASbeep = (f, d, t, sl) => beep(f, d, t, sl);
  // ---------- state ----------
  let state = 'boot', tick = 0, bootT = 0, menuI = 0, msg = '', msgT = 0;
  const MENU = [
    { label:'ALWIN RUN', act:() => startRun() },
    { label:'PLAY SNAKE', act:() => startSnake() },
    { label:'PLAY TETRIS', act:() => startTetris() },
    { label:'NEON COAST', act:() => rcOpen() }
  ];
  let hi = 0, thi = 0, rhi = 0; try { hi = +localStorage.getItem('as-snake-hi') || 0; thi = +localStorage.getItem('as-tetris-hi') || 0; rhi = +localStorage.getItem('as-run-hi') || 0; } catch(e){}


  // ---------- snake ----------
  const CELL = 8, GX = 20, GY = 14, OY = 16;
  let snake, dir, queue, food, score, stepMs, acc, last, paused, deadT, ready;
  function startSnake(){
    snake = [{x:6,y:7},{x:5,y:7},{x:4,y:7}]; dir = {x:1,y:0}; queue = [];
    score = 0; stepMs = 210; acc = 0; paused = false; ready = 45;
    placeFood(); state = 'snake';
  }
  function placeFood(){
    do { food = { x: Math.floor(Math.random()*GX), y: Math.floor(Math.random()*GY) }; }
    while (snake.some(s => s.x === food.x && s.y === food.y));
  }
  function turn(d){
    const lastDir = queue.length ? queue[queue.length-1] : dir;
    if (d.x === -lastDir.x && d.y === -lastDir.y) return;
    if (d.x === lastDir.x && d.y === lastDir.y) return;
    if (queue.length < 3) queue.push(d);
  }
  function step(){
    if (queue.length) dir = queue.shift();
    // walls wrap around: leave one side, come back on the other
    const h = { x: (snake[0].x + dir.x + GX) % GX, y: (snake[0].y + dir.y + GY) % GY };
    if (snake.some(s => s.x === h.x && s.y === h.y)){
      state = 'over'; deadT = 0; beep(320, .45, 'sawtooth', 60);
      if (score > hi){ hi = score; try { localStorage.setItem('as-snake-hi', hi); } catch(e){} }
      return;
    }
    snake.unshift(h);
    if (h.x === food.x && h.y === food.y){
      score++; stepMs = Math.max(130, stepMs - 2); placeFood(); beep(880, .09, 'square', 1500);
    } else snake.pop();
  }


  // ---------- tetris ----------
  const TC = 6, TW = 10, TH = 20, TX = 50, TY = 4;
  const SHAPES = {
    I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]], T:[[1,0],[0,1],[1,1],[2,1]],
    S:[[1,0],[2,0],[0,1],[1,1]], Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]]
  };
  const TCOL = { I:'#7fd8e8', O:'#f5d90a', T:'#c38cf0', S:'#9bd35a', Z:'#e0336b', J:'#5b8cf0', L:'#ff9a3c' };
  let board, cur, nextP, tScore, tLines, tLevel, tAcc, tPaused, clearing, clearT, bag = [];
  function draw7(){ if (!bag.length) bag = Object.keys(SHAPES).sort(() => Math.random() - .5); return bag.pop(); }
  function piece(k){ return { k, cells: SHAPES[k].map(c => c.slice()), x: 3, y: 0, size: k === 'I' ? 4 : k === 'O' ? 4 : 3 }; }
  function startTetris(){
    board = Array.from({ length: TH }, () => Array(TW).fill(null));
    bag = []; cur = piece(draw7()); nextP = draw7();
    tScore = 0; tLines = 0; tLevel = 1; tAcc = 0; tPaused = false; clearing = null;
    state = 'tetris';
  }
  const fits = (cells, x, y) => cells.every(([cx, cy]) => {
    const X = x + cx, Y = y + cy;
    return X >= 0 && X < TW && Y < TH && (Y < 0 || !board[Y][X]);
  });
  function rotate(dir){
    if (cur.k === 'O') return;
    const n = cur.size - 1;
    const r = cur.cells.map(([x, y]) => dir > 0 ? [n - y, x] : [y, n - x]);
    for (const k of [0, -1, 1, -2, 2]) if (fits(r, cur.x + k, cur.y)) { cur.cells = r; cur.x += k; beep(600, .03); return; }
  }
  function move(dx){ if (fits(cur.cells, cur.x + dx, cur.y)) { cur.x += dx; beep(420, .02); } }
  function lock(){
    let over = false;
    cur.cells.forEach(([cx, cy]) => { const Y = cur.y + cy; if (Y < 0) over = true; else board[Y][cur.x + cx] = cur.k; });
    if (over) return tetrisOver();
    const full = []; board.forEach((row, i) => { if (row.every(Boolean)) full.push(i); });
    if (full.length){ clearing = full; clearT = 0; beep(full.length === 4 ? 1320 : 990, .15, 'square', 1500); }
    else beep(200, .04);
    spawn();
  }
  function spawn(){
    cur = piece(nextP); nextP = draw7();
    if (!fits(cur.cells, cur.x, cur.y)) tetrisOver();
  }
  function tetrisOver(){
    state = 'tover'; deadT = 0; beep(320, .5, 'sawtooth', 50);
    if (tScore > thi){ thi = tScore; try { localStorage.setItem('as-tetris-hi', thi); } catch(e){} }
  }
  function softDrop(){
    if (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; tScore++; } else lock();
    tAcc = 0;
  }
  let trails = [], tShake = 0;
  function hardDrop(){
    const y0 = cur.y, k = cur.k, cells = cur.cells.map(c => c.slice()), x = cur.x;
    while (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; tScore += 2; }
    if (cur.y > y0){ trails.push({ cells, x, y0, y1: cur.y, k, life: 14 }); beep(1100, .14, 'sawtooth', 160); tShake = 4; }
    lock();
  }
  function tetrisTick(dt){
    if (clearing){
      if (++clearT > 14){
        const n = clearing.length;
        clearing.forEach(i => { board.splice(i, 1); board.unshift(Array(TW).fill(null)); });
        tLines += n; tScore += [0, 40, 100, 300, 1200][n] * tLevel; tLevel = Math.floor(tLines / 10) + 1;
        clearing = null;
      }
      return;
    }
    tAcc += dt;
    const g = Math.max(90, 720 - (tLevel - 1) * 65);
    if (tAcc >= g){ tAcc = 0; if (fits(cur.cells, cur.x, cur.y + 1)) cur.y++; else lock(); }
  }
  function cell(x, y, col, s){
    s = s || TC;
    ctx.fillStyle = col; ctx.fillRect(x, y, s - 1, s - 1);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x, y, s - 1, 1); ctx.fillRect(x, y, 1, s - 1);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 1, y + s - 2, s - 2, 1);
  }
  function drawTetris(){
    if (tShake > 0) tShake--;
    ctx.setTransform(1, 0, 0, 1, 0, tShake % 2 ? 1 : 0);   // tiny thud when a piece slams down
    // well
    ctx.fillStyle = '#151912'; ctx.fillRect(TX, TY, TW * TC, TH * TC);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++){ ctx.fillStyle = '#1e241a'; ctx.fillRect(TX + x*TC + 2, TY + y*TC + 2, 1, 1); }
    ctx.fillStyle = C.mid; ctx.fillRect(TX - 2, TY, 1, TH * TC); ctx.fillRect(TX + TW * TC + 1, TY, 1, TH * TC); ctx.fillRect(TX - 2, TY + TH * TC, TW * TC + 4, 1);
    board.forEach((row, y) => row.forEach((k, x) => {
      if (!k) return;
      if (clearing && clearing.includes(y)) { if (Math.floor(clearT / 3) % 2 === 0) cell(TX + x*TC, TY + y*TC, C.ink); }
      else cell(TX + x*TC, TY + y*TC, TCOL[k]);
    }));
    // whoosh streaks left by a slammed piece
    trails.forEach(t => {
      const a = t.life / 14, col = hex(TCOL[t.k]);
      const cols = {}; t.cells.forEach(([cx, cy]) => { const top = Math.min(cols[cx] ?? 99, cy); cols[cx] = top; });
      Object.entries(cols).forEach(([cx, cy]) => {
        const x = TX + (t.x + +cx) * TC, yA = TY + (t.y0 + cy) * TC, yB = TY + (t.y1 + cy) * TC;
        for (let y = yA; y < yB; y++){ const f = (y - yA) / Math.max(1, yB - yA); ctx.fillStyle = `rgba(${col},${(a * f * .55).toFixed(3)})`; ctx.fillRect(x + 1, y, TC - 3, 1); }
      });
      t.life--;
    });
    trails = trails.filter(t => t.life > 0);
    if (state === 'tetris' && !clearing){
      let gy = cur.y; while (fits(cur.cells, cur.x, gy + 1)) gy++;
      ctx.fillStyle = 'rgba(232,241,212,.18)';
      cur.cells.forEach(([cx, cy]) => { if (gy + cy >= 0) ctx.fillRect(TX + (cur.x + cx)*TC, TY + (gy + cy)*TC, TC - 1, TC - 1); });
      cur.cells.forEach(([cx, cy]) => { if (cur.y + cy >= 0) cell(TX + (cur.x + cx)*TC, TY + (cur.y + cy)*TC, TCOL[cur.k]); });
    }
    // side panels
    text(ctx, 'SCORE', 4, 8, C.mid); text(ctx, tScore, 4, 18, C.ink);
    text(ctx, 'LINES', 4, 36, C.mid); text(ctx, tLines, 4, 46, C.ink);
    text(ctx, 'LEVEL', 4, 64, C.mid); text(ctx, tLevel, 4, 74, C.ink);
    text(ctx, 'NEXT', 120, 8, C.mid);
    ctx.fillStyle = '#151912'; ctx.fillRect(118, 18, 30, 22);
    const np = SHAPES[nextP], minx = Math.min(...np.map(c => c[0])), maxx = Math.max(...np.map(c => c[0])), maxy = Math.max(...np.map(c => c[1]));
    const ox = 118 + Math.round((30 - (maxx - minx + 1) * 5) / 2) - minx * 5, oy = 18 + Math.round((22 - (maxy + 1) * 5) / 2);
    np.forEach(([cx, cy]) => cell(ox + cx * 5, oy + cy * 5, TCOL[nextP], 5));
    text(ctx, 'HI', 120, 52, C.mid); text(ctx, Math.max(thi, tScore), 120, 62, C.ink);
    text(ctx, 'A:TURN', 118, 92, C.dim); text(ctx, 'SELECT', 118, 104, C.dim); text(ctx, ':MENU', 118, 113, C.dim);
    if (state === 'tetris' && tPaused){ box(); center(ctx, 'PAUSED', 56, C.ink, 2); center(ctx, 'SELECT FOR MENU', 76, C.mid); }
    if (state === 'tover'){
      deadT++; box();
      center(ctx, 'GAME OVER', 44, C.red, 2);
      center(ctx, 'SCORE ' + tScore + (tScore && tScore >= thi ? ' NEW HI!' : ''), 66, C.ink);
      if (deadT > 20) center(ctx, 'A:RETRY  B:MENU', 82, C.mid);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }


  // ---------- alwin run: a pixel world with parallax, a day cycle and weather ----------
  // One in-game day lasts one real minute. Weather re-rolls at dawn and at noon.
  const ROCKP = { o:'#4f4d3b', a:'#d8d4b4', b:'#aeaa8b', c:'#868369', m:'#8cbc3c', M:'#b4d65a' };
  const ROCKS = [
    ['..mM..','.ommo.','oabbco','obbcco'],
    ['..mMm..','.oMmmo.','.oabbco','oabbbco','obbbcco','obbccco'],
    ['..Mm..','.ommo.','.oabco','oabbco','oabbco','obbcco','obbcco','obccco'],
    ['...mM..','..oMmo.','.oabbco','oabbbco','obbbcco','obbccco','obcccco']
  ];
  const SC = 2, GROUND = 110, WATER = 117, TILE = 320, DAY_MS = 60000;

  // tiny seeded random so the world looks the same every visit
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const dot = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  function shape(g, w, h, inside, colour, outline){
    const m = [];
    for (let y = 0; y < h; y++){ m[y] = []; for (let x = 0; x < w; x++) m[y][x] = inside(x, y); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      if (!m[y][x]) continue;
      const edge = outline && (!m[y-1]?.[x] || !m[y+1]?.[x] || !m[y][x-1] || !m[y][x+1]);
      dot(g, x, y, edge ? outline : colour(x, y));
    }
  }
  const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  // the runner: a hand-drawn head + torso, with jointed limbs drawn every frame
  const CP = { H:'#1f1915', h:'#4b3a2f', S:'#b97c50', s:'#8f5b38', k:'#141210', m:'#7a3e28', W:'#ffffff', w:'#d9d4c9', P:'#3e4454', p:'#2b2f3a', K:'#ffffff', g:'#b9b4aa', r:'#e0336b' };
  const C_HEAD = [
    '...hH.Hh.H...',
    '.HHHHHHHHHh..',
    'HHhHHHHhHHHH.',
    'HHHHHHHHHHHHh',
    'HhHHHHhHHHHHH',
    'HHHHHHHHSSHHH',
    '.HHHHHSSSSSSH',
    '.HHHsSSSkSSkS',
    '..HHsSSSSSSSS',
    '...ssSSSSSSsS',
    '....sSSSSmmS.',
    '......sSSS...'
  ];
  const C_BLINK = C_HEAD.map((r, i) => i === 7 ? '.HHHsSSSsSSsS' : r);
  const C_DEAD = C_HEAD.map((r, i) => i === 7 ? '.HHHsSSkSkSkS' : i === 10 ? '....sSSSSrrS.' : r);
  const [chC, chX] = mk(34, 44), [chS, chSX] = mk(34, 44);
  const COX = 10, COY = 40;   // feet baseline inside the character canvas
  function limb(g, x0, y0, len, ang, w, col, edge){
    const x1 = x0 + Math.sin(ang) * len, y1 = y0 + Math.cos(ang) * len, n = Math.ceil(len * 2);
    for (let i = 0; i <= n; i++){
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t - w / 2), y = Math.round(y0 + (y1 - y0) * t);
      g.fillStyle = col; g.fillRect(x, y, w, 1);
      if (edge){ g.fillStyle = edge; g.fillRect(x - 1, y, 1, 1); }
    }
    return [x1, y1];
  }
  function leg(g, hx, hy, thigh, knee, back){
    const [kx, ky] = limb(g, hx, hy, 5, thigh, 3, back ? CP.p : CP.P);
    const [fx, fy] = limb(g, kx, ky, 4.5, thigh - knee, 3, back ? CP.p : CP.P);
    const x = Math.round(fx - 1), y = Math.round(fy);
    g.fillStyle = back ? '#e6e2da' : CP.K; g.fillRect(x, y, 4, 2); g.fillStyle = CP.g; g.fillRect(x, y + 1, 4, 1);
  }
  function arm(g, sx, sy, upper, bend, back){
    g.fillStyle = back ? CP.w : CP.W; g.fillRect(Math.round(sx - 1), Math.round(sy), 3, 2);
    const edge = back ? null : '#6b4026';
    const [ex, ey] = limb(g, sx, sy + 1, 4, upper, 2, back ? CP.s : CP.S, edge);
    limb(g, ex, ey, 3.5, upper + bend, 2, back ? CP.s : CP.S, edge);
  }
  // pose: { lf, lb, kf, kb, af, ab, bf, bb, bob, squash, head }
  function drawChar(p){
    const g = chX; g.clearRect(0, 0, 34, 44);
    const hipY = COY - 10 + p.bob + p.squash, shY = COY - 18 + p.bob + p.squash * 2;
    arm(g, COX + 7, shY, p.ab, p.bb, true);
    leg(g, COX + 6, hipY, p.lb, p.kb, true);
    // torso: white tee with shading and hem
    g.fillStyle = CP.W; g.fillRect(COX + 3, shY, 8, 9); g.fillRect(COX + 4, shY - 1, 6, 1);
    g.fillStyle = CP.w; g.fillRect(COX + 10, shY + 1, 1, 8); g.fillRect(COX + 3, shY + 8, 8, 1); g.fillRect(COX + 6, shY + 3, 1, 2);
    g.fillStyle = CP.S; g.fillRect(COX + 6, shY - 1, 3, 1);
    g.fillStyle = CP.P; g.fillRect(COX + 3, hipY - 1, 8, 2);
    leg(g, COX + 8, hipY, p.lf, p.kf, false);
    spr(g, p.head, COX + 1, shY - 12, 1, CP);
    arm(g, COX + 7, shY, p.af, p.bf, false);
    // outline: silhouette drawn one pixel around
    const o = chSX; o.clearRect(0, 0, 34, 44);
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx, dy]) => o.drawImage(chC, dx, dy));
    o.globalCompositeOperation = 'source-in'; o.fillStyle = '#141210'; o.fillRect(0, 0, 34, 44); o.globalCompositeOperation = 'source-over';
    o.drawImage(chC, 0, 0);
    return chS;
  }
  function pose(){
    const dead = state === 'rover';
    if (dead) return { lf:.9, lb:-.7, kf:-.2, kb:.6, af:-2.2, ab:2.2, bf:.3, bb:-.3, bob:0, squash:0, head:C_DEAD };
    if (rY > 0){
      const up = rVy > 0;
      return up ? { lf:.9, lb:-.2, kf:1.6, kb:1.4, af:-2.6, ab:-2.2, bf:.4, bb:.4, bob:0, squash:0, head:C_HEAD }
                : { lf:.35, lb:-.25, kf:.5, kb:.8, af:-1.7, ab:1.9, bf:.3, bb:-.2, bob:0, squash:0, head:C_HEAD };
    }
    const blink = rInv > 1100 ? C_DEAD : rFrameT % 3400 < 130 ? C_BLINK : C_HEAD, sq = rLand > 0 ? 1 : 0;
    if (!rStarted){ const br = Math.floor(rFrameT / 700) % 2; return { lf:.08, lb:-.08, kf:0, kb:0, af:-.12, ab:.1, bf:-.15, bb:-.1, bob:br, squash:0, head:blink }; }
    const ph = rDist / 20 * Math.PI * 2, sw = Math.sin(ph);
    return {
      lf: sw * .75, lb: -sw * .75,
      kf: .25 + Math.max(0, -Math.cos(ph)) * 1.2, kb: .25 + Math.max(0, Math.cos(ph)) * 1.2,
      af: -sw * .9, ab: sw * .9, bf: -.9, bb: -.9,
      bob: Math.abs(Math.cos(ph)) > .7 ? 0 : -1, squash: sq, head: blink
    };
  }

  let LAY = null;
  function buildWorld(){
    seed = 7;
    // far: pale ruins, monoliths and aqueducts
    const [far, f0] = mk(TILE, GROUND);
    // draw helper that wraps shapes across the loop point, so the layer tiles seamlessly
    const f = { set fillStyle(v){ f0.fillStyle = v; }, fillRect(x, y, w, h){ f0.fillRect(x, y, w, h); if (x + w > TILE) f0.fillRect(x - TILE, y, w, h); } };
    for (let x = 0; x < TILE; x++){ const hh = 10 + Math.round(4 * Math.sin(x / TILE * Math.PI * 4) + 3 * Math.sin(x / TILE * Math.PI * 10)); f.fillStyle = '#cde7b4'; f.fillRect(x, GROUND - hh, 1, hh); }
    [[0, 130], [190, 320]].forEach(([x0, x1]) => {
      f.fillStyle = '#e4eef1'; f.fillRect(x0, 34, x1 - x0, 5); f.fillStyle = '#c6d7dd'; f.fillRect(x0, 39, x1 - x0, 2);
      for (let x = x0 + 6; x < x1 - 4; x += 22){ f.fillStyle = '#dbe8ec'; f.fillRect(x, 41, 5, GROUND - 41); f.fillStyle = '#c3d4da'; f.fillRect(x + 4, 41, 1, GROUND - 41); f.fillStyle = '#eef5f7'; f.fillRect(x, 41, 1, GROUND - 41); }
    });
    for (let i = 0; i < 6; i++){
      const w = 16 + Math.floor(rnd() * 18), h = 45 + Math.floor(rnd() * 45), x = i * 54 + Math.floor(rnd() * 18);
      f.fillStyle = '#d9e7eb'; f.fillRect(x, GROUND - h, w, h);
      f.fillStyle = '#d9e7eb'; f.fillRect(x + 3, GROUND - h - 6, w - 8, 6); f.fillRect(x + 6, GROUND - h - 10, w - 14, 4);
      f.fillStyle = '#eef5f7'; f.fillRect(x, GROUND - h, 2, h); f.fillRect(x + 3, GROUND - h - 6, 1, 6);
      f.fillStyle = '#bfd2d8'; f.fillRect(x + w - 3, GROUND - h, 3, h); f.fillRect(x + w - 6, GROUND - h - 6, 1, 6);
      for (let k = 0; k < 3; k++){ f.fillStyle = '#c9dadf'; f.fillRect(x + 3 + Math.floor(rnd() * (w - 8)), GROUND - h + 8 + Math.floor(rnd() * (h - 20)), 4, 1); }
    }
    // mid: mossy boulders, twisted trees, lamp posts
    const [mid, g] = mk(TILE, GROUND); const lamps = [];
    function boulder(x, w, h){
      const [c, b] = mk(w, h);
      shape(b, w, h, (px, py) => { const r = 5, cx = Math.min(Math.max(px, r), w - 1 - r), cy = Math.max(py, r); return py >= r ? true : ((px - cx) ** 2 + (py - cy) ** 2 <= r * r); },
        (px, py) => px > w * .68 || py > h - 4 ? '#aaa685' : px < 3 ? '#e2dfbf' : '#cbc7a2', '#868263');
      for (let i = 0; i < w * 2; i++){ const px = 1 + Math.floor(rnd() * (w - 2)), py = 1 + Math.floor(rnd() * Math.min(h * .45, 12)); dot(b, px, py, rnd() < .5 ? '#93bd45' : '#b4d65a'); if (rnd() < .4) dot(b, px, py + 1, '#7aa63a'); }
      for (let i = 0; i < 3; i++){ const px = 2 + Math.floor(rnd() * (w - 4)), py = 8 + Math.floor(rnd() * (h - 12)); dot(b, px, py, '#9bc04a'); dot(b, px + 1, py, '#9bc04a'); dot(b, px, py + 1, '#9bc04a'); }
      g.drawImage(c, x, GROUND - h);
    }
    function tree(tx, scale){
      const pts = [[tx, GROUND], [tx + 5 * scale, GROUND - 18 * scale], [tx - 3 * scale, GROUND - 34 * scale], [tx + 6 * scale, GROUND - 48 * scale]];
      for (let i = 0; i < pts.length - 1; i++){
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.abs(y1 - y0);
        for (let j = 0; j <= n; j++){ const t = j / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), wdt = Math.max(2, Math.round((5 - i * 1.2) * scale));
          g.fillStyle = '#2d3a3a'; g.fillRect(x - (wdt >> 1), y, wdt, 1); g.fillStyle = '#4a5c5a'; g.fillRect(x - (wdt >> 1), y, 1, 1); }
      }
      // roots and a side branch
      g.fillStyle = '#2d3a3a'; g.fillRect(tx - 6 * scale, GROUND - 2, 4 * scale, 2); g.fillRect(tx + 3, GROUND - 2, 5 * scale, 2);
      for (let j = 0; j < 14 * scale; j++){ const th = j < 6 ? 3 : 2; g.fillStyle = '#2d3a3a'; g.fillRect(tx + 2 * scale + j, GROUND - Math.round(30 * scale) - Math.round(j * .6), 1, th); }
      const blobs = [[-8, -50, 15, 8], [12, -54, 17, 9], [2, -62, 13, 7], [22, -46, 10, 6]].map(([dx, dy, rx, ry]) => [tx + dx * scale, GROUND + dy * scale, rx * scale, ry * scale]);
      blobs.forEach(([cx, cy, rx, ry]) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inEll(x, y, cx, cy, rx, ry)) dot(g, x, y, '#557f25'); });
      blobs.forEach(([cx, cy, rx, ry]) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inEll(x, y, cx - 1, cy - 2, rx - 1, ry - 2)) dot(g, x, y, '#76a32e'); });
      blobs.forEach(([cx, cy, rx, ry]) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inEll(x, y, cx - 3, cy - 4, rx * .55, ry * .45)) dot(g, x, y, '#9cc63f'); });
      blobs.forEach(([cx, cy, rx, ry]) => { for (let i = 0; i < rx; i++){ const x = Math.round(cx - rx + rnd() * rx * 2), y = Math.round(cy - ry * .6 + rnd() * ry * .8); if (inEll(x, y, cx, cy, rx - 1, ry - 1)){ dot(g, x, y, '#c3e06b'); dot(g, x + 1, y, '#c3e06b'); } }
        for (let i = 0; i < rx / 2; i++){ const x = Math.round(cx - rx * .8 + rnd() * rx * 1.6), len = 1 + Math.floor(rnd() * 3); for (let k = 0; k < len; k++) dot(g, x, Math.round(cy + ry * .8) + k, '#4b6f20'); } });
    }
    function lamp(x){
      g.fillStyle = '#26262e'; g.fillRect(x, GROUND - 24, 1, 24); g.fillRect(x - 1, GROUND - 1, 3, 1);
      g.fillRect(x - 2, GROUND - 30, 5, 1); g.fillRect(x - 2, GROUND - 25, 5, 1); g.fillRect(x - 2, GROUND - 29, 1, 4); g.fillRect(x + 2, GROUND - 29, 1, 4);
      g.fillStyle = '#f6efcf'; g.fillRect(x - 1, GROUND - 29, 3, 4); g.fillStyle = '#26262e'; g.fillRect(x, GROUND - 32, 1, 2);
      lamps.push([x, GROUND - 27]);
    }
    boulder(8, 22, 30); boulder(96, 30, 22); boulder(210, 20, 36); boulder(262, 34, 18);
    tree(62, 1); tree(170, .8); lamp(140); lamp(300);
    for (let i = 0; i < 9; i++){ const x = Math.floor(rnd() * TILE), r = 3 + Math.floor(rnd() * 4); for (let y = -r; y <= 0; y++) for (let k = -r * 2; k <= r * 2; k++) if (inEll(k, y, 0, 0, r * 2, r)) dot(g, ((x + k) % TILE + TILE) % TILE, GROUND - 1 + y, y < -r + 2 ? '#8cbc3c' : '#6f9c2c'); }
    // ground strip: grass, tufts, earth bank
    const [gr, d] = mk(TILE, WATER - GROUND + 4);
    d.fillStyle = '#7cb342'; d.fillRect(0, 4, TILE, 3); d.fillStyle = '#a5d455'; d.fillRect(0, 4, TILE, 1);
    d.fillStyle = '#9a6f3f'; d.fillRect(0, 7, TILE, WATER - GROUND - 3);
    for (let x = 0; x < TILE; x++){
      if (rnd() < .35){ const hgt = 1 + Math.floor(rnd() * 3); d.fillStyle = rnd() < .5 ? '#7cb342' : '#a5d455'; d.fillRect(x, 4 - hgt, 1, hgt); }
      if (rnd() < .12) dot(d, x, 8 + Math.floor(rnd() * 3), rnd() < .5 ? '#7b5530' : '#b88a55');
      if (rnd() < .03) dot(d, x, 4 - 3, '#f2a3c0');
    }
    d.fillStyle = '#5a3d1f'; d.fillRect(0, WATER - GROUND + 3, TILE, 1);
    // clouds: sunny and stormy versions
    const cloud = (w, h, top, shade) => { const [c, cc] = mk(w, h), bl = [];
      for (let i = 0; i < 4; i++) bl.push([4 + rnd() * (w - 8), h - 4 - rnd() * (h * .5), 3 + rnd() * (h * .45)]);
      shape(cc, w, h, (x, y) => y < h - 1 && bl.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r), (x, y) => y > h * .62 ? shade : top, null); return c; };
    const clouds = [], storms = [];
    for (let i = 0; i < 4; i++){ const w = 24 + Math.floor(rnd() * 22), h = 10 + Math.floor(rnd() * 6); const s0 = seed; clouds.push(cloud(w, h, '#ffffff', '#d4ecf6')); seed = s0; storms.push(cloud(w, h, '#a3adb6', '#7e8893')); }
    LAY = { far, mid, gr, lamps, clouds, storms };
  }

  // sky + light keyframes across one day (t = 0..1)
  const SKY = [
    [0.00, '#1b2550', '#3b4a7a', '#0d1640', .50],
    [0.08, '#6f86d4', '#ffc59a', '#ff9a5a', .16],
    [0.18, '#3fa9e6', '#aee5f8', '#ffffff', 0],
    [0.55, '#3fa9e6', '#aee5f8', '#ffffff', 0],
    [0.65, '#6168bd', '#ff9d68', '#ff7a3a', .22],
    [0.74, '#131b3f', '#2c3966', '#0d1640', .55],
    [1.00, '#1b2550', '#3b4a7a', '#0d1640', .50]
  ];
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a) => a === undefined ? `rgb(${c})` : `rgba(${c},${a})`;
  function skyAt(t){
    let i = 0; while (i < SKY.length - 2 && t > SKY[i + 1][0]) i++;
    const A = SKY[i], B = SKY[i + 1], u = (t - A[0]) / (B[0] - A[0] || 1);
    return { top: mix(hex(A[1]), hex(B[1]), u), bot: mix(hex(A[2]), hex(B[2]), u), tint: mix(hex(A[3]), hex(B[3]), u), ta: A[4] + (B[4] - A[4]) * u };
  }
  const nightness = t => t < .06 ? 1 - t / .06 : t > .7 ? Math.min(1, (t - .7) / .05) : 0;
  const WEATHERS = { sunny:{ cloud:.3, rain:0, leaf:0, gloom:0 }, cloudy:{ cloud:.85, rain:0, leaf:0, gloom:.25 }, rain:{ cloud:1, rain:1, leaf:0, gloom:.55 }, breezy:{ cloud:.45, rain:0, leaf:1, gloom:0 } };
  function pickWeather(prev){
    const bag = ['sunny', 'sunny', 'sunny', 'cloudy', 'rain', 'breezy'].filter(w => w !== prev);
    return bag[Math.floor(Math.random() * bag.length)];
  }

  let rY, rVy, rObs, rSpeed, rDist, rNext, rPaused, rStarted, rFrameT, rMilestone, rLand = 0, rDeadVy = 0, rLastStep = -1, dust = [], rLives = 3, rInv = 0, rShake = 0, debris = [];
  let rClock = DAY_MS * .16, rHalf = -1, weather = 'sunny', W8 = { cloud:.3, rain:0, leaf:0, gloom:0 };
  let off = { far:0, mid:0, gr:0, cl:0 }, cloudPos = [], drops = [], leaves = [];
  const STARS = Array.from({ length: 26 }, (_, i) => [(i * 37) % 160, 4 + (i * 53) % 60, i % 3]);
  function startRun(){
    if (!LAY) buildWorld();
    rY = 0; rVy = 0; rObs = []; rSpeed = 1.1; rDist = 0; rNext = 230; rPaused = false; rStarted = false; rFrameT = 0; rMilestone = 100; rLand = 0; rDeadVy = 0; dust = []; coverT = 0; rLives = 3; rInv = 0; rShake = 0; debris = [];
    if (!cloudPos.length) cloudPos = [0, 1, 2, 3].map(i => ({ x: i * 48 + 10, y: 8 + (i * 17) % 30, i }));
    state = 'run';
  }
  function rJump(){
    if (!rStarted) rStarted = true;
    if (rY === 0){ rVy = 4.3; beep(520, .07, 'square', 900); }
  }
  function puff(n){ for (let i = 0; i < n; i++) dust.push({ x: 18 + Math.random() * 8, y: GROUND - 1 - Math.random() * 2, vx: Math.random() * .4, life: 260 + Math.random() * 200, max: 460 }); }
  function rSpawn(){
    const sc = rDist / 10;
    const pool = sc < 120 ? [0, 0, 1] : sc < 350 ? [0, 0, 1, 1, 3] : [0, 1, 1, 2, 3];
    const kind = pool[Math.floor(Math.random() * pool.length)], px = ROCKS[kind];
    const w = px[0].length * SC, h = px.length * SC;
    rObs.push({ kind, x: 164, w, h, y: GROUND - h + 2 });
    if (sc > 400 && Math.random() < .12){ const p2 = ROCKS[0]; rObs.push({ kind:0, x: 164 + w + 2, w: p2[0].length * SC, h: p2.length * SC, y: GROUND - p2.length * SC + 2 }); }
    rNext = 120 + rSpeed * 50 + Math.random() * 140;
  }
  function envTick(dt){
    const f = dt / 16.67;
    rClock += dt;
    const t = (rClock % DAY_MS) / DAY_MS, half = Math.floor(rClock / (DAY_MS / 2));
    if (half !== rHalf){ if (rHalf !== -1) weather = pickWeather(weather); rHalf = half; }
    const tg = WEATHERS[weather], k = Math.min(1, dt / 2600);
    for (const key in W8) W8[key] += (tg[key] - W8[key]) * k;
    const move = rStarted && state === 'run' ? rSpeed * f : 0;
    off.far = (off.far + move * .12) % TILE; off.mid = (off.mid + move * .38) % TILE; off.gr = (off.gr + move) % TILE;
    const wind = .05 + W8.leaf * .25 + W8.rain * .15;
    cloudPos.forEach(c => { c.x -= (wind + move * .05) * f; if (c.x < -50){ c.x = 165 + Math.random() * 30; c.y = 6 + Math.random() * 34; } });
    // rain and leaves
    const wantDrops = Math.round(W8.rain * 70);
    while (drops.length < wantDrops) drops.push({ x: Math.random() * 180, y: Math.random() * -120, v: 2.6 + Math.random() * 1.4 });
    if (drops.length > wantDrops) drops.length = wantDrops;
    drops.forEach(d => { d.y += d.v * f; d.x -= (d.v * .35 + move * .3) * f; if (d.y > WATER + 6){ d.y = -4 - Math.random() * 30; d.x = Math.random() * 190; } });
    const wantLeaves = Math.round(W8.leaf * 14);
    while (leaves.length < wantLeaves) leaves.push({ x: 160 + Math.random() * 60, y: Math.random() * 90, ph: Math.random() * 6, c: Math.random() < .7 ? '#9cc63f' : '#f2a3c0' });
    if (leaves.length > wantLeaves) leaves.length = wantLeaves;
    leaves.forEach(l => { l.ph += .08 * f; l.x -= (.9 + move * .4) * f; l.y += Math.sin(l.ph) * .4 * f + .15 * f; if (l.x < -4 || l.y > GROUND){ l.x = 165 + Math.random() * 30; l.y = Math.random() * 70; } });
  }
  function runTick(dt){
    const f = dt / 16.67;
    rFrameT += dt;
    if (!rStarted) return;
    rSpeed = Math.min(2.4, 1.1 + rDist / 12000);
    rDist += rSpeed * f;
    if (rY > 0 || rVy > 0){ rY += rVy * f; rVy -= .19 * f; if (rY <= 0){ rY = 0; rVy = 0; rLand = 110; puff(5); } }
    if (rLand > 0) rLand -= dt;
    const step = Math.floor(rDist / 9) % 4;
    if (rY === 0 && step !== rLastStep && (step === 0 || step === 2)) puff(1);
    rLastStep = step;
    dust.forEach(p => { p.x -= (rSpeed * .9 + p.vx) * f; p.y -= .12 * f; p.life -= dt; });
    dust = dust.filter(p => p.life > 0);
    rObs.forEach(o => o.x -= rSpeed * f);
    rObs = rObs.filter(o => o.x > -40);
    rNext -= rSpeed * f; if (rNext <= 0) rSpawn();
    const score = Math.floor(rDist / 10);
    if (score >= rMilestone){ rMilestone += 100; beep(990, .08); setTimeout(() => beep(1320, .1), 90); }
    if (rInv > 0) rInv -= dt;
    if (rShake > 0) rShake -= f;
    debris.forEach(d => { d.x += (d.vx - rSpeed) * f; d.y += d.vy * f; d.vy += .18 * f; d.life -= dt; });
    debris = debris.filter(d => d.life > 0 && d.y < GROUND + 2);
    if (rInv > 0) return;
    const px = 19, pw = 9, pbot = GROUND - rY - 1;
    for (const o of rObs){
      if (px < o.x + o.w - 3 && px + pw > o.x + 3 && pbot > o.y + 2){
        // rock shatters into bits of stone and moss
        for (let i = 0; i < 10; i++) debris.push({ x: o.x + o.w / 2, y: o.y + 2, vx: rSpeed + (Math.random() * 2.4 - .6), vy: -1.5 - Math.random() * 1.8, life: 700, c: ['#aeaa8b', '#868369', '#d8d4b4', '#8cbc3c'][i % 4] });
        rObs = rObs.filter(x => x !== o);
        rLives--; rShake = 10;
        if (rLives <= 0){
          state = 'rover'; deadT = 0; rDeadVy = 2.4; beep(300, .5, 'sawtooth', 50);
          if (score > rhi){ rhi = score; try { localStorage.setItem('as-run-hi', rhi); } catch(e){} }
        } else {
          rInv = 1600; if (rY === 0) rVy = 2.4; beep(240, .18, 'square', 120);
        }
        return;
      }
    }
  }
  function spr(g, rows, x, y, s, pal){
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++){ const c = r[i]; if (c === '.' || !pal[c]) continue; g.fillStyle = pal[c]; g.fillRect(Math.round(x + i*s), Math.round(y + j*s), s, s); } });
  }
  const [worldC, wc] = mk(W, H);
  function tile(g, img, offset, y){ const x = -Math.floor(offset); g.drawImage(img, x, y); g.drawImage(img, x + TILE, y); }
  function drawRun(){
    const t = (rClock % DAY_MS) / DAY_MS, L = skyAt(t), night = nightness(t), gl = W8.gloom;
    const grey = [135, 150, 163];
    // sky, in 4px bands for a pixel look
    for (let y = 0; y < GROUND; y += 4){ const c = mix(mix(L.top, L.bot, y / GROUND), grey, gl * .7); ctx.fillStyle = rgb(c); ctx.fillRect(0, y, W, 4); }
    // stars and moon at night, sun by day
    if (night > .05){
      STARS.forEach(([x, y, k]) => { if ((Math.floor(tick / 20) + k) % 5) { ctx.fillStyle = rgb([255, 255, 240], night * (1 - gl)); ctx.fillRect(x, y, 1, 1); } });
      const mt = t > .5 ? (t - .7) / .36 : (t + .3) / .36, mx = Math.round(-10 + 180 * mt), my = Math.round(46 - Math.sin(mt * Math.PI) * 32);
      for (let a = 0; a < 40; a++){ const ang = a / 40 * Math.PI * 2; ctx.fillStyle = rgb([235, 242, 255], night * .9); ctx.fillRect(Math.round(mx + Math.cos(ang) * 6), Math.round(my + Math.sin(ang) * 6), 1, 1); }
    }
    if (t > .04 && t < .72){
      const st = (t - .04) / .68, sx = Math.round(-8 + 176 * st), sy = Math.round(70 - Math.sin(st * Math.PI) * 56);
      const g2 = ctx.createRadialGradient(sx, sy, 2, sx, sy, 22); g2.addColorStop(0, `rgba(255,246,200,${.55 * (1 - gl)})`); g2.addColorStop(1, 'rgba(255,246,200,0)');
      ctx.fillStyle = g2; ctx.fillRect(sx - 22, sy - 22, 44, 44);
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x*x + y*y <= 26){ ctx.fillStyle = rgb(x*x + y*y > 16 ? [255, 222, 120] : [255, 248, 210], 1 - gl * .7); ctx.fillRect(sx + x, sy + y, 1, 1); }
    }
    // clouds (sunny clouds fade into storm clouds)
    const nC = Math.max(1, Math.round(1 + W8.cloud * 3));
    cloudPos.slice(0, nC).forEach(c => {
      ctx.globalAlpha = 1 - gl; ctx.drawImage(LAY.clouds[c.i], Math.round(c.x), c.y);
      ctx.globalAlpha = gl; ctx.drawImage(LAY.storms[c.i], Math.round(c.x), c.y); ctx.globalAlpha = 1;
    });
    // world layers, tinted together for time of day and weather
    wc.clearRect(0, 0, W, H);
    tile(wc, LAY.far, off.far, 0); tile(wc, LAY.mid, off.mid, 0); tile(wc, LAY.gr, off.gr, GROUND - 4);
    // water with shimmer
    for (let y = WATER; y < H; y++){ const u = (y - WATER) / (H - WATER); wc.fillStyle = rgb(mix([110, 200, 232], [56, 140, 196], u)); wc.fillRect(0, y, W, 1); }
    for (let i = 0; i < 9; i++){ const y = WATER + 2 + (i * 3) % 9, x = Math.round(((i * 41) - off.gr * .6 + tick * .2) % 180) - 10; wc.fillStyle = 'rgba(220,246,255,.7)'; wc.fillRect(x, y, 6 + i % 3 * 3, 1); }
    // rocks
    rObs.forEach(o => { spr(wc, ROCKS[o.kind], Math.round(o.x), o.y, SC, ROCKP); wc.fillStyle = '#7cb342'; wc.fillRect(Math.round(o.x) - 1, GROUND, 3, 1); wc.fillRect(Math.round(o.x) + o.w - 2, GROUND, 3, 1); });
    // player
    const dead = state === 'rover';
    if (dead && (rY > 0 || rDeadVy > 0)){ rY = Math.max(0, rY + rDeadVy); rDeadVy -= .19; if (rY === 0) rDeadVy = 0; }
    const runner = drawChar(pose()), rx = 16 - COX, ryy = GROUND - COY - Math.round(rY);
    if (!(rInv > 0 && Math.floor(rInv / 90) % 2)) wc.drawImage(runner, rx, ryy);
    debris.forEach(d => { wc.fillStyle = d.c; wc.fillRect(Math.round(d.x), Math.round(d.y), 2, 2); });
    // dust puffs
    dust.forEach(p => { const a2 = Math.max(0, p.life / p.max); wc.fillStyle = `rgba(236,228,200,${a2 * .9})`; const sz = a2 > .5 ? 2 : 1; wc.fillRect(Math.round(p.x), Math.round(p.y), sz, sz); });
    // reflection in the pond
    wc.save(); wc.beginPath(); wc.rect(0, WATER, W, H - WATER); wc.clip(); wc.globalAlpha = .3;
    wc.translate(0, 2 * WATER - 6); wc.scale(1, -1); wc.drawImage(runner, rx, ryy); wc.restore();
    // tint the world (dawn, sunset, night, gloom)
    wc.globalCompositeOperation = 'source-atop';
    if (L.ta > .01){ wc.fillStyle = rgb(L.tint, L.ta); wc.fillRect(0, 0, W, H); }
    if (gl > .01){ wc.fillStyle = rgb([70, 82, 96], gl * .35); wc.fillRect(0, 0, W, H); }
    wc.globalCompositeOperation = 'source-over';
    const shk = rShake > 0 ? Math.round((Math.random() * 2 - 1) * Math.min(2, rShake / 4)) : 0;
    ctx.drawImage(worldC, shk, 0);
    // fill the strip the shake uncovers, so no gap shows at the edges
    if (shk > 0) ctx.drawImage(worldC, 0, 0, shk, H, 0, 0, shk, H);
    if (shk < 0) ctx.drawImage(worldC, W + shk, 0, -shk, H, W + shk, 0, -shk, H);
    // lamp light at night
    if (night > .05){
      ctx.globalCompositeOperation = 'lighter';
      LAY.lamps.forEach(([lx, ly]) => { for (const base of [0, TILE]){ const x = Math.round(lx + base - off.mid); if (x < -20 || x > W + 20) continue;
        const g3 = ctx.createRadialGradient(x, ly, 1, x, ly, 16); g3.addColorStop(0, `rgba(255,205,110,${.6 * night})`); g3.addColorStop(1, 'rgba(255,205,110,0)'); ctx.fillStyle = g3; ctx.fillRect(x - 16, ly - 16, 32, 32); } });
      ctx.globalCompositeOperation = 'source-over';
    }
    // rain and leaves on top
    ctx.fillStyle = 'rgba(215,232,255,.75)';
    drops.forEach(d => { const x = Math.round(d.x), y = Math.round(d.y); ctx.fillRect(x, y, 1, 2); ctx.fillRect(x - 1, y + 2, 1, 1); if (y > WATER - 1 && y < WATER + 2) { ctx.fillRect(x - 1, WATER, 1, 1); ctx.fillRect(x + 1, WATER, 1, 1); } });
    leaves.forEach(l => { ctx.fillStyle = l.c; ctx.fillRect(Math.round(l.x), Math.round(l.y), 2, 1); });
    // hud
    const ink = night > .5 ? '#f4f7ec' : '#141210', sh = night > .5 ? '#141210' : 'rgba(255,255,255,.55)';
    const score = Math.floor(rDist / 10);
    const day = Math.floor(rClock / DAY_MS) + 1;
    const label = 'DAY ' + day + ' ' + { sunny:'SUN', cloudy:'CLOUD', rain:'RAIN', breezy:'WIND' }[weather];
    const sx = 'XP ' + String(score).padStart(5, '0'), hx = 'HI ' + String(Math.max(rhi, score)).padStart(5, '0');
    if (rStarted || state === 'rover') [[label, 4, 4], [sx, W - 4 - width(sx), 4], [hx, W - 4 - width(hx), 13]].forEach(([s2, x, y]) => { text(ctx, s2, x + 1, y + 1, sh); text(ctx, s2, x, y, ink); });
    if (rStarted || state === 'rover') for (let i = 0; i < 3; i++) heart(4 + i * 9, 14, i < rLives);
    if (!rStarted && state === 'run') drawCover();
    if (state === 'run' && rPaused){ rbox(); center(ctx, 'PAUSED', 46, '#ffffff', 2); center(ctx, 'SELECT FOR MENU', 66, '#cde7b4'); }
    if (dead){ deadT++; drawGameOver(score); }
  }
  const HEART = ['.oo.oo.','orroRro','orrrrro','.orrro.','..oro..','...o...'];
  function heart(x, y, full){ spr(ctx, HEART, x, y, 1, full ? { o:'#2a0e18', r:'#ff4f6d', R:'#ffc0cc' } : { o:'#2a0e18', r:'rgba(255,255,255,.35)', R:'rgba(255,255,255,.35)' }); }
  function pill(x, y, w, label, col){
    ctx.fillStyle = '#1a0c12'; ctx.fillRect(x + 1, y, w - 2, 13); ctx.fillRect(x, y + 1, w, 11);
    ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, w - 2, 10);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 2, y + 2, w - 4, 1);
    text(ctx, label, Math.round(x + (w - width(label)) / 2), y + 3, '#ffffff');
  }
  function drawGameOver(score){
    const drop = deadT < 30 ? Math.round(-30 * Math.pow(1 - deadT / 30, 2) * Math.abs(Math.cos(deadT / 30 * Math.PI * 1.5))) : 0;
    for (let y = 18; y < 100; y++){ const e = Math.min(1, Math.min(y - 18, 100 - y) / 10); ctx.fillStyle = `rgba(26,10,30,${.78 * e})`; ctx.fillRect(0, y, W, 1); }
    otext('GAME OVER', 80, 26 + drop, 2, '#ffe0e8', '#2a0e18', '#ff4f6d');
    const sc = 'XP ' + score, scx = Math.round(80 - width(sc, 2) / 2);
    text(ctx, sc, scx + 1, 49, '#2a0e18', 2); text(ctx, sc, scx, 48, '#ffffff', 2);
    const isBest = score > 0 && score >= rhi;
    if (isBest){ if (Math.floor(tick / 15) % 2 === 0){ const t2 = 'NEW BEST!', bx = Math.round(80 - width(t2) / 2); ctx.fillStyle = '#ffd54a'; ctx.fillRect(bx - 4, 64, width(t2) + 8, 11); text(ctx, t2, bx, 66, '#2a0e18'); } }
    else { const t2 = 'BEST ' + rhi + ' XP'; text(ctx, t2, Math.round(80 - width(t2) / 2), 66, '#cfc3d6'); }
    if (deadT > 30){ pill(26, 81, 52, 'A RETRY', '#3fae5a'); pill(84, 81, 52, 'B MENU', '#5b6380'); }
  }
  let coverT = 0;
  function otext(str, cx, y, scale, fill, outline, low){
    const x = Math.round(cx - width(str, scale) / 2);
    for (const [dx, dy] of [[0,3],[1,3],[-1,3],[2,2],[-2,2]]) text(ctx, str, x + dx, y + dy, 'rgba(20,12,6,.45)', scale);   // drop shadow
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,2]]) text(ctx, str, x + dx, y + dy, outline, scale);
    text(ctx, str, x, y, fill, scale);
    if (low){ ctx.save(); ctx.beginPath(); ctx.rect(0, y + Math.round(3.5 * scale), W, 7 * scale); ctx.clip(); text(ctx, str, x, y, low, scale); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < str.length; i++) ctx.fillRect(x + i * 6 * scale, y, scale, scale);   // glint on each letter
  }
  function drawCover(){
    coverT++;
    const cx = 80, drop = coverT < 36 ? Math.round(-40 * Math.pow(1 - coverT / 36, 2) * Math.abs(Math.cos(coverT / 36 * Math.PI * 1.5))) : 0;
    // soft band behind the title for contrast
    for (let y = 0; y < 64; y++){ ctx.fillStyle = `rgba(20,30,60,${.28 * (1 - y / 64)})`; ctx.fillRect(0, y, W, 1); }
    otext('ALWIN', cx, 8 + drop, 3, '#fff3b8', '#2a1a0e', '#ffbe3b');
    otext('RUN', cx, 33 + drop, 3, '#fff3b8', '#2a1a0e', '#ff7f3a');
    // speed streaks behind RUN
    if (drop === 0){
      const sx = Math.round(cx - width('RUN', 3) / 2) - 6, st = tick % 24;
      [[38, 18], [44, 26], [50, 14]].forEach(([y, len], i) => { const off = (st + i * 7) % 24 < 12 ? 0 : 3; ctx.fillStyle = '#2a1a0e'; ctx.fillRect(sx - len - off, y, len, 2); ctx.fillStyle = '#fff3b8'; ctx.fillRect(sx - len - off + 1, y, Math.max(2, len - 6), 1); });
    }
    // sparkles that twinkle around the title
    [[24, 12], [138, 10], [124, 40], [34, 44], [146, 54]].forEach(([x, y], i) => {
      const ph = (Math.floor(tick / 10) + i * 3) % 8; if (ph > 4) return;
      const r = ph < 2 ? 1 : ph < 4 ? 2 : 1; ctx.fillStyle = '#fffbe0';
      ctx.fillRect(x, y - r, 1, r * 2 + 1); ctx.fillRect(x - r, y, r * 2 + 1, 1);
    });
    // tagline
    const tg = 'A PORTFOLIO ADVENTURE', tx = Math.round(cx - width(tg) / 2);
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) text(ctx, tg, tx + dx, 60 + dy, '#2a1a0e');
    text(ctx, tg, tx, 60, '#e6f5c8');
    // start button
    const pw = 92, px2 = Math.round(cx - pw / 2), py2 = 72, pressed = Math.floor(tick / 30) % 2;
    ctx.fillStyle = '#2a1a0e'; ctx.fillRect(px2 + 1, py2 + 1, pw, 14); ctx.fillRect(px2, py2 + 2, pw + 2, 12);
    ctx.fillStyle = pressed ? '#e0336b' : '#ff4f86'; ctx.fillRect(px2 + 1, py2 + 1 + pressed, pw - 2, 12 - pressed);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(px2 + 2, py2 + 2 + pressed, pw - 4, 1);
    text(ctx, '>', px2 + 5 + (pressed ? 1 : 0), py2 + 4 + pressed, '#fff3b8');
    text(ctx, 'PRESS A / TAP', px2 + 14, py2 + 4 + pressed, '#ffffff');
    if (rhi > 0){ const t2 = 'BEST ' + rhi + ' XP', bx = Math.round(cx - width(t2) / 2); for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) text(ctx, t2, bx + dx, 91 + dy, '#2a1a0e'); text(ctx, t2, bx, 91, '#ffd54a'); }
  }
  function rbox(){ ctx.fillStyle = 'rgba(20,18,16,.72)'; ctx.fillRect(10, 28, 140, 58); ctx.fillStyle = '#f4f7ec'; ctx.fillRect(10, 28, 140, 1); ctx.fillRect(10, 85, 140, 1); }


  // ---------- NEON COAST: pseudo-3D street racer ----------
  // Road Rash-style projection: the road is a list of segments projected to the screen
  // every frame, drawn as stacked strips; curves shift them sideways, hills up and down.
  const RC = { segL: 200, roadW: 2000, camH: 1350, depth: 1 / Math.tan(50 * Math.PI / 180), draw: 110, centri: .3 };
  RC.pz = RC.camH * RC.depth;
  const RC_CARS = [
    { name:'VELOCE R', tl:'round', pipes:2, c:'#d81e2a', s:'#7e0e16', hi:'#ff7a6b', sp:1, top:315, spd:3, acc:4, grip:4 },
    { name:'TORO GT',  tl:'hex', pipes:4, c:'#b9d814', s:'#5f7408', hi:'#efff86', sp:2, top:345, spd:5, acc:4, grip:2 },
    { name:'NOVA 9',   tl:'bar', pipes:1, c:'#e4eaee', s:'#8494a2', hi:'#ffffff', sp:0, top:305, spd:3, acc:3, grip:5 },
    { name:'MIRAGE',   tl:'slash', pipes:2, c:'#f0449a', s:'#8a1650', hi:'#ffa6d4', sp:1, top:300, spd:2, acc:5, grip:4 },
    { name:'PHANTOM',  tl:'x', pipes:4, c:'#5a3cc0', s:'#25125e', hi:'#a891ff', sp:2, top:340, spd:5, acc:3, grip:3 }
  ];
  const RC_CIV = [
    { c:'#ffcc33', s:'#b8860b', hi:'#fff09a', civ:1, taxi:1, tl:'round', pipes:1 },
    { c:'#2fa9a4', s:'#16625f', hi:'#9af0ea', civ:1, tl:'bar', pipes:1 },
    { c:'#e9e5dc', s:'#9c978b', hi:'#ffffff', civ:2, tl:'round', pipes:1 },
    { c:'#e8742e', s:'#93430f', hi:'#ffc08f', civ:1, tl:'slash', pipes:1 }
  ];
  let rcBest = 0; try { rcBest = +localStorage.getItem('as-rc-best') || 0; } catch(e){}
  let rcSeg = [], rcTrack = 0, rcCar = 0, rcPos = 0, rcX = 0, rcSpeed = 0, rcDist = 0, rcTime = 0, rcCount = 0, rcCars = [], rcRivals = [];
  let rcLapShown = 1, rcLapT = 0, rcBump = 0, rcSky = 0, rcShake = 0, rcPaused = false, rcResult = null, rcT = 0, rcSpr = null, rcGlows = [];

  // ---- high-resolution art (NEON COAST renders at 320x256) ----
  const RW = 320, RH = 256;
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  function outlineCanvas(c, col){
    const [o, g] = mk(c.width + 2, c.height + 2);
    [[0,1],[2,1],[1,0],[1,2]].forEach(([x, y]) => g.drawImage(c, x, y));
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, o.width, o.height);
    g.globalCompositeOperation = 'source-over'; g.drawImage(c, 1, 1); return o;
  }
  const vgrad = (g, y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  function tyre(g, x, y, w, h){
    g.fillStyle = '#0d0b14'; rr(g, x, y, w, h, 3);
    g.fillStyle = '#2a2636'; for (let yy = y + 2; yy < y + h - 1; yy += 3) g.fillRect(x + 2, yy, w - 4, 1);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 1, y + 1, 2, h - 2);
  }
  function tailLights(g, p, y){
    const R = '#ff1f4b', Hh = '#ffc2cf';
    g.save();
    const mirror = fn => { fn(1, 0); fn(-1, 84); };
    if (p.tl === 'round') mirror((d, o) => { [[16, 4], [26, 3.2]].forEach(([x, r]) => { const xx = o + d * x; g.fillStyle = R; g.beginPath(); g.arc(xx, y, r, 0, 7); g.fill(); g.fillStyle = Hh; g.beginPath(); g.arc(xx, y, r * .45, 0, 7); g.fill(); }); });
    else if (p.tl === 'bar'){ g.fillStyle = R; g.fillRect(9, y - 1.5, 66, 3); g.fillStyle = Hh; g.fillRect(10, y - .5, 64, 1); }
    else if (p.tl === 'slash') mirror((d, o) => { g.fillStyle = R; g.beginPath(); const x = o + d * 10; g.moveTo(x, y + 2); g.lineTo(x + d * 18, y - 3); g.lineTo(x + d * 20, y - 1); g.lineTo(x + d * 2, y + 4); g.fill(); g.fillStyle = Hh; g.fillRect(Math.min(x + d * 6, x + d * 14), y, 8, 1); });
    else if (p.tl === 'x') mirror((d, o) => { g.strokeStyle = R; g.lineWidth = 2.4; const x = o + d * 12; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + d * 12, y + 4); g.moveTo(x, y + 4); g.lineTo(x + d * 12, y - 4); g.stroke(); g.strokeStyle = Hh; g.lineWidth = .8; g.stroke(); });
    else mirror((d, o) => { const x = o + d * 19; g.strokeStyle = R; g.lineWidth = 2.2; g.beginPath(); for (let i = 0; i <= 6; i++){ const a = i / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 4); } g.stroke(); g.fillStyle = Hh; g.fillRect(x - 2, y - .5, 4, 1); });
    g.restore();
  }
  // rear view from behind and slightly above
  function carBack(p){
    const [c, g] = mk(84, 52), box = p.civ === 2;
    tyre(g, 2, 29, 15, 21); tyre(g, 67, 29, 15, 21);
    const body = vgrad(g, 10, 46, [[0, p.hi], [.35, p.c], [1, p.s]]);
    if (box){
      g.fillStyle = body; rr(g, 6, 1, 72, 44, 6);
      g.fillStyle = vgrad(g, 5, 22, [[0, '#2e2a52'], [1, '#141024']]); rr(g, 12, 5, 60, 17, 3);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(14, 7, 20, 2);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(41, 24, 2, 18);
    } else {
      g.fillStyle = body; g.beginPath(); g.ellipse(15, 31, 13, 10, 0, 0, 7); g.ellipse(69, 31, 13, 10, 0, 0, 7); g.fill();
      rr(g, 3, 22, 78, 21, 8);
      g.fillStyle = vgrad(g, 14, 28, [[0, p.hi], [1, p.c]]); rr(g, 11, 15, 62, 12, 6);
      // rounded cabin + rear glass
      g.fillStyle = vgrad(g, 0, 20, [[0, p.hi], [1, p.c]]);
      g.beginPath(); g.moveTo(17, 20); g.bezierCurveTo(19, 5, 28, 1, 42, 1); g.bezierCurveTo(56, 1, 65, 5, 67, 20); g.closePath(); g.fill();
      g.fillStyle = vgrad(g, 4, 19, [[0, '#3b3570'], [.5, '#1d1838'], [1, '#110d20']]);
      g.beginPath(); g.moveTo(22, 19); g.bezierCurveTo(24, 8, 31, 4.5, 42, 4.5); g.bezierCurveTo(53, 4.5, 60, 8, 62, 19); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(28, 17); g.lineTo(36, 6); g.moveTo(32, 17); g.lineTo(38, 9); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(34, 2, 16, 1);
      // engine louvres
      g.fillStyle = 'rgba(0,0,0,.45)'; for (let x = 26; x < 58; x += 4) rr(g, x, 19, 2.5, 5, 1);
      // mirrors
      g.fillStyle = p.c; g.beginPath(); g.ellipse(13, 18, 4, 2.5, 0, 0, 7); g.ellipse(71, 18, 4, 2.5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(5, 23, 74, 1);
    }
    if (p.taxi){ g.fillStyle = '#fff4b0'; rr(g, 30, 0, 24, 5, 2); g.fillStyle = '#d18f00'; g.fillRect(33, 2, 18, 1); }
    tailLights(g, p, box ? 30 : 30);
    // plate
    g.fillStyle = '#f3f0e8'; rr(g, 33, 32, 18, 6, 1); g.fillStyle = '#3a3448'; g.fillRect(35, 34, 3, 2); g.fillRect(39, 34, 3, 2); g.fillRect(43, 34, 3, 2); g.fillRect(47, 34, 2, 2);
    // diffuser + exhausts
    g.fillStyle = '#100c18'; rr(g, 14, 39, 56, 6, 2);
    g.fillStyle = '#2b2638'; for (let x = 22; x < 64; x += 6) g.fillRect(x, 39, 1, 6);
    const pipes = p.pipes || 2, px = pipes === 4 ? [27, 33, 51, 57] : pipes === 1 ? [42] : [30, 54];
    px.forEach(x => { g.fillStyle = '#c9c6d6'; g.beginPath(); g.arc(x, 42.5, 2.4, 0, 7); g.fill(); g.fillStyle = '#18141f'; g.beginPath(); g.arc(x, 42.5, 1.3, 0, 7); g.fill(); });
    // spoilers
    if (p.sp === 1){ g.fillStyle = p.s; rr(g, 9, 13, 66, 3, 1.5); g.fillStyle = p.hi; g.fillRect(11, 13, 62, 1); }
    if (p.sp === 2){ g.fillStyle = '#16121e'; g.fillRect(20, 10, 3, 8); g.fillRect(61, 10, 3, 8); g.fillStyle = vgrad(g, 5, 11, [[0, p.hi], [1, p.s]]); rr(g, 2, 5, 80, 6, 2); g.fillStyle = '#16121e'; g.fillRect(2, 6, 3, 6); g.fillRect(79, 6, 3, 6); }
    return outlineCanvas(c, '#0c0814');
  }
  function carFront(p){
    const [c, g] = mk(84, 48);
    tyre(g, 2, 27, 15, 21); tyre(g, 67, 27, 15, 21);
    g.fillStyle = vgrad(g, 0, 10, [[0, p.hi], [1, p.c]]); g.beginPath(); g.moveTo(22, 10); g.bezierCurveTo(25, 2, 32, 0, 42, 0); g.bezierCurveTo(52, 0, 59, 2, 62, 10); g.closePath(); g.fill();
    g.fillStyle = vgrad(g, 6, 20, [[0, '#4a438a'], [.5, '#211b40'], [1, '#100c1e']]); g.beginPath(); g.moveTo(14, 20); g.lineTo(22, 6); g.lineTo(62, 6); g.lineTo(70, 20); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(30, 18); g.lineTo(38, 8); g.moveTo(35, 18); g.lineTo(42, 9); g.stroke();
    g.fillStyle = vgrad(g, 18, 40, [[0, p.hi], [.3, p.c], [1, p.s]]); rr(g, 2, 19, 80, 21, 8);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(30, 21); g.lineTo(54, 21); g.lineTo(50, 30); g.lineTo(34, 30); g.closePath(); g.fill();
    g.fillStyle = p.s; g.fillRect(41, 21, 2, 10);
    // headlights
    [[5, 1], [79, -1]].forEach(([x, d]) => { g.fillStyle = '#121019'; g.beginPath(); g.moveTo(x, 25); g.lineTo(x + d * 17, 27); g.lineTo(x + d * 15, 31); g.lineTo(x, 30); g.closePath(); g.fill();
      g.fillStyle = '#eaf6ff'; g.beginPath(); g.moveTo(x + d * 1, 26); g.lineTo(x + d * 15, 27.6); g.lineTo(x + d * 14, 29); g.lineTo(x + d * 1, 28.2); g.closePath(); g.fill();
      g.fillStyle = '#ffd36b'; g.fillRect(Math.min(x + d, x + d * 6), 29.5, 5, 1); });
    // intakes + splitter
    g.fillStyle = '#0f0c16'; rr(g, 22, 33, 40, 7, 2); rr(g, 4, 33, 13, 6, 2); rr(g, 67, 33, 13, 6, 2);
    g.fillStyle = '#2c2838'; for (let x = 24; x < 61; x += 3) g.fillRect(x, 34, 1, 5);
    g.fillStyle = '#16121e'; g.fillRect(6, 41, 72, 2);
    return outlineCanvas(c, '#0c0814');
  }
  function palm(v){
    const [c, g] = mk(72, 106), dir = v ? -1 : 1;
    const tx = t => 36 + Math.sin(t * 2.2) * 9 * dir;
    for (let y = 105; y > 24; y--){ const t = (105 - y) / 81, x = tx(t), w = 6 - t * 2.2;
      g.fillStyle = (y % 5 < 1) ? '#3e2818' : '#5e3d26'; g.fillRect(Math.round(x - w / 2), y, Math.round(w), 1);
      g.fillStyle = '#7c5434'; g.fillRect(Math.round(x - w / 2), y, 1, 1); }
    const top = [tx(1), 24];
    for (let i = 0; i < 11; i++){
      const a = -Math.PI + (i / 10) * Math.PI * 1.02 + (i % 2) * .08, len = 26 + (i % 3) * 5;
      for (let t = 0; t < len; t += .7){
        const x = top[0] + Math.cos(a) * t, y = top[1] + Math.sin(a) * t * .55 + t * t * .028, k = t / len;
        g.fillStyle = k < .15 ? '#1c4f2a' : '#235f33'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
        if (t > 4 && Math.round(t * 10) % 18 < 9){ const lx = Math.round(x + Math.cos(a + 1.6) * 3), ly = Math.round(y + 3 + k * 2); g.fillStyle = '#17452a'; g.fillRect(lx, ly, 1, 3); g.fillRect(Math.round(x + Math.cos(a - 1.6) * 3), ly, 1, 3); }
        if (t % 5 < 1) { g.fillStyle = '#3f9a52'; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
      }
    }
    g.fillStyle = '#2e1d10'; [[0, 3], [3, 4], [-3, 5]].forEach(([dx, dy]) => { g.beginPath(); g.arc(top[0] + dx, top[1] + dy, 2, 0, 7); g.fill(); });
    return c;
  }
  // buildings: darker art-deco, with a separate "lights" layer that glows at dusk/night
  function building(i){
    seed = 500 + i * 37;
    const base = ['#8e5a73', '#4d7c78', '#5d6296', '#8a7450', '#7a568a', '#a0667a'][i % 6];
    const w = 76 + (i % 3) * 18, h = 110 + (i % 4) * 22, [c, g] = mk(w, h), [lc, lg] = mk(w, h);
    const dark = rgb(mix(hex(base), [10, 6, 20], .45)), light = rgb(mix(hex(base), [255, 240, 230], .25));
    g.fillStyle = base; g.fillRect(0, 18, w, h - 18); g.fillRect(8, 10, w - 16, 8); g.fillRect(w / 2 - 12, 2, 24, 8); g.fillRect(w / 2 - 2, 0, 4, 2);
    g.fillStyle = light; g.fillRect(0, 18, 3, h - 18); g.fillRect(8, 10, 2, 8);
    g.fillStyle = dark; g.fillRect(w - 6, 18, 6, h - 18); g.fillRect(w - 10, 10, 2, 8);
    for (let y = 30; y < h - 14; y += 14){ g.fillStyle = light; g.fillRect(0, y - 3, w, 1); g.fillStyle = dark; g.fillRect(0, y - 2, w, 1); }
    const fins = [Math.round(w * .33), Math.round(w * .66)];
    for (let y = 30; y < h - 16; y += 14) for (let x = 8; x < w - 12; x += 9){
      if (fins.some(f => Math.abs(x + 3 - f) < 4)) continue;
      g.fillStyle = '#1a1530'; g.fillRect(x, y, 6, 7); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, 6, 1);
      const on = rnd(); if (on < .62){ lg.fillStyle = on < .35 ? '#ffcf7a' : on < .5 ? '#ff8ad8' : '#8ef3ff'; lg.fillRect(x + 1, y + 1, 4, 5); }
    }
    fins.forEach(f => { g.fillStyle = light; g.fillRect(f - 2, 18, 2, h - 30); g.fillStyle = dark; g.fillRect(f, 18, 2, h - 30); });
    // entrance + canopy
    g.fillStyle = '#120e22'; g.fillRect(w / 2 - 10, h - 14, 20, 14); g.fillStyle = dark; g.fillRect(w / 2 - 16, h - 17, 32, 3);
    lg.fillStyle = '#ffd99a'; lg.fillRect(w / 2 - 8, h - 12, 16, 10);
    // neon tube trim on the crown
    const neon = i % 2 ? '#ff3da1' : '#3ff0ff';
    g.fillStyle = neon; g.fillRect(8, 18, w - 16, 1); g.fillRect(w / 2 - 12, 10, 24, 1);
    lg.fillStyle = neon; lg.fillRect(8, 17, w - 16, 3); lg.fillRect(w / 2 - 12, 9, 24, 3);
    if (i % 3 === 0){ const word = 'HOTEL'; for (let k = 0; k < word.length; k++){ text(g, word[k], w - 20, 34 + k * 10, neon); text(lg, word[k], w - 20, 34 + k * 10, neon); } }
    return { img: c, lit: lc };
  }
  function sign(word, col){
    const wd = width(word, 2) + 16, [c, g] = mk(wd, 26), [lc, lg] = mk(wd, 26);
    g.fillStyle = '#1a0f2c'; rr(g, 0, 0, wd, 22, 3); g.fillStyle = '#2a2140'; g.fillRect(6, 22, 2, 4); g.fillRect(wd - 8, 22, 2, 4);
    [g, lg].forEach(x => { x.strokeStyle = col; x.lineWidth = 1.5; x.strokeRect(2.5, 2.5, wd - 5, 17); text(x, word, 8, 4, col, 2); });
    return { img: c, lit: lc };
  }
  function billboard(){
    const [c, g] = mk(96, 62), [lc, lg] = mk(96, 62);
    g.fillStyle = '#2a2140'; g.fillRect(20, 40, 4, 22); g.fillRect(72, 40, 4, 22);
    g.fillStyle = '#efe9df'; g.fillRect(0, 0, 96, 42);
    g.fillStyle = vgrad(g, 2, 40, [[0, '#ff5fa2'], [1, '#5a2ea8']]); g.fillRect(2, 2, 92, 38);
    text(g, 'HIRE', 25, 6, '#ffffff', 2); text(g, 'ALWIN', 19, 22, '#ffe14d', 2);
    for (let x = 6; x < 92; x += 14){ g.fillStyle = '#fff6c8'; g.fillRect(x, 0, 3, 2); lg.fillStyle = '#fff6c8'; lg.fillRect(x, 0, 3, 3); }
    lg.globalAlpha = .5; lg.drawImage(c, 0, 0); lg.globalAlpha = 1;
    return { img: c, lit: lc };
  }
  function lamp(){
    const [c, g] = mk(26, 90), [lc, lg] = mk(26, 90);
    g.fillStyle = '#3a3650'; g.fillRect(11, 8, 3, 82); g.fillRect(5, 86, 15, 4);
    g.fillStyle = '#3a3650'; g.fillRect(3, 6, 10, 3);
    g.fillStyle = '#fff1b8'; rr(g, 1, 8, 8, 4, 2); lg.fillStyle = '#ffe6a0'; rr(lg, 0, 7, 10, 6, 3);
    return { img: c, lit: lc };
  }
  function gantry(){
    const [c, g] = mk(300, 70), [lc, lg] = mk(300, 70);
    g.fillStyle = '#231d36'; g.fillRect(8, 16, 8, 54); g.fillRect(284, 16, 8, 54);
    for (let x = 0; x < 300; x += 10) for (let y = 0; y < 2; y++){ g.fillStyle = ((x / 10 + y) % 2) ? '#111' : '#f4f4f4'; g.fillRect(x, y * 7, 10, 7); }
    g.fillStyle = '#160d26'; rr(g, 70, 16, 160, 24, 4);
    [g, lg].forEach(x => { text(x, 'NEON COAST', 92, 22, '#ff4fa3', 2); x.strokeStyle = '#3ff0ff'; x.lineWidth = 1.5; x.strokeRect(72.5, 18.5, 155, 19); });
    return { img: c, lit: lc };
  }
  function skyline(){
    seed = 77;
    const [c, g] = mk(640, 90), [lc, lg] = mk(640, 90);
    let x = 0;
    while (x < 640){ const w = 14 + Math.floor(rnd() * 26), h = 22 + Math.floor(rnd() * 58), col = rnd() < .5 ? '#241040' : '#1c0c33';
      g.fillStyle = col; g.fillRect(x, 90 - h, w, h);
      if (rnd() < .35){ g.fillRect(x + w / 2 - 1, 90 - h - 8, 2, 8); lg.fillStyle = '#ff4f6d'; lg.fillRect(x + w / 2 - 1, 90 - h - 9, 2, 2); }
      if (rnd() < .3){ g.fillRect(x + 3, 90 - h - 4, w - 6, 4); }
      for (let y = 90 - h + 4; y < 86; y += 5) for (let xx = x + 3; xx < x + w - 3; xx += 4) if (rnd() < .42){ lg.fillStyle = ['#ffcf7a', '#ff8ad8', '#8ef3ff', '#ffe9b0'][Math.floor(rnd() * 4)]; lg.fillRect(xx, y, 2, 2); }
      x += w + Math.floor(rnd() * 4); }
    for (let i = 0; i < 9; i++){ const px = 20 + i * 70 + Math.floor(rnd() * 30); g.fillStyle = '#120720';
      for (let y = 90; y > 46; y--) g.fillRect(px + Math.round(Math.sin((90 - y) / 18) * 4), y, 2, 1);
      [-2.8, -2.3, -1.8, -1.3, -.8, -.3].forEach(a => { for (let t = 0; t < 14; t++) g.fillRect(Math.round(px + 4 + Math.cos(a) * t), Math.round(46 + Math.sin(a) * t * .5 + t * t * .05), 2, 1); }); }
    return { img: c, lit: lc };
  }
  function rcBuildArt(){
    rcSpr = {
      back: RC_CARS.map(carBack), front: RC_CARS.map(carFront), civ: RC_CIV.map(carBack),
      palm: [palm(0), palm(1)], bld: [0, 1, 2, 3, 4, 5].map(building),
      sign: [sign('MOTEL', '#ff3da1'), sign('DINER', '#3ff0ff'), sign('CLUB', '#ffe14d'), sign('SURF', '#7dff8a')],
      bill: billboard(), lamp: lamp(), gantry: gantry(), sky: skyline()
    };
  }

  // ---- track ----
  const easeIn = (a, b, p) => a + (b - a) * p * p, easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + .5);
  function rcAddSeg(curve, y){
    const n = rcSeg.length, lastY = n ? rcSeg[n - 1].p2.world.y : 0;
    rcSeg.push({ i: n, curve, sprites: [], cars: [],
      p1: { world: { y: lastY, z: n * RC.segL }, camera: {}, screen: {} }, p2: { world: { y, z: (n + 1) * RC.segL }, camera: {}, screen: {} } });
  }
  function rcRoad(enter, hold, leave, curve, hill){
    const sy = rcSeg.length ? rcSeg[rcSeg.length - 1].p2.world.y : 0, ey = sy + hill * RC.segL, tot = enter + hold + leave;
    for (let n = 0; n < enter; n++) rcAddSeg(easeIn(0, curve, n / enter), easeInOut(sy, ey, n / tot));
    for (let n = 0; n < hold; n++) rcAddSeg(curve, easeInOut(sy, ey, (enter + n) / tot));
    for (let n = 0; n < leave; n++) rcAddSeg(easeInOut(curve, 0, n / leave), easeInOut(sy, ey, (enter + hold + n) / tot));
  }
  function rcBuildTrack(){
    rcSeg = []; seed = 1234;
    const R = rcRoad;
    R(10, 40, 10, 0, 0); R(25, 50, 25, 2, 0); R(20, 30, 20, 0, 10); R(25, 40, 25, -3, 0); R(20, 20, 20, 0, -10);
    R(25, 45, 25, 4, 20); R(20, 40, 20, -2, -20); R(15, 30, 15, 0, 0); R(25, 25, 25, -4, 15); R(25, 50, 25, 3, -15);
    R(20, 30, 20, 0, 25); R(20, 30, 20, 0, -25); R(25, 40, 25, -3, 0); R(25, 25, 25, 5, 10); R(20, 50, 20, -2, -10);
    R(15, 40, 15, 0, 0); R(25, 30, 25, 3, 0); R(20, 40, 20, 0, 0);
    rcTrack = rcSeg.length * RC.segL;
    const L = rcSeg.length;
    rcSeg.forEach(sg => {
      const z = sg.i / L; sg.zone = z < .28 ? 'beach' : z < .5 ? 'city' : z < .7 ? 'bridge' : z < .86 ? 'city' : 'beach';
      const add = (img, off, k, glow) => sg.sprites.push({ img, off, k, glow, hit: img === rcSpr.palm[0] || img === rcSpr.palm[1] ? .12 : img === rcSpr.lamp ? .2 : img === rcSpr.bill ? .5 : .9 });
      if (sg.zone === 'beach'){ if (sg.i % 7 === 0) add(rcSpr.palm[sg.i % 14 ? 0 : 1], -1.25 - rnd() * .2, 34); if (sg.i % 5 === 2) add(rcSpr.palm[1], 1.3 + rnd() * .5, 34); if (sg.i % 16 === 8) add(rcSpr.bld[(sg.i / 16 | 0) % 6], 2.2 + rnd() * .4, 55); if (sg.i % 90 === 45) add(rcSpr.bill, 1.5, 30); }
      if (sg.zone === 'city'){ if (sg.i % 9 === 0) add(rcSpr.bld[sg.i % 6], -1.7 - rnd() * .3, 55); if (sg.i % 9 === 4) add(rcSpr.bld[(sg.i + 3) % 6], 1.7 + rnd() * .3, 55);
        if (sg.i % 24 === 12) add(rcSpr.sign[(sg.i / 24 | 0) % 4], (sg.i % 48 < 24 ? -1 : 1) * 1.25, 27); if (sg.i % 18 === 9) add(rcSpr.palm[0], (sg.i % 36 < 18 ? 1 : -1) * 1.3, 30); }
      if (sg.zone === 'bridge'){ if (sg.i % 10 === 0) add(rcSpr.lamp, -1.12, 27); if (sg.i % 10 === 5) add(rcSpr.lamp, 1.12, 27); }
    });
    rcSeg[RC_LINE].sprites.push({ img: rcSpr.gantry, off: 0, k: 2 * RC.roadW * 1.25 / 300, gantry: true });
  }
  const RC_LINE = 30, RC_BACK = 12, RC_LAPS = 2;   // start/finish line segment, grid distance, laps
  const rcRaceLen = () => rcTrack * RC_LAPS + RC_BACK * RC.segL;
  const rcFind = z => rcSeg[Math.floor(z / RC.segL) % rcSeg.length];
  const rcWrap = z => ((z % rcTrack) + rcTrack) % rcTrack;
  const RC_MAX = RC.segL * 60;
  const rcMax = () => RC_MAX * RC_CARS[rcCar].top / 350;
  function rcStartRace(){
    if (!rcSpr){ rcBuildArt(); rcBuildTrack(); }
    rcSeg.forEach(sg => sg.cars = []);
    rcPos = RC_LINE * RC.segL - RC.pz - RC_BACK * RC.segL; rcLapShown = 1; rcX = 0; rcSpeed = 0; rcDist = 0; rcBump = 0; rcTime = 0; rcShake = 0; rcResult = null; rcPaused = false; rcCount = 3600;
    rcCars = []; rcRivals = [];
    const others = RC_CARS.map((c, i) => i).filter(i => i !== rcCar);
    others.forEach((ci, k) => { const d = RC.segL * (4 + k * 5); rcRivals.push(rcAddCar({ rear: rcSpr.back[ci], off: [-.5, .5][k % 2], z: rcWrap(rcPos + d + RC.pz), dist: d, speed: rcMax() * (.74 + k * .03), racer: true, k: 8.6 })); });
    for (let i = 0; i < 16; i++){ const z = RC.segL * (60 + i * (rcSeg.length - 80) / 16) + Math.random() * 1000; rcAddCar({ rear: rcSpr.civ[i % 4], off: [-.66, 0, .66][i % 3], z: rcWrap(z), dist: z, speed: rcMax() * (.32 + Math.random() * .12), k: 8.6 }); }
    state = 'rcCount'; rcT = 0;
  }
  function rcAddCar(car){ car.target = car.off; car.retarget = 1 + Math.random() * 3; rcCars.push(car); rcFind(car.z).cars.push(car); return car; }

  // ---- update ----
  const overlap = (x1, w1, x2, w2, pct) => { const h = (pct || 1) / 2; return !((x1 + w1 * h) < (x2 - w2 * h) || (x1 - w1 * h) > (x2 + w2 * h)); };
  const CAR_W = 84 * 8.6 / RC.roadW;
  function rcUpdate(dt){
    const s = Math.min(.05, dt / 1000), car = RC_CARS[rcCar], max = rcMax();
    if (state === 'rcCount'){
      const before = Math.ceil(rcCount / 1200); rcCount -= dt; const after = Math.ceil(rcCount / 1200);
      if (after !== before && after > 0) beep(440, .12); if (rcCount <= 0){ state = 'rcRace'; beep(880, .3); rcT = 0; }
      return;
    }
    if (state !== 'rcRace' || rcPaused) return;
    rcT += dt; rcTime += s;
    const pSeg = rcFind(rcPos + RC.pz), spd = rcSpeed / max, dx = s * (1.6 + car.grip * .22) * spd;
    rcPos = rcWrap(rcPos + s * rcSpeed); rcDist += s * rcSpeed;
    if (held.left) rcX -= dx; else if (held.right) rcX += dx;
    rcX -= dx * spd * pSeg.curve * (RC.centri + (5 - car.grip) * .04);
    rcSky += pSeg.curve * spd * s * 12;
    const gas = held.a || held.up || held.drop, brake = held.b || held.down;
    if (gas) rcSpeed += max / (6.2 - car.acc * .7) * s; else if (brake) rcSpeed -= max * s; else rcSpeed -= max / 5 * s;
    if (Math.abs(rcX) > 1 && rcSpeed > max / 4) rcSpeed -= max * .9 * s;
    if (rcBump > 0) rcBump -= dt;
    if (Math.abs(rcX) > 1 && rcBump <= 0){
      for (const sp of pSeg.sprites){
        if (sp.gantry) continue;
        const sw = (sp.img.img || sp.img).width * sp.k / RC.roadW, hw = sw * sp.hit;
        if (overlap(rcX, CAR_W, sp.off + sw / 2 * Math.sign(sp.off), hw)){
          rcSpeed = Math.min(rcSpeed, max / 4); rcX -= Math.sign(rcX) * .25; rcBump = 700; rcShake = 10; beep(140, .25, 'sawtooth', 60); break;
        }
      }
    }
    for (const c of pSeg.cars){
      if (rcSpeed > c.speed && overlap(rcX, CAR_W, c.off, CAR_W, .8)){ rcSpeed = Math.max(c.speed, rcSpeed * .55); rcPos = rcWrap(c.z - RC.pz - 30); rcX += rcX >= c.off ? .12 : -.12; rcShake = 8; beep(180, .15, 'square', 90); break; }
    }
    rcX = Math.max(-2.2, Math.min(2.2, rcX)); rcSpeed = Math.max(0, Math.min(max, rcSpeed));
    if (rcShake > 0) rcShake -= s * 60;
    rcCars.forEach(c => {
      const old = rcFind(c.z);
      c.retarget -= s; if (c.retarget <= 0){ c.target = [-.66, 0, .66][Math.floor(Math.random() * 3)]; c.retarget = 2 + Math.random() * 4; }
      c.off += Math.sign(c.target - c.off) * Math.min(Math.abs(c.target - c.off), .5 * s);
      const sp = c.racer ? c.speed * (1 - Math.abs(rcFind(c.z).curve) * .03) : c.speed;
      c.z = rcWrap(c.z + sp * s); c.dist += sp * s;
      const nw = rcFind(c.z); if (nw !== old){ old.cars.splice(old.cars.indexOf(c), 1); nw.cars.push(c); }
    });
    const lap = Math.min(RC_LAPS, 1 + Math.floor(Math.max(0, rcDist - RC_BACK * RC.segL) / rcTrack));
    if (lap > rcLapShown){ rcLapShown = lap; rcLapT = 1500; beep(990, .1); setTimeout(() => beep(1320, .15), 120); }
    if (rcLapT > 0) rcLapT -= dt;
    if (rcDist >= rcRaceLen()){
      const pos = rcPlace();
      rcResult = { pos, time: rcTime, best: !rcBest || rcTime < rcBest };
      if (rcResult.best){ rcBest = rcTime; try { localStorage.setItem('as-rc-best', rcBest.toFixed(2)); } catch(e){} }
      state = 'rcDone'; deadT = 0; beep(pos === 1 ? 1320 : 660, .3); setTimeout(() => beep(pos === 1 ? 1760 : 880, .3), 160);
    }
  }
  let rcLastGear = 1;
  function rcGear(f){ const g = f < .12 ? 1 : f < .28 ? 2 : f < .45 ? 3 : f < .62 ? 4 : f < .8 ? 5 : 6; if (g > rcLastGear && state === 'rcRace') beep(1500, .03); rcLastGear = g; return g; }
  const rcPlace = () => 1 + rcRivals.filter(r => r.dist > rcDist).length;
  const fmtT = t => { const m = Math.floor(t / 60), sec = t - m * 60; return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1); };

  // ---- drawing ----
  function rcProject(p, cx, cy, cz){
    p.camera.x = (p.world.x || 0) - cx; p.camera.y = p.world.y - cy; p.camera.z = p.world.z - cz;
    p.screen.scale = RC.depth / p.camera.z;
    p.screen.x = Math.round(RW / 2 + p.screen.scale * p.camera.x * RW / 2);
    p.screen.y = Math.round(RH / 2 - p.screen.scale * p.camera.y * RH / 2);
    p.screen.w = Math.round(p.screen.scale * RC.roadW * RW / 2);
  }
  function quad(g, x1, y1, w1, x2, y2, w2, col){
    g.fillStyle = col;
    for (let y = Math.max(0, y2); y < Math.min(RH, y1); y++){ const t = (y - y2) / (y1 - y2 || 1), x = x2 + (x1 - x2) * t, w = w2 + (w1 - w2) * t; g.fillRect(Math.round(x - w), y, Math.round(w * 2), 1); }
  }
  function rcPal(n){
    const m = (a, b) => rgb(mix(hex(a), hex(b), n));
    return {
      beach: [m('#efcf9f', '#5a3e55'), m('#e6c290', '#523850')], city: [m('#a9989e', '#2e2640'), m('#9f8e95', '#2a2239')],
      bridge: [m('#1fb7cc', '#0d3360'), m('#1aa8be', '#0b2e58')], road: [m('#4d4860', '#24203a'), m('#48435a', '#211d35')],
      rumble: [m('#f4f4f4', '#d8d8f0'), m('#ff3d7f', '#ff2d8a')], lane: m('#f4f4f4', '#bfc0ff'), edge: m('#e9e9e9', '#9a9ad0'),
      sea: [m('#2fc3d6', '#0f3765'), m('#27b4ca', '#0c315d')], foam: m('#ffffff', '#8fa7dd')
    };
  }
  // sky + sun + skyline (drawn in the 160x128 logical space, at 2x)
  function rcBackground(n){
    const top = mix(hex('#2a1268'), hex('#07031a'), n), mid = mix(hex('#e8508a'), hex('#2d0c55'), n), low = mix(hex('#ffab5c'), hex('#6a1a66'), n);
    for (let y = 0; y < 66; y++){ const u = y / 66; ctx.fillStyle = rgb(u < .6 ? mix(top, mid, u / .6) : mix(mid, low, (u - .6) / .4)); ctx.fillRect(0, y, W, 1); }
    if (n > .25) STARS.forEach(([x, y, k]) => { if (y < 40 && (Math.floor(tick / 25) + k) % 4){ ctx.fillStyle = rgb([255, 240, 255], Math.min(1, (n - .25) * 1.6)); ctx.fillRect(x, y, .5, .5); } });
    const sx = W / 2 - ((rcSky * .25) % 40), sy = 34 + n * 28;
    for (let y = -17; y <= 17; y += .5){
      if (y > 2 && ((y * 2) % 8 < 2 || ((y * 2) % 8 < 3 && y > 9))) continue;
      const half = Math.sqrt(Math.max(0, 289 - y * y)); if (sy + y > 64) continue;
      ctx.fillStyle = rgb(mix(hex('#fff27a'), hex('#ff3d9a'), (y + 17) / 34)); ctx.fillRect(sx - half, sy + y, half * 2, .5);
    }
    const g2 = ctx.createRadialGradient(sx, sy, 6, sx, sy, 40); g2.addColorStop(0, `rgba(255,190,120,${.35 * (1 - n)})`); g2.addColorStop(1, 'rgba(255,190,120,0)'); ctx.fillStyle = g2; ctx.fillRect(sx - 40, sy - 40, 80, 80);
    const so = ((rcSky * 6) % 320 + 320) % 320;
    ctx.drawImage(rcSpr.sky.img, -so, 21, 320, 45); ctx.drawImage(rcSpr.sky.img, 320 - so, 21, 320, 45);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + n * .75;
    ctx.drawImage(rcSpr.sky.lit, -so, 21, 320, 45); ctx.drawImage(rcSpr.sky.lit, 320 - so, 21, 320, 45);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgb(mix(hex('#ff9ad1'), hex('#2a0f45'), n)); ctx.fillRect(0, 64, W, 2);
  }
  function rcSprite(g, img, scale, x, y, k, ox, clip){
    const dw = img.width * k * scale * RW / 2, dh = img.height * k * scale * RW / 2;
    const dx = x + dw * ox, dy = y - dh;
    if (dw < 1 || dw > 1200) return;
    const clipH = clip ? Math.max(0, dy + dh - clip) : 0;
    if (clipH >= dh) return;
    const sh = img.height - img.height * clipH / dh;
    g.drawImage(img, 0, 0, img.width, sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh - clipH));
    return [dx, dy, dw, dh - clipH, sh];
  }
  function drawRace(){
    const n = Math.min(1, Math.max(0, rcDist / rcRaceLen() * 1.25 - .15)), P = rcPal(n);
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    rcBackground(n);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = rw; g.clearRect(0, 0, RW, RH); g.imageSmoothingEnabled = false;
    const base = rcFind(rcPos), basePct = (rcPos % RC.segL) / RC.segL, pSeg = rcFind(rcPos + RC.pz), pPct = ((rcPos + RC.pz) % RC.segL) / RC.segL;
    const playerY = pSeg.p1.world.y + (pSeg.p2.world.y - pSeg.p1.world.y) * pPct;
    let maxy = RH, x = 0, dx = -(base.curve * basePct);
    for (let i = 0; i < RC.draw; i++){
      const sg = rcSeg[(base.i + i) % rcSeg.length], looped = sg.i < base.i;
      sg.clip = maxy;
      rcProject(sg.p1, rcX * RC.roadW - x, playerY + RC.camH, rcPos - (looped ? rcTrack : 0));
      rcProject(sg.p2, rcX * RC.roadW - x - dx, playerY + RC.camH, rcPos - (looped ? rcTrack : 0));
      x += dx; dx += sg.curve;
      if (sg.p1.camera.z <= RC.depth || sg.p2.screen.y >= sg.p1.screen.y || sg.p2.screen.y >= maxy) continue;
      const a = sg.p1.screen, b = sg.p2.screen, alt = Math.floor(sg.i / 3) % 2;
      g.fillStyle = P[sg.zone][alt]; g.fillRect(0, b.y, RW, a.y - b.y);
      if (sg.zone === 'bridge' && sg.i % 4 === 0){ g.fillStyle = `rgba(255,255,255,${.18 + n * .1})`; for (let q = 0; q < 4; q++) g.fillRect(((sg.i * 53 + q * 97) % RW), b.y, 6 + q * 3, 1); }
      if (sg.zone === 'beach'){ const ea = a.x - a.w * 2.6, eb = b.x - b.w * 2.6;
        if (ea > 0 || eb > 0) quad(g, ea / 2, a.y, Math.max(0, ea / 2), eb / 2, b.y, Math.max(0, eb / 2), P.sea[alt]);
        quad(g, ea, a.y, a.w * .06, eb, b.y, b.w * .06, P.foam); }
      quad(g, a.x, a.y, a.w * 1.14, b.x, b.y, b.w * 1.14, P.rumble[alt]);
      if (sg.i === RC_LINE || sg.i === RC_LINE + 1){ quad(g, a.x, a.y, a.w, b.x, b.y, b.w, '#f4f4f4'); for (let q = -4; q < 4; q += 2) quad(g, a.x + a.w * (q + (sg.i % 2 ? 1.5 : .5)) / 4, a.y, a.w / 8, b.x + b.w * (q + (sg.i % 2 ? 1.5 : .5)) / 4, b.y, b.w / 8, '#141018'); }
      else {
        quad(g, a.x, a.y, a.w, b.x, b.y, b.w, P.road[alt]);
        for (const l of [-.93, .93]) quad(g, a.x + a.w * l, a.y, a.w * .015, b.x + b.w * l, b.y, b.w * .015, P.edge);
        if (alt) for (const l of [-1 / 3, 1 / 3]) quad(g, a.x + a.w * l * 2, a.y, a.w * .02, b.x + b.w * l * 2, b.y, b.w * .02, P.lane);
      }
      maxy = b.y;
    }
    const lits = [], tails = [];
    for (let i = RC.draw - 1; i > 0; i--){
      const sg = rcSeg[(base.i + i) % rcSeg.length];
      if (!sg.p1.screen.scale || sg.p1.camera.z <= RC.depth) continue;
      sg.sprites.forEach(sp => {
        const im = sp.img.img || sp.img;
        const r = rcSprite(g, im, sg.p1.screen.scale, sg.p1.screen.x + sg.p1.screen.scale * sp.off * RC.roadW * RW / 2, sg.p1.screen.y, sp.k, sp.off < 0 ? -1 : sp.gantry ? -.5 : 0, sg.clip);
        if (r && sp.img.lit) lits.push([sp.img.lit, r]);
      });
      sg.cars.forEach(c => {
        const pct = (c.z % RC.segL) / RC.segL, sc = sg.p1.screen.scale + (sg.p2.screen.scale - sg.p1.screen.scale) * pct;
        const cx = sg.p1.screen.x + (sg.p2.screen.x - sg.p1.screen.x) * pct + sc * c.off * RC.roadW * RW / 2;
        const cy = sg.p1.screen.y + (sg.p2.screen.y - sg.p1.screen.y) * pct;
        const r = rcSprite(g, c.rear, sc, cx, cy, c.k, -.5, sg.clip);
        if (r) tails.push(r);
      });
    }
    // dusk/night tint over the world
    if (n > .02){ g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(24,6,52,${n * .5})`; g.fillRect(0, 0, RW, RH); g.globalCompositeOperation = 'source-over'; }
    // lights glowing through: windows, neon, lamps, billboards, tail lights
    const glowA = .06 + Math.pow(n, .8) * .8;   // lights barely show in daylight, full at night
    g.globalCompositeOperation = 'lighter';
    lits.forEach(([lit, [dx0, dy0, dw, dh, sh]]) => {
      g.globalAlpha = glowA; g.drawImage(lit, 0, 0, lit.width, sh, Math.round(dx0), Math.round(dy0), Math.round(dw), Math.round(dh));
      if (n > .45 && dw > 12){ g.globalAlpha = (n - .45) * .25; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(lit, 0, 0, lit.width, sh, Math.round(dx0) + ox, Math.round(dy0) + oy, Math.round(dw), Math.round(dh)); }
    });
    if (n > .3) tails.forEach(([dx0, dy0, dw, dh]) => { g.globalAlpha = (n - .3) * .7; g.fillStyle = '#ff2050'; g.fillRect(Math.round(dx0), Math.round(dy0 + dh * .5), Math.round(dw * .3), Math.max(1, Math.round(dh * .14))); g.fillRect(Math.round(dx0 + dw * .7), Math.round(dy0 + dh * .5), Math.round(dw * .3), Math.max(1, Math.round(dh * .14))); });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const shk = rcShake > 0 ? Math.round(Math.random() * 4 - 2) : 0;
    ctx.drawImage(rwC, shk, 0);
    // player car: always seen from behind and a little above (native 2x art)
    const spd = rcSpeed / rcMax();
    const bounce = state === 'rcRace' && spd > .15 && (tick % 6 < 3) ? 1 : 0;
    const pImg = rcSpr.back[rcCar], px0 = Math.round(RW / 2 - pImg.width / 2), py0 = RH - pImg.height - 4 - bounce;
    ctx.fillStyle = 'rgba(8,0,18,.4)'; ctx.beginPath(); ctx.ellipse(RW / 2, RH - 6, 42, 5, 0, 0, 7); ctx.fill();
    ctx.drawImage(pImg, px0, py0);
    const braking = state === 'rcRace' && (held.b || held.down);
    if (n > .25 || braking){ ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = braking ? .8 : (n - .25) * .7;
      const gl = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
      gl.addColorStop(0, 'rgba(255,60,90,1)'); gl.addColorStop(1, 'rgba(255,60,90,0)');
      [[px0 + 20, py0 + 31], [px0 + pImg.width - 20, py0 + 31]].forEach(([gx, gy]) => { ctx.save(); ctx.translate(gx, gy); ctx.fillStyle = gl; ctx.fillRect(-14, -14, 28, 28); ctx.restore(); });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if ((held.a || held.up || held.drop) && state === 'rcRace' && tick % 4 < 2){ ctx.fillStyle = '#ffb347'; ctx.fillRect(px0 + 29, py0 + 46, 4, 2); ctx.fillRect(px0 + 52, py0 + 46, 4, 2); }
    // HUD and effects in the logical 160x128 space
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    if (spd > .8 && state === 'rcRace'){ ctx.fillStyle = `rgba(255,255,255,${(spd - .8) * 1.6})`; for (let i = 0; i < 6; i++){ const yy = 70 + ((i * 23 + tick * 7) % 55), xx = (i % 2) ? 4 + (tick * 3 + i * 9) % 14 : W - 18 + (tick * 3 + i * 9) % 14; ctx.fillRect(xx, yy, .5, 6); } }
    rcHud();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function shadowText(str, x, y, col, sc){ text(ctx, str, x + 1, y + 1, '#1a0a2a', sc); text(ctx, str, x, y, col, sc); }
  function rcHud(){
    const pos = rcPlace(), max = rcMax();
    // progress bar with rivals
    ctx.fillStyle = 'rgba(20,8,40,.6)'; ctx.fillRect(40, 3, 80, 4); ctx.fillStyle = '#ff4fa3'; ctx.fillRect(40, 3, Math.round(80 * Math.min(1, rcDist / rcRaceLen())), 4);
    rcRivals.forEach(r => { ctx.fillStyle = '#3ff0ff'; ctx.fillRect(40 + Math.round(79 * Math.min(1, r.dist / rcRaceLen())), 2, 1, 6); });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(40 + Math.round(79 * Math.min(1, rcDist / rcRaceLen())), 1, 1, 8);
    shadowText('POS', 4, 3, '#ffd1f0'); shadowText(String(pos), 4, 11, pos === 1 ? '#ffd54a' : '#ffffff', 2); shadowText('/6', 17, 17, '#ffd1f0');
    const t = fmtT(rcTime); shadowText(t, W - 4 - width(t), 3, '#ffffff');
    const lp = 'LAP ' + rcLapShown + '/' + RC_LAPS; shadowText(lp, W - 4 - width(lp), 12, '#ffd1f0');
    if (rcLapT > 0 && Math.floor(rcLapT / 150) % 2 === 0) otext('FINAL LAP', 80, 34, 2, '#ffffff', '#1a0a2a', '#ffe14d');
    // analog speedometer + gear, bottom-left
    const frac = rcSpeed / max, kmh = String(Math.round(frac * RC_CARS[rcCar].top)), gear = rcGear(frac);
    const cx = 21, cy = H - 5, R = 17;
    ctx.fillStyle = 'rgba(20,8,40,.72)'; for (let y = -R - 2; y <= 3; y++){ const hw = Math.round(Math.sqrt(Math.max(0, (R + 2) ** 2 - y * y))); ctx.fillRect(cx - hw, cy + y, hw * 2, 1); }
    for (let i = 0; i <= 12; i++){ const a = Math.PI + i / 12 * Math.PI, r1 = i % 2 ? R - 2 : R - 4;
      ctx.fillStyle = i >= 10 ? '#ff3d6e' : '#ffd1f0';
      for (let r = r1; r <= R; r++) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
    const na = Math.PI + Math.min(1, frac) * Math.PI;
    ctx.fillStyle = '#3ff0ff'; for (let r = 0; r < R - 3; r++) ctx.fillRect(Math.round(cx + Math.cos(na) * r), Math.round(cy + Math.sin(na) * r), 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy - 1, 3, 3);
    shadowText('G' + gear, cx - 5, cy - 11, '#ffe14d');
    // digital speed above the dial (kept clear of the car)
    shadowText(kmh, 4, H - 40, '#ffffff', 2); shadowText('KM/H', 6 + width(kmh, 2), H - 34, '#3ff0ff');
    if (state === 'rcCount'){
      const c = Math.ceil(rcCount / 1200), label = c > 0 ? String(c) : 'GO!';
      otext(label, 80, 44, 4, '#ffffff', '#1a0a2a', c > 0 ? '#ff4fa3' : '#7dff8a');
    } else if (state === 'rcRace' && rcT < 700){ otext('GO!', 80, 44, 4, '#ffffff', '#1a0a2a', '#7dff8a'); }
    if (rcPaused){ ctx.fillStyle = 'rgba(20,8,40,.75)'; ctx.fillRect(0, 40, W, 40); otext('PAUSED', 80, 48, 2, '#ffffff', '#1a0a2a', '#3ff0ff'); center(ctx, 'SELECT FOR MENU', 68, '#ffd1f0'); }
  }
  function neonGrid(y0, scroll, n){
    ctx.fillStyle = rgb(mix(hex('#2a0d4a'), hex('#12052a'), n || 0)); ctx.fillRect(0, y0, W, H - y0);
    ctx.fillStyle = 'rgba(255,61,154,.75)';
    for (let i = 0; i < 9; i++){ const t = ((i + (scroll % 1)) / 9), y = Math.round(y0 + (H - y0) * t * t); ctx.fillRect(0, y, W, 1); }
    for (let i = -8; i <= 8; i++){ for (let y = y0; y < H; y++){ const t = (y - y0) / (H - y0), x = Math.round(W / 2 + i * (6 + t * 22)); ctx.fillRect(x, y, 1, 1); } }
    ctx.fillStyle = '#ff9ad1'; ctx.fillRect(0, y0, W, 1);
  }
  function drawRcTitle(){
    rcT += 16;
    rcBackground(.15);
    neonGrid(66, rcT / 400);
    // palms framing the scene
    ctx.drawImage(rcSpr.palm[0], -12, 22, 54, 80); ctx.drawImage(rcSpr.palm[1], W - 42, 18, 54, 80);
    const drop = rcT < 600 ? Math.round(-36 * Math.pow(1 - rcT / 600, 2)) : 0;
    otext('NEON', 80, 7 + drop, 3, '#ffe1f5', '#1a0a2a', '#ff4fa3');
    otext('COAST', 80, 30 + drop, 3, '#e1fbff', '#1a0a2a', '#39d8ff');
    const sub = 'STREET RACER', sxp = Math.round(80 - width(sub) / 2);
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) text(ctx, sub, sxp + dx, 55 + dy, '#1a0a2a');
    text(ctx, sub, sxp, 55, '#ffe14d');
    const car = rcSpr.front[rcCar], cb = Math.floor(rcT / 160) % 2 * .5;
    ctx.fillStyle = 'rgba(10,0,20,.45)'; ctx.beginPath(); ctx.ellipse(80, 125, 40, 3, 0, 0, 7); ctx.fill();
    ctx.drawImage(car, 80 - car.width / 2, 78 - cb, car.width, car.height);
    if (Math.floor(rcT / 900) % 3 === 0){ ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,240,190,.35)'; ctx.fillRect(80 - 38, 90 - cb, 18, 6); ctx.fillRect(80 + 20, 90 - cb, 18, 6); ctx.globalCompositeOperation = 'source-over'; }
    if (Math.floor(rcT / 500) % 2 === 0){ const t = 'PRESS START', px2 = Math.round(80 - width(t) / 2); ctx.fillStyle = 'rgba(26,10,42,.8)'; ctx.fillRect(px2 - 6, 66, width(t) + 12, 12); text(ctx, t, px2, 69, '#ffffff'); }
    if (rcBest){ const t = 'BEST ' + fmtT(rcBest); shadowText(t, W - 4 - width(t), H - 9, '#ffe14d'); }
  }
  function pips(x, y, v, col){ for (let i = 0; i < 5; i++){ ctx.fillStyle = i < v ? col : 'rgba(255,255,255,.18)'; ctx.fillRect(x + i * 9, y, 7, 5); } }
  function drawRcSelect(){
    rcT += 16;
    ctx.fillStyle = '#140a26'; ctx.fillRect(0, 0, W, H);
    neonGrid(70, rcT / 600, .5);
    const hd = 'CHOOSE YOUR RIDE'; shadowText(hd, Math.round(80 - width(hd) / 2), 5, '#ff4fa3');
    ctx.fillStyle = '#ff4fa3'; ctx.fillRect(30, 14, 100, 1);
    const car = RC_CARS[rcCar], side = rcSpr.front[rcCar];
    // glowing podium
    for (let y = -4; y <= 4; y++){ const hw = Math.round(Math.sqrt(1 - (y / 5) ** 2) * 44); ctx.fillStyle = y < 0 ? 'rgba(57,216,255,.25)' : 'rgba(57,216,255,.45)'; ctx.fillRect(80 - hw, 58 + y, hw * 2, 1); }
    const bob = Math.round(Math.sin(rcT / 300));
    ctx.drawImage(side, 80 - side.width / 2, 20 + bob * .5, side.width, side.height);
    if (Math.floor(rcT / 400) % 2 === 0){ shadowText('<', 6, 36, '#ffffff', 2); shadowText('>', W - 15, 36, '#ffffff', 2); }
    otext(car.name, 80, 64, 2, '#ffffff', '#1a0a2a', car.hi);
    [['SPEED', car.spd], ['ACCEL', car.acc], ['GRIP', car.grip]].forEach(([l, v], i) => { shadowText(l, 28, 86 + i * 9, '#ffd1f0'); pips(72, 86 + i * 9, v, car.c === '#eef3f6' ? '#3ff0ff' : car.c); });
    for (let i = 0; i < 5; i++){ ctx.fillStyle = i === rcCar ? '#ffffff' : 'rgba(255,255,255,.3)'; ctx.fillRect(68 + i * 5, 114, 3, 3); }
    shadowText('A:GO', 6, 119, '#7dff8a'); shadowText('B:BACK', W - 6 - width('B:BACK'), 119, '#ffd1f0');
  }
  function drawRcDone(){
    drawRace();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    deadT++;
    for (let y = 18; y < 108; y++){ const e = Math.min(1, Math.min(y - 18, 108 - y) / 10); ctx.fillStyle = `rgba(20,6,40,${.82 * e})`; ctx.fillRect(0, y, W, 1); }
    const r = rcResult, drop = deadT < 30 ? Math.round(-30 * Math.pow(1 - deadT / 30, 2)) : 0;
    otext('FINISH!', 80, 22 + drop, 2, '#ffffff', '#1a0a2a', '#ff4fa3');
    const ord = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'][r.pos - 1], col = r.pos === 1 ? '#ffd54a' : r.pos === 2 ? '#dfe6ee' : r.pos === 3 ? '#e09a5a' : '#ffffff';
    otext(ord + ' PLACE', 80, 42, 2, col, '#1a0a2a');
    const t = 'TIME ' + fmtT(r.time); shadowText(t, Math.round(80 - width(t) / 2), 62, '#ffffff');
    if (r.best && Math.floor(tick / 15) % 2 === 0){ const b = 'NEW BEST!', bx = Math.round(80 - width(b) / 2); ctx.fillStyle = '#ffd54a'; ctx.fillRect(bx - 4, 72, width(b) + 8, 11); text(ctx, b, bx, 74, '#1a0a2a'); }
    else if (!r.best){ const b = 'BEST ' + fmtT(rcBest); shadowText(b, Math.round(80 - width(b) / 2), 74, '#cfc3d6'); }
    if (deadT > 30){ pill(26, 90, 52, 'A RETRY', '#3fae5a'); pill(84, 90, 52, 'B MENU', '#5b6380'); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function drawRacer(){
    if (!rwC){ [rwC, rw] = mk(RW, RH); }
    ctx.imageSmoothingEnabled = false;
    if (state === 'rcRace' || state === 'rcCount'){ drawRace(); return; }
    if (state === 'rcDone'){ drawRcDone(); return; }
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    if (state === 'rcTitle') drawRcTitle(); else drawRcSelect();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  let rwC = null, rw = null;
  function rcOpen(){ if (!rcSpr){ rcBuildArt(); rcBuildTrack(); } state = 'rcTitle'; rcT = 0; }

  // ---------- input ----------
  const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  const held = {};   // buttons currently held down (for steering and the gas pedal)
  function press(k){
    startBtn.classList.remove('hint'); idle = 0;
    if (state === 'boot'){
      if (k === 'start' || k === 'a' || k === 'screen'){ state = 'menu'; beep(660, .08); beep(990, .12); }
      return;
    }
    if (state === 'menu'){
      if (k === 'up' || k === 'left'){ menuI = (menuI + MENU.length - 1) % MENU.length; beep(520, .04); }
      else if (k === 'down' || k === 'right' || k === 'select'){ menuI = (menuI + 1) % MENU.length; beep(520, .04); }
      else if (k === 'a' || k === 'start' || k === 'screen'){ beep(780, .08); MENU[menuI].act(); }
      else if (k === 'b'){ state = 'boot'; beep(300, .06); }
      return;
    }
    if (state === 'snake'){
      if (DIRS[k]){ turn(DIRS[k]); }
      else if (k === 'start' || k === 'screen'){ paused = !paused; beep(paused ? 400 : 600, .06); }
      else if (k === 'b'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'rcTitle'){
      if (k === 'start' || k === 'a' || k === 'screen'){ state = 'rcSelect'; rcT = 0; beep(780, .08); }
      else if (k === 'b'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'rcSelect'){
      if (k === 'left' || k === 'up'){ rcCar = (rcCar + RC_CARS.length - 1) % RC_CARS.length; beep(520, .05); }
      else if (k === 'right' || k === 'down' || k === 'select'){ rcCar = (rcCar + 1) % RC_CARS.length; beep(520, .05); }
      else if (k === 'a' || k === 'start' || k === 'screen'){ beep(880, .1); rcStartRace(); }
      else if (k === 'b'){ state = 'rcTitle'; rcT = 600; beep(300, .06); }
      return;
    }
    if (state === 'rcRace' || state === 'rcCount'){
      if (k === 'start'){ rcPaused = !rcPaused; beep(rcPaused ? 400 : 600, .06); }
      else if (k === 'select' && rcPaused){ state = 'menu'; rcPaused = false; beep(300, .06); }
      return;
    }
    if (state === 'rcDone'){
      if (deadT < 30) return;
      if (k === 'a' || k === 'start' || k === 'screen'){ rcStartRace(); }
      else if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'run'){
      if (k === 'a' || k === 'up' || k === 'screen' || k === 'drop'){ if (rPaused) return; rJump(); return; }
      if (k === 'start'){ if (!rStarted) { rJump(); return; } rPaused = !rPaused; beep(rPaused ? 400 : 600, .06); return; }
      if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'rover'){
      if (deadT < 30) return;
      if (k === 'a' || k === 'start' || k === 'screen' || k === 'up'){ startRun(); rStarted = true; rJump(); }
      else if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'tetris'){
      if (k === 'start' || k === 'screen'){ tPaused = !tPaused; beep(tPaused ? 400 : 600, .06); return; }
      if (k === 'select'){ state = 'menu'; beep(300, .06); return; }
      if (tPaused){ if (k === 'b'){ state = 'menu'; beep(300, .06); } return; }
      if (clearing) return;
      if (k === 'left') move(-1); else if (k === 'right') move(1);
      else if (k === 'down') hardDrop();
      else if (k === 'up' || k === 'a') rotate(1);
      else if (k === 'b') rotate(-1);
      else if (k === 'drop') hardDrop();
      return;
    }
    if (state === 'tover'){
      if (deadT < 20) return;
      if (k === 'a' || k === 'start' || k === 'screen'){ startTetris(); beep(660, .08); }
      else if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'over'){
      if (deadT < 20) return;
      if (k === 'a' || k === 'start' || k === 'screen'){ startSnake(); beep(660, .08); }
      else if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
    }
  }

  // on-screen buttons (pointer events so they work for mouse and touch)
  consoleEl.querySelectorAll('.btn').forEach(b => {
    const k = b.dataset.k;
    let rep = null, rep2 = null;
    const down = e => {
      e.preventDefault(); b.classList.add('on'); held[k] = true; press(k);
      if (!DIRS[k] || (state !== 'snake' && state !== 'tetris')) beep(240, .025);
      if (DIRS[k] && k !== 'up' && k !== 'down') rep = setTimeout(() => { rep2 = setInterval(() => { if (state === 'tetris') press(k); }, 65); }, 190);
    };
    const up = () => { b.classList.remove('on'); held[k] = false; clearTimeout(rep); clearInterval(rep2); };
    b.addEventListener('pointerdown', down);
    ['pointerup','pointerleave','pointercancel'].forEach(t => b.addEventListener(t, up));
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); b.classList.add('on'); press(k); setTimeout(up, 120); } });
  });
  const screen = document.getElementById('screen');
  screen.addEventListener('pointerdown', e => { if (state === 'run' || state === 'rover'){ e.preventDefault(); press('screen'); } });
  screen.addEventListener('click', () => { if (state === 'run' || state === 'rover') return; if (state === 'rcTitle' || state === 'rcSelect' || state === 'rcDone'){ press('screen'); return; } if (state === 'rcRace' || state === 'rcCount') return; if ((state !== 'snake' && state !== 'tetris') || (state === 'snake' && paused) || (state === 'tetris' && tPaused)) press('screen'); });

  // swipe on the screen for phones
  let sx = 0, sy = 0;
  screen.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
  screen.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  // keyboard: only grabs arrow keys while the console is on screen and in use
  const KEYMAP = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', s:'down', a:'left', d:'right',
                   Enter:'start', ' ':'drop', z:'a', k:'a', x:'b', j:'b', Escape:'b', Shift:'select' };
  let onScreen = true;
  new IntersectionObserver(es => es.forEach(e => onScreen = e.intersectionRatio > .45), { threshold:[0,.45,1] }).observe(consoleEl);
  const flash = { up:'.b-up', down:'.b-down', left:'.b-left', right:'.b-right', a:'.b-a', b:'.b-b', start:'.b-start', select:'.b-select' };
  window.addEventListener('keydown', e => {
    if (!onScreen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('.btn, a, button:not(.btn)') && (e.key === 'Enter' || e.key === ' ')) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase && e.key.toLowerCase()];
    if (!k) return;
    // let arrows scroll the page while the console is just sitting on the title screen
    held[k] = true;
    if ((state === 'boot' || state === 'menu' || state === 'msg') && k === 'drop') return;
    if (e.repeat && state === 'tetris' && (k === 'down' || k === 'drop')) { e.preventDefault(); return; }
    if (state === 'boot' && DIRS[k]) return;
    e.preventDefault();
    const el = consoleEl.querySelector(flash[k]); if (el){ el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 110); }
    press(k);
  });

  window.addEventListener('keyup', e => { const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase && e.key.toLowerCase()]; if (k) held[k] = false; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
  // ---------- drawing ----------
  const APPLE = ['..g.....','...g....','.rrrrr..','rrrrrrr.','rrrrrrr.','rrrrrrr.','.rrrrr..','........'];
  function sprite(rows, x, y){
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++){
      if (r[i] === '.') continue; ctx.fillStyle = r[i] === 'r' ? C.red : C.leaf; ctx.fillRect(x+i, y+j, 1, 1);
    }});
  }
  function frame(){
    const hi = state.startsWith('rc') ? 2 : 1;
    if (cv.width !== 160 * hi){ cv.width = 160 * hi; cv.height = 128 * hi; }
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (state === 'boot'){
      bootT++;
      if (bootT < 70){
        const p = Math.min(1, bootT / 60);
        center(ctx, 'LOADING', 50, C.mid);
        ctx.fillStyle = C.dim; ctx.fillRect(40, 64, 80, 6);
        ctx.fillStyle = C.ink; ctx.fillRect(41, 65, Math.floor(78 * p / 6) * 6, 4);
        return;
      }
      center(ctx, 'ALWIN.OS', 28, C.ink, 2);
      center(ctx, 'PORTFOLIO EDITION', 50, C.mid);
      // tiny pixel heart row
      for (let i = 0; i < 3; i++) text(ctx, '*', 66 + i * 10, 66, i === 1 ? C.red : C.dim);
      if (Math.floor(tick / 28) % 2 === 0) center(ctx, 'PRESS START', 92, C.ink);
      center(ctx, 'OR CLICK THE SCREEN', 108, C.dim);
      return;
    }
    if (state === 'menu' || state === 'msg'){
      center(ctx, 'SELECT A GAME', 10, C.mid);
      ctx.fillStyle = C.dim; ctx.fillRect(10, 21, 140, 1);
      MENU.forEach((m, i) => {
        const y = 32 + i * 19, sel = i === menuI;
        if (sel){ ctx.fillStyle = C.ink; ctx.fillRect(14, y - 5, 132, 16); }
        text(ctx, m.label, 32, y, sel ? C.bg : C.ink);
        if (sel && Math.floor(tick / 14) % 2 === 0) text(ctx, '>', 20, y, C.bg);
      });
      text(ctx, 'A:OK', 12, 114, C.mid); const t = 'B:BACK'; text(ctx, t, W - 12 - width(t), 114, C.mid);
      if (state === 'msg'){
        msgT++;
        ctx.fillStyle = C.bg; ctx.fillRect(12, 44, 136, 40); ctx.fillStyle = C.ink;
        ctx.fillRect(12, 44, 136, 1); ctx.fillRect(12, 83, 136, 1); ctx.fillRect(12, 44, 1, 40); ctx.fillRect(147, 44, 1, 40);
        center(ctx, msg + '.'.repeat(Math.floor(msgT / 8) % 4), 60, C.ink);
      }
      return;
    }
    if (state === 'tetris' || state === 'tover'){ drawTetris(); return; }
    if (state === 'run' || state === 'rover'){ drawRun(); return; }
    if (state.startsWith('rc')){ drawRacer(); return; }
    // snake and game over share the board
    text(ctx, 'SCORE ' + score, 4, 4, C.ink);
    const hs = 'HI ' + Math.max(hi, score); text(ctx, hs, W - 4 - width(hs), 4, C.mid);
    ctx.fillStyle = C.dim; ctx.fillRect(0, OY - 2, W, 1);
    for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++){ ctx.fillStyle = '#151912'; ctx.fillRect(x*CELL+3, OY+y*CELL+3, 2, 2); }
    sprite(APPLE, food.x*CELL, OY + food.y*CELL);
    snake.forEach((s, i) => {
      ctx.fillStyle = C.ink; ctx.fillRect(s.x*CELL, OY+s.y*CELL, CELL-1, CELL-1);
      if (i === 0){ // eyes
        ctx.fillStyle = C.bg;
        const ex = dir.x === 0 ? [1,4] : (dir.x > 0 ? [4,4] : [1,1]);
        const ey = dir.y === 0 ? [1,4] : (dir.y > 0 ? [4,4] : [1,1]);
        ctx.fillRect(s.x*CELL+ex[0], OY+s.y*CELL+ey[0], 2, 2); ctx.fillRect(s.x*CELL+ex[1], OY+s.y*CELL+ey[1], 2, 2);
      }
    });
    if (state === 'snake' && ready > 0){
      center(ctx, ready > 30 ? '3' : ready > 15 ? '2' : '1', 56, C.red, 2);
    }
    if (state === 'snake' && paused){ box(); center(ctx, 'PAUSED', 56, C.ink, 2); center(ctx, 'START TO GO', 76, C.mid); }
    if (state === 'rcTitle'){
      if (k === 'start' || k === 'a' || k === 'screen'){ state = 'rcSelect'; rcT = 0; beep(780, .08); }
      else if (k === 'b'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'rcSelect'){
      if (k === 'left' || k === 'up'){ rcCar = (rcCar + RC_CARS.length - 1) % RC_CARS.length; beep(520, .05); }
      else if (k === 'right' || k === 'down' || k === 'select'){ rcCar = (rcCar + 1) % RC_CARS.length; beep(520, .05); }
      else if (k === 'a' || k === 'start' || k === 'screen'){ beep(880, .1); rcStartRace(); }
      else if (k === 'b'){ state = 'rcTitle'; rcT = 600; beep(300, .06); }
      return;
    }
    if (state === 'rcRace' || state === 'rcCount'){
      if (k === 'start'){ rcPaused = !rcPaused; beep(rcPaused ? 400 : 600, .06); }
      else if (k === 'select' && rcPaused){ state = 'menu'; rcPaused = false; beep(300, .06); }
      return;
    }
    if (state === 'rcDone'){
      if (deadT < 30) return;
      if (k === 'a' || k === 'start' || k === 'screen'){ rcStartRace(); }
      else if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'run'){
      if (k === 'a' || k === 'up' || k === 'screen' || k === 'drop'){ if (rPaused) return; rJump(); return; }
      if (k === 'start'){ if (!rStarted) { rJump(); return; } rPaused = !rPaused; beep(rPaused ? 400 : 600, .06); return; }
      if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'rover'){
      if (deadT < 30) return;
      if (k === 'a' || k === 'start' || k === 'screen' || k === 'up'){ startRun(); rStarted = true; rJump(); }
      else if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'tetris'){
      if (k === 'start' || k === 'screen'){ tPaused = !tPaused; beep(tPaused ? 400 : 600, .06); return; }
      if (k === 'select'){ state = 'menu'; beep(300, .06); return; }
      if (tPaused){ if (k === 'b'){ state = 'menu'; beep(300, .06); } return; }
      if (clearing) return;
      if (k === 'left') move(-1); else if (k === 'right') move(1);
      else if (k === 'down') hardDrop();
      else if (k === 'up' || k === 'a') rotate(1);
      else if (k === 'b') rotate(-1);
      else if (k === 'drop') hardDrop();
      return;
    }
    if (state === 'tover'){
      if (deadT < 20) return;
      if (k === 'a' || k === 'start' || k === 'screen'){ startTetris(); beep(660, .08); }
      else if (k === 'b' || k === 'select'){ state = 'menu'; beep(300, .06); }
      return;
    }
    if (state === 'over'){
      deadT++; box();
      center(ctx, 'GAME OVER', 44, C.red, 2);
      center(ctx, 'SCORE ' + score + (score && score >= hi ? ' NEW HI!' : ''), 66, C.ink);
      if (deadT > 20) center(ctx, 'A:RETRY  B:MENU', 82, C.mid);
    }
  }
  function box(){ ctx.fillStyle = 'rgba(13,15,11,.86)'; ctx.fillRect(8, 34, 144, 62); ctx.fillStyle = C.ink; ctx.fillRect(8,34,144,1); ctx.fillRect(8,95,144,1); }

  // ---------- loop ----------
  let idle = 0;
  function loop(t){
    const dt = Math.min(100, t - (last || t)); last = t; tick++;
    if (state === 'snake' && !paused){
      if (ready > 0) ready--;
      else { acc += dt; while (acc >= stepMs && state === 'snake'){ acc -= stepMs; step(); } }
    }
    if (state === 'tetris' && !tPaused) tetrisTick(dt);
    if (state === 'rcRace' || state === 'rcCount') rcUpdate(dt);
    if ((state === 'run' && !rPaused) || state === 'rover') envTick(state === 'rover' ? dt * .25 : dt);
    if (state === 'run' && !rPaused) runTick(dt);
    if (state === 'boot' && ++idle === 300) startBtn.classList.add('hint');
    frame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
