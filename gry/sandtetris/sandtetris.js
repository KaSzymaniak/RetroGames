// ═══════════════════════════════════════════════════════════
//  TETRIS Z PIASKU — Falling-Sand Tetris Engine
//  Vanilla JS + HTML5 Canvas
// ═══════════════════════════════════════════════════════════

import { API_URL } from '../../frontend/config.js';

// ─────────────────────────────────────────────
//  Canvas & DOM References
// ─────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // 360
const H = canvas.height;  // 600

const startScreen    = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const finalScoreEl   = document.getElementById('final-score');
const finalLevelEl   = document.getElementById('final-level');
const startBtn       = document.getElementById('start-btn');
const restartBtn     = document.getElementById('restart-btn');
const saveBtn        = document.getElementById('save-btn');
const saveMsg        = document.getElementById('save-msg');
const canvasContainer = document.getElementById('canvas-container');
const badgeNameEl    = document.getElementById('badge-name');
const badgeAvatarEl  = document.getElementById('badge-avatar');

// ─────────────────────────────────────────────
//  Grid Constants
// ─────────────────────────────────────────────
const CELL  = 6;                 // pixel size of one sand grain
const COLS  = W / CELL;          // 60
const ROWS  = H / CELL;          // 100
const BLOCK = 4;                 // one tetromino square = BLOCK×BLOCK grains
const SIZE  = COLS * ROWS;

// ─────────────────────────────────────────────
//  Colour Palette (1-indexed; 0 = empty)
//  Same-colour grains connect → keep a small set so spans form
// ─────────────────────────────────────────────
const PALETTE = [
    null,                 // 0 unused
    [0, 212, 255],        // 1 cyan
    [255, 0, 110],        // 2 pink
    [0, 255, 136],        // 3 green
    [255, 215, 0]         // 4 yellow
];
const NCOLORS = PALETTE.length - 1;

// ─────────────────────────────────────────────
//  Tetromino shapes (4×4 block matrices)
// ─────────────────────────────────────────────
const SHAPES = [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]], // O
    [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], // T
    [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]], // S
    [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]], // Z
    [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], // J
    [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]]  // L
];

// ─────────────────────────────────────────────
//  Offscreen buffer for the sand layer (1px per grain)
// ─────────────────────────────────────────────
const sandCanvas = document.createElement('canvas');
sandCanvas.width = COLS;
sandCanvas.height = ROWS;
const sandCtx = sandCanvas.getContext('2d');
const sandImage = sandCtx.createImageData(COLS, ROWS);

// Static brightness noise per cell → gives sand a grainy texture
const shade = new Float32Array(SIZE);
for (let i = 0; i < SIZE; i++) shade[i] = 0.72 + Math.random() * 0.33;

// ─────────────────────────────────────────────
//  Game State
// ─────────────────────────────────────────────
let grid;                 // Uint8Array(SIZE) colour index
let visited;              // Uint8Array(SIZE) for flood fill
let piece;                // active tetromino
let nextPiece;
let state = 'menu';       // menu | playing | gameover
let score = 0;
let level = 1;
let clearedTotal = 0;
let animFrameId = null;
let lastTime = 0;
let dropAcc = 0;
let softDrop = false;
let shaking = false;

const idx = (x, y) => y * COLS + x;

// ─────────────────────────────────────────────
//  Piece helpers
// ─────────────────────────────────────────────
function makePiece() {
    const id = Math.floor(Math.random() * SHAPES.length);
    return {
        m: SHAPES[id].map(row => row.slice()),
        color: 1 + Math.floor(Math.random() * NCOLORS),
        // top-left position in grain coordinates
        cellX: Math.floor((COLS - 4 * BLOCK) / 2 / BLOCK) * BLOCK,
        cellY: -BLOCK
    };
}

function rotateMatrix(m) {
    const r = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++)
            r[x][3 - y] = m[y][x];
    return r;
}

// Collision test for a matrix at a grain position
function collides(m, cellX, cellY) {
    for (let by = 0; by < 4; by++) {
        for (let bx = 0; bx < 4; bx++) {
            if (!m[by][bx]) continue;
            for (let gy = 0; gy < BLOCK; gy++) {
                for (let gx = 0; gx < BLOCK; gx++) {
                    const x = cellX + bx * BLOCK + gx;
                    const y = cellY + by * BLOCK + gy;
                    if (x < 0 || x >= COLS || y >= ROWS) return true;
                    if (y >= 0 && grid[idx(x, y)] !== 0) return true;
                }
            }
        }
    }
    return false;
}

// Convert the landed piece into loose sand grains
function stampPiece() {
    for (let by = 0; by < 4; by++) {
        for (let bx = 0; bx < 4; bx++) {
            if (!piece.m[by][bx]) continue;
            for (let gy = 0; gy < BLOCK; gy++) {
                for (let gx = 0; gx < BLOCK; gx++) {
                    const x = piece.cellX + bx * BLOCK + gx;
                    const y = piece.cellY + by * BLOCK + gy;
                    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                        grid[idx(x, y)] = piece.color;
                    }
                }
            }
        }
    }
}

function spawnPiece() {
    piece = nextPiece || makePiece();
    nextPiece = makePiece();
    // if the very top of the board is already buried, it's game over
    if (collides(piece.m, piece.cellX, 0)) gameOver();
}

function lockPiece() {
    stampPiece();
    piece = null;
    spawnPiece();
}

// ─────────────────────────────────────────────
//  Sand Physics — one settling step over the grid
// ─────────────────────────────────────────────
function stepSand() {
    for (let y = ROWS - 2; y >= 0; y--) {
        // alternate horizontal scan direction to avoid drift bias
        const ltr = (y & 1) === 0;
        for (let k = 0; k < COLS; k++) {
            const x = ltr ? k : COLS - 1 - k;
            const c = grid[idx(x, y)];
            if (c === 0) continue;

            // straight down
            if (grid[idx(x, y + 1)] === 0) {
                grid[idx(x, y + 1)] = c;
                grid[idx(x, y)] = 0;
                continue;
            }
            // diagonal slide
            const canL = x > 0 && grid[idx(x - 1, y + 1)] === 0 && grid[idx(x - 1, y)] === 0;
            const canR = x < COLS - 1 && grid[idx(x + 1, y + 1)] === 0 && grid[idx(x + 1, y)] === 0;
            if (canL && canR) {
                if (Math.random() < 0.5) { grid[idx(x - 1, y + 1)] = c; }
                else { grid[idx(x + 1, y + 1)] = c; }
                grid[idx(x, y)] = 0;
            } else if (canL) {
                grid[idx(x - 1, y + 1)] = c;
                grid[idx(x, y)] = 0;
            } else if (canR) {
                grid[idx(x + 1, y + 1)] = c;
                grid[idx(x, y)] = 0;
            }
        }
    }
}

// ─────────────────────────────────────────────
//  Line Clear — flood fill same colour from left wall to right wall
// ─────────────────────────────────────────────
const stack = new Int32Array(SIZE);   // holds flat indices to process
const region = new Int32Array(SIZE);  // collected indices for current region

function clearSpans() {
    visited.fill(0);
    let removed = 0;

    for (let sy = 0; sy < ROWS; sy++) {
        const start = idx(0, sy);
        const c = grid[start];
        if (c === 0 || visited[start]) continue;

        // flood fill this connected same-colour region from the left edge
        let sp = 0;
        let rp = 0;
        stack[sp++] = start;
        visited[start] = 1;
        let touchesRight = false;

        while (sp > 0) {
            const ci = stack[--sp];
            region[rp++] = ci;
            const cx = ci % COLS;
            const cy = (ci - cx) / COLS;
            if (cx === COLS - 1) touchesRight = true;

            // 8-neighbours of same colour, not yet visited
            // (diagonals included so grains that only touch at a corner still link up)
            const hasL = cx > 0, hasR = cx < COLS - 1, hasU = cy > 0, hasD = cy < ROWS - 1;
            if (hasL)         { const n = ci - 1;        if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
            if (hasR)         { const n = ci + 1;        if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
            if (hasU)         { const n = ci - COLS;     if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
            if (hasD)         { const n = ci + COLS;     if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
            if (hasL && hasU) { const n = ci - COLS - 1; if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
            if (hasR && hasU) { const n = ci - COLS + 1; if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
            if (hasL && hasD) { const n = ci + COLS - 1; if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
            if (hasR && hasD) { const n = ci + COLS + 1; if (!visited[n] && grid[n] === c) { visited[n] = 1; stack[sp++] = n; } }
        }

        if (touchesRight) {
            for (let r = 0; r < rp; r++) grid[region[r]] = 0;
            removed += rp;
        }
    }
    return removed;
}

// ─────────────────────────────────────────────
//  Init / Reset
// ─────────────────────────────────────────────
function initGame() {
    grid = new Uint8Array(SIZE);
    visited = new Uint8Array(SIZE);
    score = 0;
    level = 1;
    clearedTotal = 0;
    dropAcc = 0;
    softDrop = false;
    nextPiece = makePiece();
    spawnPiece();
}

function dropInterval() {
    if (softDrop) return 18;
    return Math.max(60, 220 - (level - 1) * 16);
}

// ─────────────────────────────────────────────
//  Input
// ─────────────────────────────────────────────
function tryMove(dx) {
    if (!piece) return;
    if (!collides(piece.m, piece.cellX + dx, piece.cellY)) piece.cellX += dx;
}

function tryRotate() {
    if (!piece) return;
    const r = rotateMatrix(piece.m);
    const kicks = [0, BLOCK, -BLOCK, 2 * BLOCK, -2 * BLOCK];
    for (const k of kicks) {
        if (!collides(r, piece.cellX + k, piece.cellY)) {
            piece.m = r;
            piece.cellX += k;
            return;
        }
    }
}

function hardDrop() {
    if (!piece) return;
    while (!collides(piece.m, piece.cellX, piece.cellY + 1)) piece.cellY++;
    lockPiece();
}

document.addEventListener('keydown', e => {
    if (state !== 'playing') return;
    switch (e.key) {
        case 'ArrowLeft':  case 'a': case 'A': tryMove(-BLOCK); e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': tryMove(BLOCK);  e.preventDefault(); break;
        case 'ArrowUp':    case 'w': case 'W': tryRotate();     e.preventDefault(); break;
        case 'ArrowDown':  case 's': case 'S': softDrop = true; e.preventDefault(); break;
        case ' ':          hardDrop();        e.preventDefault(); break;
    }
});

document.addEventListener('keyup', e => {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') softDrop = false;
});

// ─────────────────────────────────────────────
//  Update step
// ─────────────────────────────────────────────
function update(dt) {
    // settle loose sand
    stepSand();

    // clear winning spans
    const removed = clearSpans();
    if (removed > 0) {
        score += removed;
        clearedTotal += removed;
        level = 1 + Math.floor(clearedTotal / 600);
        if (removed > 40) screenShake();
    }

    // piece gravity
    if (piece) {
        dropAcc += dt;
        if (dropAcc >= dropInterval()) {
            dropAcc = 0;
            if (!collides(piece.m, piece.cellX, piece.cellY + 1)) {
                piece.cellY++;
            } else if (piece.cellY < 0) {
                gameOver();
            } else {
                lockPiece();
            }
        }
    }
}

// ─────────────────────────────────────────────
//  Render
// ─────────────────────────────────────────────
function drawBackground() {
    ctx.fillStyle = '#10101f';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0,212,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += CELL * BLOCK) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += CELL * BLOCK) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const grd = ctx.createLinearGradient(0, H - 90, 0, H);
    grd.addColorStop(0, 'transparent');
    grd.addColorStop(1, 'rgba(184,77,255,0.07)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, H - 90, W, 90);
}

function drawSand() {
    const data = sandImage.data;
    for (let i = 0; i < SIZE; i++) {
        const c = grid[i];
        const o = i * 4;
        if (c === 0) {
            data[o + 3] = 0;
        } else {
            const col = PALETTE[c];
            const s = shade[i];
            data[o]     = Math.min(255, col[0] * s);
            data[o + 1] = Math.min(255, col[1] * s);
            data[o + 2] = Math.min(255, col[2] * s);
            data[o + 3] = 255;
        }
    }
    sandCtx.putImageData(sandImage, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sandCanvas, 0, 0, COLS, ROWS, 0, 0, W, H);
}

function drawPiece() {
    if (!piece) return;
    const col = PALETTE[piece.color];
    const rgb = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = rgb;
    for (let by = 0; by < 4; by++) {
        for (let bx = 0; bx < 4; bx++) {
            if (!piece.m[by][bx]) continue;
            const px = (piece.cellX + bx * BLOCK) * CELL;
            const py = (piece.cellY + by * BLOCK) * CELL;
            const sz = BLOCK * CELL;
            ctx.fillStyle = rgb;
            ctx.fillRect(px, py, sz, sz);
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(px, py, sz, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(px, py + sz - 2, sz, 2);
            ctx.shadowBlur = 12;
        }
    }
    ctx.restore();
}

function drawNext() {
    if (!nextPiece) return;
    const boxX = W - 70, boxY = 10, cell = 9;
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,30,0.6)';
    ctx.fillRect(boxX - 6, boxY - 4, 62, 50);
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.strokeRect(boxX - 6, boxY - 4, 62, 50);

    ctx.font = '8px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(220,220,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', boxX - 4, boxY + 52);

    const col = PALETTE[nextPiece.color];
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.shadowBlur = 6;
    ctx.shadowColor = ctx.fillStyle;
    for (let by = 0; by < 4; by++)
        for (let bx = 0; bx < 4; bx++)
            if (nextPiece.m[by][bx])
                ctx.fillRect(boxX + bx * cell, boxY + by * cell, cell - 1, cell - 1);
    ctx.restore();
}

function drawHUD() {
    ctx.save();
    ctx.font = 'bold 15px "Orbitron", "Share Tech Mono", monospace';
    ctx.fillStyle = '#00d4ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,212,255,0.4)';
    ctx.fillText(`SCORE ${score}`, 12, 12);

    ctx.font = 'bold 12px "Orbitron", monospace';
    ctx.fillStyle = '#b84dff';
    ctx.shadowColor = 'rgba(184,77,255,0.4)';
    ctx.fillText(`LEVEL ${level}`, 12, 32);
    ctx.restore();
}

// ─────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────
function gameLoop(timestamp) {
    if (state !== 'playing') return;
    const dt = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;

    update(dt);

    drawBackground();
    drawSand();
    drawPiece();
    drawNext();
    drawHUD();

    animFrameId = requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────
//  Actions
// ─────────────────────────────────────────────
function screenShake() {
    if (shaking) return;
    shaking = true;
    canvasContainer.classList.add('shake');
    setTimeout(() => {
        canvasContainer.classList.remove('shake');
        shaking = false;
    }, 350);
}

function gameOver() {
    if (state === 'gameover') return;
    state = 'gameover';
    cancelAnimationFrame(animFrameId);
    gameoverScreen.classList.remove('hidden');
    finalScoreEl.textContent = score;
    finalLevelEl.textContent = level;
    saveMsg.textContent = '';
    saveBtn.disabled = false;

    const best = parseInt(localStorage.getItem('arcade_score_sandtetris') || '0', 10);
    if (score > best) localStorage.setItem('arcade_score_sandtetris', score);
}

function startGame() {
    initGame();
    state = 'playing';
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    lastTime = performance.now();
    animFrameId = requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// ─────────────────────────────────────────────
//  SAVE SCORE TO SERVER
// ─────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
    const nick   = localStorage.getItem('arcade_nickname') || 'Anonim';
    const avatar = localStorage.getItem('arcade_avatar')   || '👾';

    saveBtn.disabled = true;
    saveMsg.textContent = 'Wysyłanie...';
    saveMsg.style.color = '#ffd700';

    try {
        const resp = await fetch(`${API_URL}/api/zapisz-wynik`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gra: 'Sand Tetris',
                punkty: score,
                gracz: `${avatar} ${nick}`
            })
        });
        const data = await resp.json();
        saveMsg.textContent = '✅ ' + data.message;
        saveMsg.style.color = '#00ff88';
    } catch (err) {
        saveMsg.textContent = '❌ Błąd: Uruchom serwer backendowy!';
        saveMsg.style.color = '#ff0040';
    }
});

// ─────────────────────────────────────────────
//  Profile Badge
// ─────────────────────────────────────────────
function loadProfile() {
    badgeNameEl.textContent   = localStorage.getItem('arcade_nickname') || 'Anonim';
    badgeAvatarEl.textContent = localStorage.getItem('arcade_avatar')   || '👾';
}

// ─────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────
loadProfile();
grid = new Uint8Array(SIZE);
drawBackground();
