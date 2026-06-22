import { wyslijWynikNaSerwer } from '../../frontend/scores-api.js';

const DIFFICULTIES = {
    beginner:     { rows: 9,  cols: 9,  mines: 10, label: 'Początkujący',  baseScore: 100 },
    intermediate: { rows: 16, cols: 16, mines: 40, label: 'Średni',        baseScore: 300 },
    expert:       { rows: 16, cols: 30, mines: 99, label: 'Ekspert',       baseScore: 1000 }
};

const FACES = {
    idle: '🙂',
    pressed: '😮',
    win: '😎',
    lose: '😵'
};

const THEME_KEY = 'saper_theme';
const DIFF_KEY = 'saper_difficulty';

// ── DOM ──
const winWindow = document.getElementById('win-window');
const boardGrid = document.getElementById('board-grid');
const mineCounter = document.getElementById('mine-counter');
const timerEl = document.getElementById('timer');
const faceBtn = document.getElementById('face-btn');
const statusText = document.getElementById('status-text');
const diffLabel = document.getElementById('diff-label');
const scoreMsg = document.getElementById('score-msg');
// ── Stan gry ──
let diff = localStorage.getItem(DIFF_KEY) || 'beginner';
let theme = localStorage.getItem(THEME_KEY) || 'dark';
let board = [];
let revealed = [];
let flagged = [];
let mines = [];
let gameOver = false;
let won = false;
let firstClick = true;
let flagsPlaced = 0;
let seconds = 0;
let timerInterval = null;
let mouseDown = false;

// ── Inicjalizacja ──
function init() {
    applyTheme(theme);
    odswiezProfilGracza();
    setupMenus();
    newGame();
}

function odswiezProfilGracza() {
    document.getElementById('badge-name').innerText = localStorage.getItem('arcade_nickname') || 'Anonim';
    document.getElementById('badge-avatar').innerText = localStorage.getItem('arcade_avatar') || '👾';
}

function applyTheme(t) {
    theme = t;
    winWindow.dataset.theme = t;
    document.body.dataset.pageTheme = t;
    localStorage.setItem(THEME_KEY, t);
}

function setupMenus() {
    document.querySelectorAll('.win-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = btn.parentElement;
            const wasOpen = menu.classList.contains('open');
            document.querySelectorAll('.win-menu').forEach(m => m.classList.remove('open'));
            if (!wasOpen) menu.classList.add('open');
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.win-menu').forEach(m => m.classList.remove('open'));
    });

    document.querySelectorAll('[data-diff]').forEach(btn => {
        btn.addEventListener('click', () => {
            diff = btn.dataset.diff;
            localStorage.setItem(DIFF_KEY, diff);
            newGame();
        });
    });

    document.getElementById('menu-new-game').addEventListener('click', newGame);

    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });

    faceBtn.addEventListener('click', newGame);
    faceBtn.addEventListener('mousedown', () => {
        if (!gameOver) faceBtn.textContent = FACES.pressed;
    });
    faceBtn.addEventListener('mouseup', () => updateFace());
    faceBtn.addEventListener('mouseleave', () => updateFace());

    document.addEventListener('contextmenu', e => {
        if (e.target.closest('.board-grid')) e.preventDefault();
    });
}

// ── Nowa gra ──
function newGame() {
    stopTimer();
    const cfg = DIFFICULTIES[diff];
    gameOver = false;
    won = false;
    firstClick = true;
    flagsPlaced = 0;
    seconds = 0;
    scoreMsg.textContent = '';
    scoreMsg.className = 'score-msg';

    board = Array.from({ length: cfg.rows }, () => Array(cfg.cols).fill(0));
    revealed = Array.from({ length: cfg.rows }, () => Array(cfg.cols).fill(false));
    flagged = Array.from({ length: cfg.rows }, () => Array(cfg.cols).fill(false));
    mines = [];

    diffLabel.textContent = cfg.label;
    updateMineCounter();
    updateTimer();
    updateFace();
    statusText.textContent = 'Kliknij pole, aby rozpocząć.';
    renderBoard();
}

function placeMines(safeR, safeC) {
    const cfg = DIFFICULTIES[diff];
    const positions = new Set();
    while (positions.size < cfg.mines) {
        const r = Math.floor(Math.random() * cfg.rows);
        const c = Math.floor(Math.random() * cfg.cols);
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        positions.add(`${r},${c}`);
    }
    positions.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        board[r][c] = -1;
        mines.push([r, c]);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols && board[nr][nc] !== -1) {
                    board[nr][nc]++;
                }
            }
        }
    });
}

// ── Render ──
function renderBoard() {
    const cfg = DIFFICULTIES[diff];
    boardGrid.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    boardGrid.innerHTML = '';

    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            const cell = document.createElement('button');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.type = 'button';
            updateCellAppearance(cell, r, c);

            cell.addEventListener('mousedown', (e) => {
                if (e.button === 0) mouseDown = true;
                if (!gameOver && !revealed[r][c] && !flagged[r][c]) {
                    faceBtn.textContent = FACES.pressed;
                }
            });

            cell.addEventListener('mouseup', () => {
                mouseDown = false;
                updateFace();
            });

            cell.addEventListener('mouseleave', () => {
                if (mouseDown) updateFace();
            });

            cell.addEventListener('click', (e) => {
                e.preventDefault();
                revealCell(r, c);
            });

            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                toggleFlag(r, c);
            });

            boardGrid.appendChild(cell);
        }
    }
}

function updateCellAppearance(cell, r, c) {
    const val = board[r][c];
    cell.className = 'cell';
    cell.textContent = '';

    if (flagged[r][c] && !revealed[r][c]) {
        cell.classList.add('flagged');
        cell.textContent = '🚩';
        return;
    }

    if (!revealed[r][c]) {
        cell.classList.add('hidden');
        if (gameOver) cell.classList.add('game-over');
        return;
    }

    cell.classList.add('revealed');
    if (val === -1) {
        cell.textContent = '💣';
        if (gameOver && !won) cell.classList.add('mine-hit');
    } else if (val > 0) {
        cell.classList.add(`num-${val}`);
        cell.textContent = val;
    }
}

function refreshCells() {
    const cells = boardGrid.querySelectorAll('.cell');
    cells.forEach(cell => {
        const r = +cell.dataset.r, c = +cell.dataset.c;
        updateCellAppearance(cell, r, c);
    });
}

// ── Logika ──
function revealCell(r, c) {
    if (gameOver || flagged[r][c] || revealed[r][c]) return;

    if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        startTimer();
        statusText.textContent = 'Szukaj min...';
    }

    if (board[r][c] === -1) {
        revealed[r][c] = true;
        endGame(false);
        return;
    }

    floodReveal(r, c);
    checkWin();
    refreshCells();
}

function floodReveal(r, c) {
    const cfg = DIFFICULTIES[diff];
    const stack = [[r, c]];

    while (stack.length) {
        const [cr, cc] = stack.pop();
        if (cr < 0 || cr >= cfg.rows || cc < 0 || cc >= cfg.cols) continue;
        if (revealed[cr][cc] || flagged[cr][cc]) continue;

        revealed[cr][cc] = true;
        if (board[cr][cc] === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    stack.push([cr + dr, cc + dc]);
                }
            }
        }
    }
}

function toggleFlag(r, c) {
    if (gameOver || revealed[r][c] || firstClick) return;

    if (flagged[r][c]) {
        flagged[r][c] = false;
        flagsPlaced--;
    } else {
        flagged[r][c] = true;
        flagsPlaced++;
    }
    updateMineCounter();
    refreshCells();
}

function checkWin() {
    const cfg = DIFFICULTIES[diff];
    let unrevealedSafe = 0;
    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            if (!revealed[r][c] && board[r][c] !== -1) unrevealedSafe++;
        }
    }
    if (unrevealedSafe === 0) endGame(true);
}

function endGame(isWin) {
    gameOver = true;
    won = isWin;
    stopTimer();

    const cfg = DIFFICULTIES[diff];
    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            if (board[r][c] === -1) revealed[r][c] = true;
        }
    }

    if (isWin) {
        updateFace();
        statusText.textContent = `Wygrana! Czas: ${seconds}s`;
        saveScore();
    } else {
        faceBtn.textContent = FACES.lose;
        statusText.textContent = 'Boom! Spróbuj ponownie.';
    }
    refreshCells();
}

function calcScore() {
    const cfg = DIFFICULTIES[diff];
    const timeBonus = Math.max(0, 300 - seconds);
    return cfg.baseScore + timeBonus;
}

async function saveScore() {
    const punkty = calcScore();
    scoreMsg.textContent = 'Zapisywanie wyniku...';
    scoreMsg.className = 'score-msg';

    try {
        const dane = await wyslijWynikNaSerwer('Saper', punkty);
        const best = parseInt(localStorage.getItem('arcade_score_saper') || '0', 10);
        if (punkty > best) localStorage.setItem('arcade_score_saper', punkty);
        scoreMsg.textContent = `+${punkty} pkt — ${dane.message}`;
        scoreMsg.className = 'score-msg success';
    } catch {
        const best = parseInt(localStorage.getItem('arcade_score_saper') || '0', 10);
        if (punkty > best) localStorage.setItem('arcade_score_saper', punkty);
        scoreMsg.textContent = `+${punkty} pkt (zapis lokalny — uruchom backend, aby wysłać na serwer)`;
        scoreMsg.className = 'score-msg error';
    }
}

// ── Timer & UI ──
function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
        seconds++;
        if (seconds >= 999) { seconds = 999; stopTimer(); }
        updateTimer();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimer() {
    timerEl.textContent = String(seconds).padStart(3, '0');
}

function updateMineCounter() {
    const cfg = DIFFICULTIES[diff];
    const remaining = Math.max(-99, cfg.mines - flagsPlaced);
    const display = remaining < 0
        ? '-' + String(Math.abs(remaining)).padStart(2, '0')
        : String(remaining).padStart(3, '0');
    mineCounter.textContent = display;
}

function updateFace() {
    if (gameOver) {
        faceBtn.textContent = won ? FACES.win : FACES.lose;
    } else {
        faceBtn.textContent = FACES.idle;
    }
}

init();
