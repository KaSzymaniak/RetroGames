import { API_URL } from '../../frontend/config.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const scoreValEl = document.getElementById('score-val');
const bestValEl = document.getElementById('best-val');
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const saveBtn = document.getElementById('save-btn');
const saveMsg = document.getElementById('save-msg');
const badgeNameEl = document.getElementById('badge-name');
const badgeAvatarEl = document.getElementById('badge-avatar');

const GRAVITY = 0.45;
const FLAP = -7.5;
const PIPE_GAP = 140;
const PIPE_WIDTH = 56;
const PIPE_SPEED = 2.8;
const PIPE_SPAWN = 90;

let bird, pipes, score, bestScore, frameCount, gameState, animId;

function initBird() {
    bird = {
        x: 80,
        y: H / 2,
        radius: 16,
        vy: 0,
        rotation: 0
    };
}

function initPipes() {
    pipes = [];
    frameCount = 0;
}

function resetGame() {
    initBird();
    initPipes();
    score = 0;
    scoreValEl.textContent = '0';
    saveMsg.textContent = '';
    saveBtn.disabled = false;
}

function spawnPipe() {
    const minTop = 60;
    const maxTop = H - PIPE_GAP - 80;
    const topHeight = minTop + Math.random() * (maxTop - minTop);
    pipes.push({
        x: W + PIPE_WIDTH,
        top: topHeight,
        passed: false
    });
}

function flap() {
    if (gameState === 'ready') {
        gameState = 'playing';
        startScreen.classList.add('hidden');
    }
    if (gameState === 'playing') {
        bird.vy = FLAP;
    }
}

function update() {
    if (gameState !== 'playing') return;

    bird.vy += GRAVITY;
    bird.y += bird.vy;
    bird.rotation = Math.min(Math.max(bird.vy * 3, -25), 70);

    frameCount++;
    if (frameCount % PIPE_SPAWN === 0) {
        spawnPipe();
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= PIPE_SPEED;

        if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
            p.passed = true;
            score++;
            scoreValEl.textContent = score;
        }

        if (p.x + PIPE_WIDTH < -10) {
            pipes.splice(i, 1);
        }
    }

    if (bird.y + bird.radius >= H - 20 || bird.y - bird.radius <= 0) {
        endGame();
        return;
    }

    for (const p of pipes) {
        const inX = bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + PIPE_WIDTH;
        const hitTop = bird.y - bird.radius < p.top;
        const hitBottom = bird.y + bird.radius > p.top + PIPE_GAP;
        if (inX && (hitTop || hitBottom)) {
            endGame();
            return;
        }
    }
}

function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1b2a');
    grad.addColorStop(0.6, '#1b2838');
    grad.addColorStop(1, '#2d1f0e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255, 215, 0, 0.06)';
    for (let i = 0; i < 30; i++) {
        const sx = (i * 137 + frameCount * 0.3) % W;
        const sy = (i * 89) % (H * 0.6);
        ctx.fillRect(sx, sy, 2, 2);
    }

    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, H - 20, W, 20);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 20);
    ctx.lineTo(W, H - 20);
    ctx.stroke();
}

function drawPipe(p) {
    const bottomY = p.top + PIPE_GAP;

    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.top);
    ctx.fillRect(p.x, bottomY, PIPE_WIDTH, H - bottomY - 20);

    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(p.x - 4, p.top - 16, PIPE_WIDTH + 8, 16);
    ctx.fillRect(p.x - 4, bottomY, PIPE_WIDTH + 8, 16);

    ctx.shadowBlur = 0;
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate((bird.rotation * Math.PI) / 180);

    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff006e';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(bird.radius - 2, -4);
    ctx.lineTo(bird.radius + 10, 0);
    ctx.lineTo(bird.radius - 2, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(6, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.arc(7, -5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
}

function draw() {
    drawBackground();
    pipes.forEach(drawPipe);
    drawBird();
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'playing') {
        animId = requestAnimationFrame(gameLoop);
    }
}

function endGame() {
    gameState = 'over';
    cancelAnimationFrame(animId);

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('arcade_score_flappy', bestScore);
        bestValEl.textContent = bestScore;
    }

    finalScoreEl.textContent = score;
    gameoverScreen.classList.remove('hidden');
}

function startGame() {
    resetGame();
    gameoverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    gameState = 'ready';
    draw();
}

function beginPlaying() {
    gameState = 'playing';
    startScreen.classList.add('hidden');
    animId = requestAnimationFrame(gameLoop);
}

function loadProfile() {
    badgeNameEl.textContent = localStorage.getItem('arcade_nickname') || 'Anonim';
    badgeAvatarEl.textContent = localStorage.getItem('arcade_avatar') || '👾';
    bestScore = parseInt(localStorage.getItem('arcade_score_flappy') || '0', 10);
    bestValEl.textContent = bestScore;
}

startBtn.addEventListener('click', () => {
    resetGame();
    beginPlaying();
});

restartBtn.addEventListener('click', startGame);

saveBtn.addEventListener('click', async () => {
    const nick = localStorage.getItem('arcade_nickname') || 'Anonim';
    const avatar = localStorage.getItem('arcade_avatar') || '👾';

    saveBtn.disabled = true;
    saveMsg.textContent = 'Wysyłanie...';
    saveMsg.style.color = '#ffd700';

    try {
        const resp = await fetch(`${API_URL}/api/zapisz-wynik`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nick,
                avatar,
                gra: 'Flappy Bird',
                punkty: score
            })
        });
        const data = await resp.json();
        saveMsg.textContent = '✅ ' + data.message;
        saveMsg.style.color = '#00ff88';
    } catch {
        saveMsg.textContent = 'ℹ️ Wynik zapisany lokalnie (serwer offline).';
        saveMsg.style.color = '#00ff88';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'ready') beginPlaying();
        flap();
    }
});

canvas.addEventListener('click', () => {
    if (gameState === 'ready') beginPlaying();
    flap();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'ready') beginPlaying();
    flap();
}, { passive: false });

loadProfile();
resetGame();
gameState = 'ready';
draw();
