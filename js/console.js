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
    { label:'PLAY TETRIS', act:() => startTetris() }
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

  // ---------- input ----------
  const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
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
      e.preventDefault(); b.classList.add('on'); press(k);
      if (!DIRS[k] || (state !== 'snake' && state !== 'tetris')) beep(240, .025);
      if (DIRS[k] && k !== 'up' && k !== 'down') rep = setTimeout(() => { rep2 = setInterval(() => { if (state === 'tetris') press(k); }, 65); }, 190);
    };
    const up = () => { b.classList.remove('on'); clearTimeout(rep); clearInterval(rep2); };
    b.addEventListener('pointerdown', down);
    ['pointerup','pointerleave','pointercancel'].forEach(t => b.addEventListener(t, up));
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); b.classList.add('on'); press(k); setTimeout(up, 120); } });
  });
  const screen = document.getElementById('screen');
  screen.addEventListener('pointerdown', e => { if (state === 'run' || state === 'rover'){ e.preventDefault(); press('screen'); } });
  screen.addEventListener('click', () => { if (state === 'run' || state === 'rover') return; if ((state !== 'snake' && state !== 'tetris') || (state === 'snake' && paused) || (state === 'tetris' && tPaused)) press('screen'); });

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
    if ((state === 'boot' || state === 'menu' || state === 'msg') && k === 'drop') return;
    if (e.repeat && state === 'tetris' && (k === 'down' || k === 'drop')) { e.preventDefault(); return; }
    if (state === 'boot' && DIRS[k]) return;
    e.preventDefault();
    const el = consoleEl.querySelector(flash[k]); if (el){ el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 110); }
    press(k);
  });

  // ---------- drawing ----------
  const APPLE = ['..g.....','...g....','.rrrrr..','rrrrrrr.','rrrrrrr.','rrrrrrr.','.rrrrr..','........'];
  function sprite(rows, x, y){
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++){
      if (r[i] === '.') continue; ctx.fillStyle = r[i] === 'r' ? C.red : C.leaf; ctx.fillRect(x+i, y+j, 1, 1);
    }});
  }
  function frame(){
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
        const y = 38 + i * 22, sel = i === menuI;
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
    if ((state === 'run' && !rPaused) || state === 'rover') envTick(state === 'rover' ? dt * .25 : dt);
    if (state === 'run' && !rPaused) runTick(dt);
    if (state === 'boot' && ++idle === 300) startBtn.classList.add('hint');
    frame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
