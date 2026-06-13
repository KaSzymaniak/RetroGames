// ═══════════════════════════════════════════════════════════
//  ARKANOID — Full Game Engine (Arkanoid × Space Invaders)
//  Vanilla JS + HTML5 Canvas
// ═══════════════════════════════════════════════════════════

import { API_URL } from '../../frontend/config.js';

// ─────────────────────────────────────────────
//  Canvas & DOM References
// ─────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // 800
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
//  Constants
// ─────────────────────────────────────────────
const PADDLE_BASE_W   = 120;
const PADDLE_H        = 16;
const BALL_R          = 7;
const BALL_BASE_SPEED = 4.5;

const BRICK_ROWS   = 5;
const BRICK_COLS   = 10;
const BRICK_W      = 68;
const BRICK_H      = 22;
const BRICK_GAP    = 6;
const BRICK_TOP    = 55;
const BRICK_LEFT   = (W - (BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;

const LASER_W      = 3;
const LASER_H      = 18;
const LASER_SPEED  = 6;

const POWERUP_SIZE       = 20;
const POWERUP_FALL_SPEED = 2.5;
const POWERUP_DURATION   = 10000; // 10 s

const SHAKE_DURATION = 500; // ms

// ─────────────────────────────────────────────
//  Game State
// ─────────────────────────────────────────────
let state = 'menu';       // menu | playing | gameover
let score = 0;
let lives = 3;
let level = 1;
let mouseX = W / 2;
let animFrameId = null;

// Objects
let paddle, ball, bricks, lasers, powerups, particles, stars;
let laserCooldown = 0;
const LASER_CD_BASE = 110;  // frames between enemy shots

// Power-up state
let activePowerType = null;
let powerTimeLeft   = 0;

// Shake
let shaking = false;

// ─────────────────────────────────────────────
//  Background Stars (generated once)
// ─────────────────────────────────────────────
function createStars() {
    stars = [];
    for (let i = 0; i < 120; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.5 + 0.3,
            alpha: Math.random() * 0.5 + 0.15,
            phase: Math.random() * Math.PI * 2
        });
    }
}

// ─────────────────────────────────────────────
//  Initialisation helpers
// ─────────────────────────────────────────────
function resetPaddle() {
    paddle = {
        x: W / 2 - PADDLE_BASE_W / 2,
        y: H - 38,
        w: PADDLE_BASE_W,
        h: PADDLE_H
    };
}

function resetBall() {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const spd = BALL_BASE_SPEED + (level - 1) * 0.4;
    ball = {
        x: W / 2,
        y: H - 58,
        dx: Math.cos(angle) * spd,
        dy: Math.sin(angle) * spd,
        r: BALL_R,
        speed: spd,
        piercing: false,
        trail: []
    };
}

function createBricks() {
    bricks = [];
    const palette = ['#ff006e', '#ff1493', '#ff3388', '#ff69b4', '#ff85a2'];
    const shootChance = Math.min(0.5, 0.2 + level * 0.06);
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
            bricks.push({
                x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
                y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
                w: BRICK_W,
                h: BRICK_H,
                alive: true,
                color: palette[r],
                hp: r < 2 ? 2 : 1,
                maxHp: r < 2 ? 2 : 1,
                canShoot: Math.random() < shootChance
            });
        }
    }
}

function initGame() {
    score = 0;
    lives = 3;
    level = 1;
    lasers = [];
    powerups = [];
    particles = [];
    laserCooldown = 0;
    deactivatePower();
    resetPaddle();
    resetBall();
    createBricks();
}

// ─────────────────────────────────────────────
//  Input
// ─────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (W / rect.width);
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.touches[0].clientX - rect.left) * (W / rect.width);
}, { passive: false });

// ─────────────────────────────────────────────
//  UPDATE functions
// ─────────────────────────────────────────────

function updatePaddle() {
    paddle.x = mouseX - paddle.w / 2;
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.w > W) paddle.x = W - paddle.w;
}

function updateBall() {
    // trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 14) ball.trail.shift();

    ball.x += ball.dx;
    ball.y += ball.dy;

    // walls
    if (ball.x - ball.r <= 0)  { ball.x = ball.r;     ball.dx = Math.abs(ball.dx); }
    if (ball.x + ball.r >= W)  { ball.x = W - ball.r;  ball.dx = -Math.abs(ball.dx); }
    if (ball.y - ball.r <= 0)  { ball.y = ball.r;       ball.dy = Math.abs(ball.dy); }

    // paddle
    if (ball.dy > 0 &&
        ball.y + ball.r >= paddle.y &&
        ball.y - ball.r <= paddle.y + paddle.h &&
        ball.x >= paddle.x - ball.r &&
        ball.x <= paddle.x + paddle.w + ball.r) {

        const hitPos = (ball.x - paddle.x) / paddle.w;                   // 0‥1
        const angle  = -Math.PI / 2 + (hitPos - 0.5) * (Math.PI * 0.7); // fan ±63°
        ball.dx = Math.cos(angle) * ball.speed;
        ball.dy = Math.sin(angle) * ball.speed;
        ball.y  = paddle.y - ball.r;
    }

    // fell below → lose life (no shake)
    if (ball.y - ball.r > H) {
        lives--;
        if (lives <= 0) {
            gameOver();
        } else {
            resetBall();
        }
    }
}

function updateBricks() {
    for (const b of bricks) {
        if (!b.alive) continue;

        // circle vs AABB
        const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
        const dx = ball.x - cx;
        const dy = ball.y - cy;

        if (dx * dx + dy * dy < ball.r * ball.r) {
            b.hp--;
            if (b.hp <= 0) {
                b.alive = false;
                score += 10 * level;
                spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 14);

                // 10% power-up
                if (Math.random() < 0.10) {
                    spawnPowerup(b.x + b.w / 2, b.y + b.h / 2);
                }
            } else {
                // crack particles (fewer)
                spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffffff', 4);
            }

            // reflect only when not piercing
            if (!ball.piercing) {
                const oL = (ball.x + ball.r) - b.x;
                const oR = (b.x + b.w) - (ball.x - ball.r);
                const oT = (ball.y + ball.r) - b.y;
                const oB = (b.y + b.h) - (ball.y - ball.r);
                const min = Math.min(oL, oR, oT, oB);
                if (min === oL || min === oR) ball.dx = -ball.dx;
                else ball.dy = -ball.dy;
            }

            // only one brick per frame (unless piercing)
            if (!ball.piercing) break;
        }
    }

    // all destroyed → next level
    if (bricks.every(b => !b.alive)) nextLevel();
}

function updateLasers() {
    // spawn
    laserCooldown--;
    if (laserCooldown <= 0) {
        const shooters = bricks.filter(b => b.alive && b.canShoot);
        if (shooters.length > 0) {
            const src = shooters[Math.floor(Math.random() * shooters.length)];
            lasers.push({
                x: src.x + src.w / 2 - LASER_W / 2,
                y: src.y + src.h,
                w: LASER_W,
                h: LASER_H
            });
            // Muzzle flash particles
            spawnParticles(src.x + src.w / 2, src.y + src.h, '#ff0040', 4);
        }
        laserCooldown = Math.max(25, LASER_CD_BASE - level * 12);
    }

    // move & collide
    for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].y += LASER_SPEED;
        const l = lasers[i];

        // hit paddle?
        if (l.y + l.h >= paddle.y &&
            l.y <= paddle.y + paddle.h &&
            l.x + l.w >= paddle.x &&
            l.x <= paddle.x + paddle.w) {

            lasers.splice(i, 1);
            lives--;
            screenShake();
            spawnParticles(paddle.x + paddle.w / 2, paddle.y, '#ff0040', 10);

            if (lives <= 0) {
                gameOver();
                return;
            }
            continue;
        }

        if (l.y > H) lasers.splice(i, 1);
    }
}

function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].y += POWERUP_FALL_SPEED;
        const p = powerups[i];

        // paddle catch
        if (p.y + POWERUP_SIZE >= paddle.y &&
            p.y <= paddle.y + paddle.h &&
            p.x + POWERUP_SIZE >= paddle.x &&
            p.x <= paddle.x + paddle.w) {

            activatePower(p.type);
            spawnParticles(p.x + POWERUP_SIZE / 2, p.y + POWERUP_SIZE / 2, '#00ff88', 8);
            powerups.splice(i, 1);
            continue;
        }
        if (p.y > H) powerups.splice(i, 1);
    }

    // tick active power-up
    if (activePowerType) {
        powerTimeLeft -= 16.67;
        if (powerTimeLeft <= 0) deactivatePower();
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.dy += 0.08;        // gravity
        p.life -= 0.025;
        p.size *= 0.97;
        if (p.life <= 0 || p.size < 0.3) particles.splice(i, 1);
    }
}

// ─────────────────────────────────────────────
//  Power-Up System
// ─────────────────────────────────────────────
function spawnPowerup(x, y) {
    const type = Math.random() < 0.5 ? 'wide' : 'pierce';
    powerups.push({ x: x - POWERUP_SIZE / 2, y, type });
}

function activatePower(type) {
    // deactivate previous first
    deactivatePower();
    activePowerType = type;
    powerTimeLeft = POWERUP_DURATION;
    if (type === 'wide') {
        paddle.w = PADDLE_BASE_W * 1.8;
    } else {
        ball.piercing = true;
    }
}

function deactivatePower() {
    if (activePowerType === 'wide')   paddle.w = PADDLE_BASE_W;
    if (activePowerType === 'pierce') ball.piercing = false;
    activePowerType = null;
    powerTimeLeft = 0;
}

// ─────────────────────────────────────────────
//  Actions
// ─────────────────────────────────────────────
function nextLevel() {
    level++;
    score += 500 * level;
    deactivatePower();
    resetBall();
    createBricks();
    lasers = [];
    powerups = [];
}

function gameOver() {
    state = 'gameover';
    cancelAnimationFrame(animFrameId);
    gameoverScreen.classList.remove('hidden');
    finalScoreEl.textContent = score;
    finalLevelEl.textContent = level;
    saveMsg.textContent = '';
    saveBtn.disabled = false;

    // persist best score locally
    const best = parseInt(localStorage.getItem('arcade_score_arkanoid') || '0', 10);
    if (score > best) localStorage.setItem('arcade_score_arkanoid', score);
}

function screenShake() {
    if (shaking) return;
    shaking = true;
    canvasContainer.classList.add('shake');
    setTimeout(() => {
        canvasContainer.classList.remove('shake');
        shaking = false;
    }, SHAKE_DURATION);
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 4 + 1.5;
        particles.push({
            x, y,
            dx: Math.cos(a) * s,
            dy: Math.sin(a) * s - 1,
            size: Math.random() * 4 + 2,
            color,
            life: 1
        });
    }
}

// ─────────────────────────────────────────────
//  RENDER functions
// ─────────────────────────────────────────────
function drawBackground(t) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // stars
    for (const s of stars) {
        const twinkle = (Math.sin(t * 0.001 + s.phase) + 1) * 0.5;
        ctx.globalAlpha = s.alpha * (0.4 + twinkle * 0.6);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // subtle grid
    ctx.strokeStyle = 'rgba(0,212,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // horizon glow
    const grd = ctx.createLinearGradient(0, H - 80, 0, H);
    grd.addColorStop(0, 'transparent');
    grd.addColorStop(1, 'rgba(184,77,255,0.06)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, H - 80, W, 80);
}

function drawPaddle() {
    const p = paddle;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = activePowerType === 'wide' ? '#00ff88' : '#00d4ff';

    // gradient fill
    const grd = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
    if (activePowerType === 'wide') {
        grd.addColorStop(0, '#00ff88');
        grd.addColorStop(1, '#00cc6e');
    } else {
        grd.addColorStop(0, '#00d4ff');
        grd.addColorStop(1, '#0099cc');
    }
    ctx.fillStyle = grd;

    // rounded rect
    const r = p.h / 2;
    ctx.beginPath();
    ctx.moveTo(p.x + r, p.y);
    ctx.lineTo(p.x + p.w - r, p.y);
    ctx.arcTo(p.x + p.w, p.y, p.x + p.w, p.y + p.h, r);
    ctx.arcTo(p.x + p.w, p.y + p.h, p.x, p.y + p.h, r);
    ctx.arcTo(p.x, p.y + p.h, p.x, p.y, r);
    ctx.arcTo(p.x, p.y, p.x + p.w, p.y, r);
    ctx.closePath();
    ctx.fill();

    // inner highlight line
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + r + 4, p.y + 3);
    ctx.lineTo(p.x + p.w - r - 4, p.y + 3);
    ctx.stroke();
    ctx.restore();
}

function drawBall(t) {
    // trail
    for (let i = 0; i < ball.trail.length; i++) {
        const pt = ball.trail[i];
        const frac = i / ball.trail.length;
        ctx.globalAlpha = frac * 0.35;
        ctx.fillStyle = ball.piercing ? '#ff0040' : '#00d4ff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.r * frac * 0.9, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // main ball
    ctx.save();
    ctx.shadowBlur = ball.piercing ? 22 : 14;
    ctx.shadowColor = ball.piercing ? '#ff0040' : '#ffffff';
    ctx.fillStyle = ball.piercing ? '#ff3355' : '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // inner shine
    ctx.shadowBlur = 0;
    ctx.fillStyle = ball.piercing ? 'rgba(255,200,200,0.5)' : 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, ball.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawBricks(t) {
    for (const b of bricks) {
        if (!b.alive) continue;

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.color;

        // brick body
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // hp > 1 ⇒ inner highlight (reinforced)
        if (b.hp > 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
        }

        // subtle top highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(b.x, b.y, b.w, 3);

        // shooter indicator (small dot)
        if (b.canShoot) {
            ctx.fillStyle = '#ff0040';
            ctx.beginPath();
            ctx.arc(b.x + b.w / 2, b.y + b.h - 4, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

function drawLasers() {
    ctx.save();
    for (const l of lasers) {
        // outer glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff0040';
        ctx.fillStyle = '#ff0040';
        ctx.fillRect(l.x - 1, l.y, l.w + 2, l.h);

        // bright core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ff6680';
        ctx.fillRect(l.x, l.y + 2, l.w, l.h - 4);
    }
    ctx.restore();
}

function drawPowerups(t) {
    for (const p of powerups) {
        ctx.save();
        const pulse = Math.sin(t * 0.005) * 0.2 + 0.8;
        ctx.shadowBlur = 14 * pulse;
        ctx.shadowColor = '#00ff88';
        ctx.fillStyle = '#00ff88';

        // capsule shape
        const r = POWERUP_SIZE / 4;
        const px = p.x, py = p.y, sz = POWERUP_SIZE;
        ctx.beginPath();
        ctx.moveTo(px + r, py);
        ctx.lineTo(px + sz - r, py);
        ctx.arcTo(px + sz, py, px + sz, py + r, r);
        ctx.lineTo(px + sz, py + sz - r);
        ctx.arcTo(px + sz, py + sz, px + sz - r, py + sz, r);
        ctx.lineTo(px + r, py + sz);
        ctx.arcTo(px, py + sz, px, py + sz - r, r);
        ctx.lineTo(px, py + r);
        ctx.arcTo(px, py, px + r, py, r);
        ctx.closePath();
        ctx.fill();

        // label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#003322';
        ctx.font = 'bold 11px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type === 'wide' ? 'W' : 'P', px + sz / 2, py + sz / 2);
        ctx.restore();
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    // ── Lives (hearts) ──
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let hearts = '';
    for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️ ' : '🖤 ';
    ctx.fillText(hearts, 12, 12);

    // ── Score ──
    ctx.save();
    ctx.font = 'bold 15px "Orbitron", "Share Tech Mono", monospace';
    ctx.fillStyle = '#00d4ff';
    ctx.textAlign = 'right';
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,212,255,0.4)';
    ctx.fillText(`SCORE  ${score}`, W - 14, 14);
    ctx.restore();

    // ── Level ──
    ctx.save();
    ctx.font = 'bold 13px "Orbitron", monospace';
    ctx.fillStyle = '#b84dff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(184,77,255,0.4)';
    ctx.fillText(`LEVEL ${level}`, W / 2, 14);
    ctx.restore();

    // ── Power-up bar ──
    if (activePowerType) {
        const barW = 160;
        const barH = 6;
        const barX = W / 2 - barW / 2;
        const barY = 34;
        const ratio = Math.max(0, powerTimeLeft / POWERUP_DURATION);
        const col = activePowerType === 'wide' ? '#00ff88' : '#ff0040';

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = col;
        ctx.fillRect(barX, barY, barW * ratio, barH);

        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.fillText(
            activePowerType === 'wide' ? '★ SZEROKA PALETKA ★' : '★ PRZEBIJANIE ★',
            W / 2, barY + barH + 12
        );
    }
}

// ─────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────
function gameLoop(timestamp) {
    if (state !== 'playing') return;

    updatePaddle();
    updateBall();
    updateBricks();
    updateLasers();
    updatePowerups();
    updateParticles();

    drawBackground(timestamp);
    drawBricks(timestamp);
    drawLasers();
    drawPowerups(timestamp);
    drawParticles();
    drawPaddle();
    drawBall(timestamp);
    drawHUD();

    animFrameId = requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────
//  START / RESTART
// ─────────────────────────────────────────────
function startGame() {
    initGame();
    state = 'playing';
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
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
                gra: 'Arkanoid',
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
createStars();
loadProfile();
// draw idle background so canvas isn't blank behind the start overlay
drawBackground(0);
