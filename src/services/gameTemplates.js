/**
 * Trusted local HTML5 game templates.
 * Core mechanics are self-contained; theme (title/colors/flavor) is injectable.
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell({ title, subtitle, flavor, bg, accent, panel, text, gameId, bodyHtml, script }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<title>${esc(title)}</title>
<style>
  :root {
    --bg: ${bg};
    --accent: ${accent};
    --panel: ${panel};
    --text: ${text};
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text);
    font-family: "Segoe UI", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  body { display: flex; flex-direction: column; align-items: center; padding: 12px 12px 24px; min-height: 100%; }
  .hdr { text-align: center; margin-bottom: 10px; max-width: 520px; }
  .hdr h1 { margin: 0 0 4px; font-size: 1.45rem; letter-spacing: .02em; }
  .hdr p { margin: 0; opacity: .85; font-size: .9rem; }
  .flavor { margin-top: 6px; font-size: .8rem; opacity: .7; }
  .bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: center; margin: 8px 0 12px; }
  .score { background: var(--panel); padding: 8px 14px; border-radius: 10px; font-weight: 700; min-width: 88px; text-align: center; }
  button.btn {
    background: var(--accent); color: #111; border: 0; border-radius: 10px; padding: 8px 16px;
    font-weight: 700; cursor: pointer; font-size: .9rem;
  }
  button.btn:active { transform: scale(.97); }
  .stage-wrap {
    background: var(--panel); border-radius: 16px; padding: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.35);
    touch-action: none; user-select: none;
  }
  .hint { margin-top: 12px; font-size: .78rem; opacity: .65; text-align: center; max-width: 420px; line-height: 1.4; }
  .overlay {
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    background: rgba(0,0,0,.55); border-radius: 12px; z-index: 5; text-align: center; padding: 16px;
  }
  .overlay.show { display: flex; }
  .overlay .card { background: var(--panel); padding: 20px 24px; border-radius: 14px; max-width: 280px; }
  .overlay h2 { margin: 0 0 8px; }
  .stage-rel { position: relative; display: inline-block; }
  #game-root { outline: none; }
</style>
</head>
<body>
  <div class="hdr">
    <h1>${esc(title)}</h1>
    <p>${esc(subtitle || '')}</p>
    ${flavor ? `<p class="flavor">${esc(flavor)}</p>` : ''}
  </div>
  <div id="game-root" tabindex="0" data-game="${esc(gameId)}">
    ${bodyHtml}
  </div>
  <p class="hint">点击游戏区域获得焦点 · 键盘方向键操作 · 支持触屏滑动</p>
<script>
${script}
</script>
</body>
</html>`;
}

function build2048(theme) {
  const title = theme.title || '2048';
  const subtitle = theme.subtitle || '合并相同数字，冲击 2048';
  const flavor = theme.flavor || '';
  const bg = theme.bg || '#1a1a2e';
  const accent = theme.accent || '#e94560';
  const panel = theme.panel || '#16213e';
  const text = theme.text || '#eaeaea';

  const bodyHtml = `
  <div class="bar">
    <div class="score">分数 <span id="score">0</span></div>
    <div class="score">最佳 <span id="best">0</span></div>
    <button class="btn" type="button" id="btn-new">新游戏</button>
  </div>
  <div class="stage-wrap stage-rel" id="board-wrap">
    <div id="board" style="display:grid;grid-template-columns:repeat(4,72px);gap:8px;"></div>
    <div class="overlay" id="overlay"><div class="card"><h2 id="over-title"></h2><p id="over-msg"></p><button class="btn" type="button" id="btn-again">再来一局</button></div></div>
  </div>`;

  const script = `
(function(){
  const SIZE=4;
  let grid, score, best=Number(localStorage.getItem('fa2048best')||0), won=false, over=false;
  const board=document.getElementById('board');
  const scoreEl=document.getElementById('score');
  const bestEl=document.getElementById('best');
  const overlay=document.getElementById('overlay');
  const overTitle=document.getElementById('over-title');
  const overMsg=document.getElementById('over-msg');
  const root=document.getElementById('game-root');
  bestEl.textContent=best;

  const COLORS={
    0:'#0f3460',2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',
    32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',
    1024:'#edc53f',2048:'#edc22e'
  };
  function textColor(v){ return v<=4 ? '#776e65' : '#f9f6f2'; }

  function emptyGrid(){ return Array.from({length:SIZE},()=>Array(SIZE).fill(0)); }
  function cells(){ const a=[]; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!grid[r][c]) a.push([r,c]); return a; }
  function addTile(){
    const e=cells(); if(!e.length) return;
    const [r,c]=e[Math.floor(Math.random()*e.length)];
    grid[r][c]=Math.random()<0.9?2:4;
  }
  function render(){
    board.innerHTML='';
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const v=grid[r][c];
      const d=document.createElement('div');
      d.style.cssText='width:72px;height:72px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:'+(v>=1024?'1.1rem':v>=128?'1.25rem':'1.5rem')+';background:'+COLORS[v]||'#3c3a32'+';color:'+textColor(v);
      d.textContent=v||'';
      board.appendChild(d);
    }
    scoreEl.textContent=score;
    if(score>best){ best=score; localStorage.setItem('fa2048best',best); bestEl.textContent=best; }
  }
  function slide(row){
    const arr=row.filter(x=>x);
    for(let i=0;i<arr.length-1;i++){
      if(arr[i]===arr[i+1]){ arr[i]*=2; score+=arr[i]; arr.splice(i+1,1); }
    }
    while(arr.length<SIZE) arr.push(0);
    return arr;
  }
  function transpose(g){ return g[0].map((_,c)=>g.map(r=>r[c])); }
  function mirror(g){ return g.map(r=>r.slice().reverse()); }
  function move(dir){
    if(over) return false;
    const prev=JSON.stringify(grid);
    if(dir==='left') grid=grid.map(slide);
    else if(dir==='right') grid=mirror(mirror(grid).map(slide));
    else if(dir==='up') grid=transpose(transpose(grid).map(slide));
    else if(dir==='down'){ const t=transpose(grid); grid=transpose(mirror(mirror(t).map(slide))); }
    if(JSON.stringify(grid)===prev) return false;
    addTile();
    render();
    if(!won && grid.some(r=>r.some(v=>v>=2048))){ won=true; showOver('你赢了！','达到 2048，可继续挑战更高分'); }
    else if(!cells().length && !canMove()){ over=true; showOver('游戏结束','没有可合并的格子了'); }
    return true;
  }
  function canMove(){
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const v=grid[r][c];
      if((c+1<SIZE && grid[r][c+1]===v) || (r+1<SIZE && grid[r+1][c]===v)) return true;
    }
    return false;
  }
  function showOver(t,m){ overTitle.textContent=t; overMsg.textContent=m; overlay.classList.add('show'); }
  function hideOver(){ overlay.classList.remove('show'); }
  function newGame(){ grid=emptyGrid(); score=0; won=false; over=false; hideOver(); addTile(); addTile(); render(); root.focus(); }

  document.getElementById('btn-new').onclick=newGame;
  document.getElementById('btn-again').onclick=newGame;
  window.addEventListener('keydown',e=>{
    const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
    const d=map[e.key];
    if(d){ e.preventDefault(); move(d); }
  });
  let sx=0,sy=0;
  const wrap=document.getElementById('board-wrap');
  wrap.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
  wrap.addEventListener('touchend',e=>{
    const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)<24 && Math.abs(dy)<24) return;
    if(Math.abs(dx)>Math.abs(dy)) move(dx>0?'right':'left'); else move(dy>0?'down':'up');
  },{passive:true});
  wrap.addEventListener('click',()=>root.focus());
  newGame();
})();`;

  return shell({ title, subtitle, flavor, bg, accent, panel, text, gameId: '2048', bodyHtml, script });
}

function buildSnake(theme) {
  const title = theme.title || '贪吃蛇';
  const subtitle = theme.subtitle || '吃到食物变长，别撞墙或撞到自己';
  const flavor = theme.flavor || '';
  const bg = theme.bg || '#0b132b';
  const accent = theme.accent || '#5bc0be';
  const panel = theme.panel || '#1c2541';
  const text = theme.text || '#f0f4f8';

  const bodyHtml = `
  <div class="bar">
    <div class="score">分数 <span id="score">0</span></div>
    <div class="score">长度 <span id="len">3</span></div>
    <button class="btn" type="button" id="btn-new">重新开始</button>
  </div>
  <div class="stage-wrap stage-rel">
    <canvas id="c" width="360" height="360" style="display:block;border-radius:10px;background:#0d1b2a"></canvas>
    <div class="overlay" id="overlay"><div class="card"><h2 id="over-title">游戏结束</h2><p id="over-msg"></p><button class="btn" type="button" id="btn-again">再来一局</button></div></div>
  </div>`;

  const script = `
(function(){
  const COLS=20, ROWS=20, CELL=18;
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');
  const scoreEl=document.getElementById('score');
  const lenEl=document.getElementById('len');
  const overlay=document.getElementById('overlay');
  const overMsg=document.getElementById('over-msg');
  const root=document.getElementById('game-root');
  let snake, dir, nextDir, food, score, timer, alive;

  function randFood(){
    while(true){
      const p={x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS)};
      if(!snake.some(s=>s.x===p.x&&s.y===p.y)) return p;
    }
  }
  function draw(){
    ctx.fillStyle='#0d1b2a'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='rgba(255,255,255,.04)';
    for(let i=0;i<=COLS;i++){ ctx.beginPath(); ctx.moveTo(i*CELL,0); ctx.lineTo(i*CELL,ROWS*CELL); ctx.stroke(); }
    for(let j=0;j<=ROWS;j++){ ctx.beginPath(); ctx.moveTo(0,j*CELL); ctx.lineTo(COLS*CELL,j*CELL); ctx.stroke(); }
    ctx.fillStyle='${accent}';
    ctx.fillRect(food.x*CELL+2, food.y*CELL+2, CELL-4, CELL-4);
    snake.forEach((s,i)=>{
      ctx.fillStyle=i===0?'#ffffff':'#7be0c6';
      ctx.fillRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2);
    });
  }
  function tick(){
    if(!alive) return;
    dir=nextDir;
    const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(head.x<0||head.y<0||head.x>=COLS||head.y>=ROWS||snake.some(s=>s.x===head.x&&s.y===head.y)){
      alive=false; clearInterval(timer);
      overMsg.textContent='得分 '+score+' · 长度 '+snake.length;
      overlay.classList.add('show');
      return;
    }
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y){ score+=10; food=randFood(); }
    else snake.pop();
    scoreEl.textContent=score; lenEl.textContent=snake.length; draw();
  }
  function setDir(nx,ny){
    if(dir.x===-nx&&dir.y===-ny) return;
    nextDir={x:nx,y:ny};
  }
  function newGame(){
    snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    dir={x:1,y:0}; nextDir={x:1,y:0}; score=0; alive=true; food=randFood();
    overlay.classList.remove('show');
    scoreEl.textContent=0; lenEl.textContent=3; draw();
    clearInterval(timer); timer=setInterval(tick,120);
    root.focus();
  }
  document.getElementById('btn-new').onclick=newGame;
  document.getElementById('btn-again').onclick=newGame;
  window.addEventListener('keydown',e=>{
    const k=e.key;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(k)) e.preventDefault();
    if(k==='ArrowUp'||k==='w'||k==='W') setDir(0,-1);
    else if(k==='ArrowDown'||k==='s'||k==='S') setDir(0,1);
    else if(k==='ArrowLeft'||k==='a'||k==='A') setDir(-1,0);
    else if(k==='ArrowRight'||k==='d'||k==='D') setDir(1,0);
  });
  let sx=0,sy=0;
  canvas.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
  canvas.addEventListener('touchend',e=>{
    const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)<20&&Math.abs(dy)<20) return;
    if(Math.abs(dx)>Math.abs(dy)) setDir(dx>0?1:-1,0); else setDir(0,dy>0?1:-1);
  },{passive:true});
  canvas.addEventListener('click',()=>root.focus());
  newGame();
})();`;

  return shell({ title, subtitle, flavor, bg, accent, panel, text, gameId: 'snake', bodyHtml, script });
}

function buildTetris(theme) {
  const title = theme.title || '俄罗斯方块';
  const subtitle = theme.subtitle || '旋转消除，挑战高分';
  const flavor = theme.flavor || '';
  const bg = theme.bg || '#111827';
  const accent = theme.accent || '#60a5fa';
  const panel = theme.panel || '#1f2937';
  const text = theme.text || '#f3f4f6';

  const bodyHtml = `
  <div class="bar">
    <div class="score">分数 <span id="score">0</span></div>
    <div class="score">行数 <span id="lines">0</span></div>
    <div class="score">等级 <span id="level">1</span></div>
    <button class="btn" type="button" id="btn-new">重新开始</button>
  </div>
  <div class="stage-wrap stage-rel" style="display:flex;gap:12px;align-items:flex-start">
    <canvas id="c" width="240" height="480" style="display:block;border-radius:8px;background:#0b1220"></canvas>
    <div style="min-width:100px">
      <div class="score" style="margin-bottom:8px">下一个</div>
      <canvas id="next" width="96" height="96" style="display:block;border-radius:8px;background:#0b1220"></canvas>
      <p class="hint" style="margin-top:10px;text-align:left">↑/X 旋转<br>← → 移动<br>↓ 软降<br>空格 硬降</p>
    </div>
    <div class="overlay" id="overlay"><div class="card"><h2>游戏结束</h2><p id="over-msg"></p><button class="btn" type="button" id="btn-again">再来一局</button></div></div>
  </div>`;

  const script = `
(function(){
  const COLS=10, ROWS=20, SIZE=24;
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');
  const nextC=document.getElementById('next');
  const nctx=nextC.getContext('2d');
  const scoreEl=document.getElementById('score');
  const linesEl=document.getElementById('lines');
  const levelEl=document.getElementById('level');
  const overlay=document.getElementById('overlay');
  const overMsg=document.getElementById('over-msg');
  const root=document.getElementById('game-root');

  const SHAPES={
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]]
  };
  const COLORS={I:'#22d3ee',O:'#fbbf24',T:'#a78bfa',S:'#34d399',Z:'#f87171',J:'#60a5fa',L:'#fb923c'};
  const NAMES=Object.keys(SHAPES);

  let board, piece, nextPiece, score, lines, level, timer, alive, dropMs;

  function emptyBoard(){ return Array.from({length:ROWS},()=>Array(COLS).fill(null)); }
  function rotate(m){
    const N=m.length; const r=Array.from({length:N},()=>Array(N).fill(0));
    for(let y=0;y<N;y++) for(let x=0;x<N;x++) r[x][N-1-y]=m[y][x];
    return r;
  }
  function spawnKind(){ return NAMES[Math.floor(Math.random()*NAMES.length)]; }
  function makePiece(kind){
    const shape=SHAPES[kind].map(r=>r.slice());
    return {kind, shape, x: Math.floor((COLS-shape[0].length)/2), y:0};
  }
  function collides(p, ox, oy, shape){
    const sh=shape||p.shape;
    for(let y=0;y<sh.length;y++) for(let x=0;x<sh[y].length;x++){
      if(!sh[y][x]) continue;
      const nx=p.x+x+(ox||0), ny=p.y+y+(oy||0);
      if(nx<0||nx>=COLS||ny>=ROWS) return true;
      if(ny>=0 && board[ny][nx]) return true;
    }
    return false;
  }
  function merge(){
    const sh=piece.shape;
    for(let y=0;y<sh.length;y++) for(let x=0;x<sh[y].length;x++){
      if(!sh[y][x]) continue;
      const ny=piece.y+y, nx=piece.x+x;
      if(ny>=0) board[ny][nx]=piece.kind;
    }
  }
  function clearLines(){
    let cleared=0;
    for(let y=ROWS-1;y>=0;y--){
      if(board[y].every(c=>c)){ board.splice(y,1); board.unshift(Array(COLS).fill(null)); cleared++; y++; }
    }
    if(cleared){
      const pts=[0,100,300,500,800];
      score+=pts[cleared]*level;
      lines+=cleared;
      level=1+Math.floor(lines/10);
      dropMs=Math.max(120, 600-(level-1)*50);
      restartTimer();
      scoreEl.textContent=score; linesEl.textContent=lines; levelEl.textContent=level;
    }
  }
  function drawCell(x,y,color,target,size){
    const g=target||ctx; const s=size||SIZE;
    g.fillStyle=color; g.fillRect(x*s+1,y*s+1,s-2,s-2);
  }
  function draw(){
    ctx.fillStyle='#0b1220'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      if(board[y][x]) drawCell(x,y,COLORS[board[y][x]]);
    }
    if(piece){
      const sh=piece.shape;
      for(let y=0;y<sh.length;y++) for(let x=0;x<sh[y].length;x++){
        if(sh[y][x]) drawCell(piece.x+x, piece.y+y, COLORS[piece.kind]);
      }
    }
    nctx.fillStyle='#0b1220'; nctx.fillRect(0,0,nextC.width,nextC.height);
    if(nextPiece){
      const sh=nextPiece.shape; const s=20;
      const ox=Math.floor((4-sh[0].length)/2), oy=Math.floor((4-sh.length)/2);
      for(let y=0;y<sh.length;y++) for(let x=0;x<sh[y].length;x++){
        if(sh[y][x]){ nctx.fillStyle=COLORS[nextPiece.kind]; nctx.fillRect((ox+x)*s+4,(oy+y)*s+4,s-2,s-2); }
      }
    }
  }
  function spawn(){
    piece=nextPiece||makePiece(spawnKind());
    nextPiece=makePiece(spawnKind());
    if(collides(piece,0,0)){ alive=false; clearInterval(timer); overMsg.textContent='得分 '+score+' · 消除 '+lines+' 行'; overlay.classList.add('show'); }
  }
  function softDrop(){
    if(!alive||!piece) return;
    if(!collides(piece,0,1)){ piece.y++; score+=1; scoreEl.textContent=score; }
    else { merge(); clearLines(); spawn(); }
    draw();
  }
  function hardDrop(){
    if(!alive||!piece) return;
    while(!collides(piece,0,1)){ piece.y++; score+=2; }
    scoreEl.textContent=score; merge(); clearLines(); spawn(); draw();
  }
  function move(dx){ if(!alive||!piece) return; if(!collides(piece,dx,0)){ piece.x+=dx; draw(); } }
  function rot(){
    if(!alive||!piece||piece.kind==='O') return;
    const sh=rotate(piece.shape);
    if(!collides(piece,0,0,sh)){ piece.shape=sh; draw(); }
    else if(!collides(piece,-1,0,sh)){ piece.x--; piece.shape=sh; draw(); }
    else if(!collides(piece,1,0,sh)){ piece.x++; piece.shape=sh; draw(); }
  }
  function restartTimer(){ clearInterval(timer); timer=setInterval(softDrop, dropMs); }
  function newGame(){
    board=emptyBoard(); score=0; lines=0; level=1; dropMs=600; alive=true; nextPiece=null;
    overlay.classList.remove('show');
    scoreEl.textContent=0; linesEl.textContent=0; levelEl.textContent=1;
    spawn(); draw(); restartTimer(); root.focus();
  }
  document.getElementById('btn-new').onclick=newGame;
  document.getElementById('btn-again').onclick=newGame;
  window.addEventListener('keydown',e=>{
    const k=e.key;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','x','X','w','a','s','d','W','A','S','D'].includes(k)) e.preventDefault();
    if(k==='ArrowLeft'||k==='a'||k==='A') move(-1);
    else if(k==='ArrowRight'||k==='d'||k==='D') move(1);
    else if(k==='ArrowDown'||k==='s'||k==='S') softDrop();
    else if(k==='ArrowUp'||k==='x'||k==='X'||k==='w'||k==='W') rot();
    else if(k===' ') hardDrop();
  });
  let sx=0,sy=0;
  canvas.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
  canvas.addEventListener('touchend',e=>{
    const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)<18&&Math.abs(dy)<18){ rot(); return; }
    if(Math.abs(dx)>Math.abs(dy)) move(dx>0?1:-1);
    else if(dy>0) softDrop(); else rot();
  },{passive:true});
  canvas.addEventListener('click',()=>root.focus());
  newGame();
})();`;

  return shell({ title, subtitle, flavor, bg, accent, panel, text, gameId: 'tetris', bodyHtml, script });
}

function detectGameKind(title, idea) {
  const text = `${title || ''} ${idea || ''}`.toLowerCase();
  if (/2048/.test(text)) return '2048';
  if (/贪吃蛇|\bsnake\b/.test(text)) return 'snake';
  if (/俄罗斯方块|\btetris\b|方块/.test(text)) return 'tetris';
  // default: 2048 as flagship mini-game
  return '2048';
}

function buildGameHtml(kind, theme) {
  if (kind === 'snake') return buildSnake(theme || {});
  if (kind === 'tetris') return buildTetris(theme || {});
  return build2048(theme || {});
}

module.exports = { buildGameHtml, detectGameKind, build2048, buildSnake, buildTetris };
