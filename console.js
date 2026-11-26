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
    { label:'VIEW WORK', act:() => jump('#work', 'LOADING WORK') },
    { label:'ABOUT ME', act:() => jump('#about', 'LOADING PROFILE') },
    { label:'SAY HELLO', act:() => jump('#contact', 'OPENING CHAT') }
  ];
  let hi = 0, thi = 0, rhi = 0; try { hi = +localStorage.getItem('as-snake-hi') || 0; thi = +localStorage.getItem('as-tetris-hi') || 0; rhi = +localStorage.getItem('as-run-hi') || 0; } catch(e){}

  function jump(sel, m){
    state = 'msg'; msg = m; msgT = 0;
    setTimeout(() => { document.querySelector(sel).scrollIntoView({ behavior:'smooth' }); state = 'menu'; }, 650);
  }

  // ---------- snake ----------
  const CELL = 8, GX = 20, GY = 14, OY = 16;
  let snake, dir, queue, food, score, stepMs, acc, last, paused, deadT, ready;
  function startSnake(){
    snake = [{x:6,y:7},{x:5,y:7},{x:4,y:7}]; dir = {x:1,y:0}; queue = [];
    score = 0; stepMs = 135; acc = 0; paused = false; ready = 45;
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
    const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (h.x < 0 || h.y < 0 || h.x >= GX || h.y >= GY || snake.some(s => s.x === h.x && s.y === h.y)){
      state = 'over'; deadT = 0; beep(320, .45, 'sawtooth', 60);
      if (score > hi){ hi = score; try { localStorage.setItem('as-snake-hi', hi); } catch(e){} }
      return;
    }
    snake.unshift(h);
    if (h.x === food.x && h.y === food.y){
      score++; stepMs = Math.max(62, stepMs - 4); placeFood(); beep(880, .09, 'square', 1500);
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
  function hardDrop(){ while (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; tScore += 2; } lock(); }
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
    // well
    ctx.fillStyle = '#151912'; ctx.fillRect(TX, TY, TW * TC, TH * TC);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++){ ctx.fillStyle = '#1e241a'; ctx.fillRect(TX + x*TC + 2, TY + y*TC + 2, 1, 1); }
    ctx.fillStyle = C.mid; ctx.fillRect(TX - 2, TY, 1, TH * TC); ctx.fillRect(TX + TW * TC + 1, TY, 1, TH * TC); ctx.fillRect(TX - 2, TY + TH * TC, TW * TC + 4, 1);
    board.forEach((row, y) => row.forEach((k, x) => {
      if (!k) return;
      if (clearing && clearing.includes(y)) { if (Math.floor(clearT / 3) % 2 === 0) cell(TX + x*TC, TY + y*TC, C.ink); }
      else cell(TX + x*TC, TY + y*TC, TCOL[k]);
    }));
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
    text(ctx, 'A:TURN', 116, 100, C.dim); text(ctx, 'SEL:MENU', 110, 112, C.dim);
    if (state === 'tetris' && tPaused){ box(); center(ctx, 'PAUSED', 56, C.ink, 2); center(ctx, 'SELECT FOR MENU', 76, C.mid); }
    if (state === 'tover'){
      deadT++; box();
      center(ctx, 'GAME OVER', 44, C.red, 2);
      center(ctx, 'SCORE ' + tScore + (tScore && tScore >= thi ? ' NEW HI!' : ''), 66, C.ink);
      if (deadT > 20) center(ctx, 'A:RETRY  B:MENU', 82, C.mid);
    }
  }


  // ---------- alwin run (dino-style runner) ----------
  const RP = { k:'#141210', H:'#1f1915', S:'#b0774f', W:'#ffffff', P:'#3c4150', K:'#ffffff', r:'#e0336b', b:'#5b8cf0', g:'#8a9a6b', w:'#f4f7ec' };
  const RBG = '#cfdcb4', RINK = '#141210', RDIM = '#a9b98d';
  const HEAD = ['..HHHHH...','.HHHHHHH..','HHHHHHHHH.','HHSSSSSHH.','.HSkSSkS..','..SSSSS...','...SSS....','..WWWWW...','.WWWWWWW..','.SWWWWWS..','..PPPPP...'];
  const LEGS = {
    a:['..PP.PP...','.PP...PP..','kKK...KKk.'],
    b:['...PPP....','...PP.P...','..KKk.KK..'],
    j:['.PP..PP...','PP....PP..','KK.....KK.'],
    d:['.PP..PP...','.PP..PP...','kKK..KKk..']
  };
  const DEAD_HEAD = ['..HHHHH...','.HHHHHHH..','HHHHHHHHH.','HHSSSSSHH.','.HSkSkSk..','..SSSSS...','...SrS....','..WWWWW...','.WWWWWWW..','SWWWWWWWS.','..PPPPP...'];
  const OBS = {
    bug:   { w:7, h:5, fly:false, px:['.k...k.','..rrr..','.rrkrr.','krrrrrk','.k.k.k.'] },
    files: { w:6, h:9, fly:false, px:['kkkk..','kWWkk.','kWWWWk','kkkkkk','kWWWWk','kkkkkk','kWWWWk','kWWWWk','kkkkkk'] },
    tall:  { w:6, h:12, fly:false, px:['kkkk..','kWWkk.','kWWWWk','kkkkkk','kWWWWk','kkkkkk','kWWWWk','kkkkkk','kWWWWk','kkkkkk','kWWWWk','kkkkkk'] },
    clock: { w:7, h:8, fly:false, px:['r.....r','.rrrrr.','rWWkWWr','rWWkWWr','rWWkkWr','rWWWWWr','.rrrrr.','.k...k.'] },
    popup: { w:10, h:7, fly:true, px:['kkkkkkkkkk','kbbbbbbrWk','kWWWWWWWWk','kWkkkkkWWk','kWWWWWWWWk','kWWWkkWWWk','kkkkkkkkkk'] }
  };
  const SC = 2, GROUND = 112;
  let rY, rVy, rObs, rSpeed, rDist, rNext, rClouds, rGroundX, rPaused, rStarted, rFrameT, rMilestone;
  function startRun(){
    rY = 0; rVy = 0; rObs = []; rSpeed = 1.7; rDist = 0; rNext = 200; rGroundX = 0; rPaused = false; rStarted = false; rFrameT = 0; rMilestone = 100;
    rClouds = [{ x: 30, y: 22 }, { x: 105, y: 38 }, { x: 170, y: 16 }];
    state = 'run';
  }
  function rJump(){
    if (!rStarted){ rStarted = true; }
    if (rY === 0){ rVy = 4.7; beep(520, .07, 'square', 900); }
  }
  function rSpawn(){
    const roll = Math.random(), sc = rDist / 10;
    let k = roll < .32 ? 'bug' : roll < .55 ? 'files' : roll < .74 ? 'clock' : roll < .86 && sc > 150 ? 'tall' : sc > 250 ? 'popup' : 'bug';
    const o = OBS[k], ob = { k, x: 164, w: o.w * SC, h: o.h * SC };
    ob.y = o.fly ? (Math.random() < .5 ? GROUND - 34 - ob.h : GROUND - 14 - ob.h) : GROUND - ob.h;
    // the high pop-up flies over a running player: only a jump hits it
    rObs.push(ob);
    if (Math.random() < .18 && !o.fly && sc > 80){ rObs.push({ k:'bug', x: 164 + ob.w + 4, w: 14, h: 10, y: GROUND - 10 }); }
    const gap = 70 + rSpeed * 34 + Math.random() * 90;
    rNext = gap;
  }
  function runTick(dt){
    const f = dt / 16.67;
    rFrameT += dt;
    if (!rStarted) return;
    rSpeed = Math.min(4.2, 1.7 + rDist / 4200);
    rDist += rSpeed * f;
    rGroundX = (rGroundX + rSpeed * f) % 16;
    rClouds.forEach(c => { c.x -= rSpeed * .25 * f; if (c.x < -24){ c.x = 170 + Math.random() * 30; c.y = 12 + Math.random() * 34; } });
    if (rY > 0 || rVy > 0){ rY += rVy * f; rVy -= .27 * f; if (rY <= 0){ rY = 0; rVy = 0; } }
    rObs.forEach(o => o.x -= rSpeed * f);
    rObs = rObs.filter(o => o.x > -40);
    rNext -= rSpeed * f; if (rNext <= 0) rSpawn();
    const score = Math.floor(rDist / 10);
    if (score >= rMilestone){ rMilestone += 100; beep(990, .08); setTimeout(() => beep(1320, .1), 90); }
    // collision (player box with a little forgiveness)
    const px = 18 + 4, pw = 20 - 8, ptop = GROUND - 28 - rY + 3, pbot = GROUND - rY - 1;
    for (const o of rObs){
      if (px < o.x + o.w - 3 && px + pw > o.x + 3 && ptop < o.y + o.h - 2 && pbot > o.y + 2){
        state = 'rover'; deadT = 0; beep(300, .5, 'sawtooth', 50);
        if (score > rhi){ rhi = score; try { localStorage.setItem('as-run-hi', rhi); } catch(e){} }
        return;
      }
    }
  }
  function spr(rows, x, y, s, pal){
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++){ const c = r[i]; if (c === '.' || !pal[c]) continue; ctx.fillStyle = pal[c]; ctx.fillRect(Math.round(x + i*s), Math.round(y + j*s), s, s); } });
  }
  function drawRun(){
    ctx.fillStyle = RBG; ctx.fillRect(0, 0, W, H);
    // clouds
    rClouds.forEach(c => { ctx.fillStyle = RP.w; ctx.fillRect(Math.round(c.x), c.y, 16, 3); ctx.fillRect(Math.round(c.x) + 4, c.y - 3, 8, 3); });
    // ground
    ctx.fillStyle = RINK; ctx.fillRect(0, GROUND, W, 1);
    ctx.fillStyle = RDIM;
    for (let x = -rGroundX; x < W; x += 16){ ctx.fillRect(Math.round(x) + 2, GROUND + 4, 3, 1); ctx.fillRect(Math.round(x) + 10, GROUND + 9, 2, 1); }
    // obstacles
    rObs.forEach(o => spr(OBS[o.k].px, o.x, o.y, SC, RP));
    // player
    const dead = state === 'rover';
    const legs = dead ? LEGS.d : rY > 0 ? LEGS.j : (!rStarted ? LEGS.a : (Math.floor(rFrameT / 110) % 2 ? LEGS.a : LEGS.b));
    const py = GROUND - 28 - Math.round(rY);
    spr(dead ? DEAD_HEAD : HEAD, 18, py, SC, RP); spr(legs, 18, py + 22, SC, RP);
    // hud
    const score = Math.floor(rDist / 10);
    const sx = 'XP ' + String(score).padStart(5, '0'); text(ctx, sx, W - 4 - width(sx), 4, RINK);
    const hx = 'HI ' + String(Math.max(rhi, score)).padStart(5, '0'); text(ctx, hx, W - 8 - width(sx) - width(hx), 4, '#6f7d55');
    if (!rStarted && state === 'run'){
      center(ctx, 'ALWIN RUN', 30, RINK, 2);
      if (Math.floor(tick / 28) % 2 === 0) center(ctx, 'A / TAP TO JUMP', 54, RINK);
      center(ctx, 'DODGE BUGS & DEADLINES', 66, '#6f7d55');
    }
    if (state === 'run' && rPaused){ rbox(); center(ctx, 'PAUSED', 50, RINK, 2); center(ctx, 'SELECT FOR MENU', 70, '#6f7d55'); }
    if (dead){
      deadT++; rbox();
      center(ctx, 'GAME OVER', 40, RP.r, 2);
      center(ctx, 'XP ' + score + (score && score >= rhi ? ' NEW HI!' : ''), 62, RINK);
      if (deadT > 20) center(ctx, 'A:RETRY  B:MENU', 76, '#6f7d55');
    }
  }
  function rbox(){ ctx.fillStyle = 'rgba(207,220,180,.92)'; ctx.fillRect(8, 30, 144, 58); ctx.fillStyle = RINK; ctx.fillRect(8, 30, 144, 1); ctx.fillRect(8, 87, 144, 1); }

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
      if (deadT < 20) return;
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
      else if (k === 'down') softDrop();
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
      if (DIRS[k] && k !== 'up') rep = setTimeout(() => { rep2 = setInterval(() => { if (state === 'tetris') press(k); }, 65); }, 190);
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
      center(ctx, 'SELECT A LEVEL', 10, C.mid);
      ctx.fillStyle = C.dim; ctx.fillRect(10, 21, 140, 1);
      MENU.forEach((m, i) => {
        const y = 28 + i * 14, sel = i === menuI;
        if (sel){ ctx.fillStyle = C.ink; ctx.fillRect(14, y - 3, 132, 12); }
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
      if (deadT < 20) return;
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
      else if (k === 'down') softDrop();
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
    if (state === 'run' && !rPaused) runTick(dt);
    if (state === 'boot' && ++idle === 300) startBtn.classList.add('hint');
    frame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
