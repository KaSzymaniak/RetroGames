import { API_URL } from '../../frontend/config.js';
import { wyslijWynikNaSerwer } from '../../frontend/scores-api.js';

// ═══════════════════════════════════════════════════
//   WARCABY — Pełna logika gry
//   Zasady polskich warcabów:
//   - Bicie jest obowiązkowe
//   - Damka to latająca damka (ruch na dowolną liczbę pól)
//   - Pionki gracza idą w górę (malejący numer rzędu)
//   - Pionki AI idą w dół (rosnący numer rzędu)
// ═══════════════════════════════════════════════════

// ─── Stałe ─────────────────────────────────────────
const EMPTY = 0, PLAYER = 1, AI = 2, PLAYER_KING = 3, AI_KING = 4;

// ─── Stan gry ──────────────────────────────────────
let board = [];
let currentTurn = 'player';    // 'player' | 'ai'
let selectedPiece = null;       // { r, c } | null
let activeMoves = [];           // dostępne ruchy dla wybranego pionka
let score = 0;
let gameActive = false;
let aiThinking = false;
let playerName = 'Anonim';
let playerAvatar = '👾';

// ─── Referencje DOM ────────────────────────────────
const boardEl         = document.getElementById('board');
const turnTextEl      = document.getElementById('turn-text');
const turnIconEl      = document.getElementById('turn-icon');
const scoreValueEl    = document.getElementById('score-value');
const playerCountEl   = document.getElementById('player-count');
const aiCountEl       = document.getElementById('ai-count');
const statusMsgEl     = document.getElementById('status-msg');
const newGameBtn      = document.getElementById('new-game-btn');
const saveBtn         = document.getElementById('save-btn');
const saveMsgEl       = document.getElementById('save-msg');
const badgeNameEl     = document.getElementById('badge-name');
const badgeAvatarEl   = document.getElementById('badge-avatar');

// ─── Pomocnicze ────────────────────────────────────
const isValidCell   = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const cloneBoard    = b => b.map(row => [...row]);
const isPlayerPiece = p => p === PLAYER || p === PLAYER_KING;
const isAIPiece     = p => p === AI || p === AI_KING;
const isKing        = p => p === PLAYER_KING || p === AI_KING;

// ─── Inicjalizacja planszy ─────────────────────────
function createInitialBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
    for (let r = 0; r < 3; r++)
        for (let c = 0; c < 8; c++)
            if ((r + c) % 2 === 1) b[r][c] = AI;
    for (let r = 5; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if ((r + c) % 2 === 1) b[r][c] = PLAYER;
    return b;
}

function initGame() {
    board = createInitialBoard();
    currentTurn = 'player';
    selectedPiece = null;
    activeMoves = [];
    score = 0;
    gameActive = true;
    aiThinking = false;
    saveBtn.disabled = true;
    saveMsgEl.textContent = '';
    scoreValueEl.textContent = '0';
    const counts = countPieces(board);
    playerCountEl.textContent = counts.player;
    aiCountEl.textContent = counts.ai;
    renderBoard();
    updateUI();
    showStatus('Wybierz pionek i wykonaj ruch.', 'info');
}

// ─── Generowanie ruchów ────────────────────────────

/**
 * Rekurencyjnie zwraca wszystkie łańcuchy bić dostępne dla pionka na (r,c).
 * Każdy łańcuch ma format: { from, to, captures: [{r,c},...] }
 */
function getCaptureChains(b, r, c, visited = []) {
    const piece = b[r][c];
    if (piece === EMPTY) return [];

    const king = isKing(piece);
    const playerPiece = isPlayerPiece(piece);
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const chains = [];

    for (const [dr, dc] of dirs) {
        if (!king) {
            // Zwykły pionek: skok przez sąsiedni pionek przeciwnika
            const mr = r + dr, mc = c + dc;
            const tr = r + 2 * dr, tc = c + 2 * dc;
            if (!isValidCell(tr, tc)) continue;
            const midPiece = b[mr][mc];
            const captKey = `${mr},${mc}`;
            if (visited.includes(captKey)) continue;
            if (midPiece === EMPTY) continue;
            const isOpp = playerPiece ? isAIPiece(midPiece) : isPlayerPiece(midPiece);
            if (!isOpp) continue;
            if (b[tr][tc] !== EMPTY) continue;

            const nb = cloneBoard(b);
            nb[r][c] = EMPTY;
            nb[mr][mc] = EMPTY;
            nb[tr][tc] = piece;

            const cont = getCaptureChains(nb, tr, tc, [...visited, captKey]);
            if (cont.length === 0) {
                chains.push({ from: { r, c }, to: { r: tr, c: tc }, captures: [{ r: mr, c: mc }] });
            } else {
                for (const sub of cont) {
                    chains.push({
                        from: { r, c },
                        to: sub.to,
                        captures: [{ r: mr, c: mc }, ...sub.captures]
                    });
                }
            }
        } else {
            // Latająca damka: skan po przekątnej w poszukiwaniu pionka przeciwnika
            let foundOpponent = false;
            for (let d = 1; d < 8 && !foundOpponent; d++) {
                const mr = r + d * dr, mc = c + d * dc;
                if (!isValidCell(mr, mc)) break;
                const midPiece = b[mr][mc];
                const captKey = `${mr},${mc}`;
                if (midPiece === EMPTY) continue;
                if (visited.includes(captKey)) break;
                const isOpp = playerPiece ? isAIPiece(midPiece) : isPlayerPiece(midPiece);
                if (!isOpp) break;
                foundOpponent = true;

                // Lądowanie na dowolnym wolnym polu za bitym pionkiem
                for (let ld = d + 1; ld < 8; ld++) {
                    const tr = r + ld * dr, tc = c + ld * dc;
                    if (!isValidCell(tr, tc)) break;
                    if (b[tr][tc] !== EMPTY) break;

                    const nb = cloneBoard(b);
                    nb[r][c] = EMPTY;
                    nb[mr][mc] = EMPTY;
                    nb[tr][tc] = piece;

                    const cont = getCaptureChains(nb, tr, tc, [...visited, captKey]);
                    if (cont.length === 0) {
                        chains.push({ from: { r, c }, to: { r: tr, c: tc }, captures: [{ r: mr, c: mc }] });
                    } else {
                        for (const sub of cont) {
                            chains.push({
                                from: { r, c },
                                to: sub.to,
                                captures: [{ r: mr, c: mc }, ...sub.captures]
                            });
                        }
                    }
                }
            }
        }
    }
    return chains;
}

/**
 * Zwraca proste ruchy (bez bicia) dla pionka na (r,c).
 */
function getSimpleMoves(b, r, c) {
    const piece = b[r][c];
    if (piece === EMPTY) return [];
    const king = isKing(piece);
    const playerPiece = isPlayerPiece(piece);
    const moves = [];
    const dirs = king
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : playerPiece ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];

    for (const [dr, dc] of dirs) {
        if (!king) {
            const tr = r + dr, tc = c + dc;
            if (isValidCell(tr, tc) && b[tr][tc] === EMPTY)
                moves.push({ from: { r, c }, to: { r: tr, c: tc }, captures: [] });
        } else {
            for (let d = 1; d < 8; d++) {
                const tr = r + d * dr, tc = c + d * dc;
                if (!isValidCell(tr, tc) || b[tr][tc] !== EMPTY) break;
                moves.push({ from: { r, c }, to: { r: tr, c: tc }, captures: [] });
            }
        }
    }
    return moves;
}

/**
 * Zwraca wszystkie legalne ruchy dla danej strony.
 * Jeśli istnieją bicia — zwraca wyłącznie bicia (obowiązkowe).
 */
function getAllLegalMoves(b, turn) {
    const allCaptures = [];
    const allSimple = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = b[r][c];
            if (turn === 'player' && !isPlayerPiece(piece)) continue;
            if (turn === 'ai' && !isAIPiece(piece)) continue;
            allCaptures.push(...getCaptureChains(b, r, c));
            if (allCaptures.length === 0) allSimple.push(...getSimpleMoves(b, r, c));
        }
    }
    // Jeśli znaleziono bicia, zbierz też pozostałe bicia (nie dodane jeszcze)
    if (allCaptures.length > 0) {
        // Dogeneruj bicia dla pozostałych pionków
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = b[r][c];
                if (turn === 'player' && !isPlayerPiece(piece)) continue;
                if (turn === 'ai' && !isAIPiece(piece)) continue;
                const already = allCaptures.some(m => m.from.r === r && m.from.c === c);
                if (!already) allCaptures.push(...getCaptureChains(b, r, c));
            }
        }
        return allCaptures;
    }
    return allSimple;
}

// ─── Aplikowanie ruchu ─────────────────────────────
function applyMoveToBoard(b, move) {
    const nb = cloneBoard(b);
    const piece = nb[move.from.r][move.from.c];
    nb[move.from.r][move.from.c] = EMPTY;
    for (const cap of move.captures) nb[cap.r][cap.c] = EMPTY;
    nb[move.to.r][move.to.c] = piece;
    // Promocja na damkę
    if (piece === PLAYER && move.to.r === 0) nb[move.to.r][move.to.c] = PLAYER_KING;
    if (piece === AI    && move.to.r === 7) nb[move.to.r][move.to.c] = AI_KING;
    return nb;
}

// ─── Liczenie pionków ──────────────────────────────
function countPieces(b) {
    let player = 0, ai = 0;
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            if (isPlayerPiece(b[r][c])) player++;
            else if (isAIPiece(b[r][c])) ai++;
        }
    return { player, ai };
}

// ─── Koniec gry ────────────────────────────────────
function endGame(winner) {
    gameActive = false;
    aiThinking = false;
    selectedPiece = null;
    activeMoves = [];
    renderBoard();
    if (winner === 'player') {
        score += 100;
        scoreValueEl.textContent = score;
        showStatus('🏆 Wygrałeś! Doskonała gra! +100 pkt za zwycięstwo.', 'win');
        saveBtn.disabled = false;
    } else if (winner === 'ai') {
        showStatus('💀 Przegrałeś. Nie poddawaj się, spróbuj jeszcze raz!', 'loss');
        if (score > 0) saveBtn.disabled = false;
    } else {
        showStatus('🤝 Remis! Żadna ze stron nie ma ruchów.', 'info');
        if (score > 0) saveBtn.disabled = false;
    }

    const best = parseInt(localStorage.getItem('arcade_score_warcaby') || '0', 10);
    if (score > best) {
        localStorage.setItem('arcade_score_warcaby', score);
        wyslijWynikNaSerwer('Warcaby', score).catch(() => {});
    }
}

// ─── Sztuczna inteligencja ─────────────────────────

/**
 * Funkcja oceny planszy (z perspektywy AI = maksymalizujący).
 * Uwzględnia materiał, pozycję i premie za damki.
 */
function evaluateBoard(b) {
    let val = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p === AI)          val += 10 + r * 0.3;          // postęp w kierunku damki
            else if (p === AI_KING)    val += 22;
            else if (p === PLAYER)     val -= 10 + (7 - r) * 0.3; // postęp gracza
            else if (p === PLAYER_KING) val -= 22;
        }
    }
    return val;
}

/** Minimax z odcięciem alfa-beta (głębokość 3). */
function minimax(b, depth, isMax, alpha, beta) {
    const turn = isMax ? 'ai' : 'player';
    const moves = getAllLegalMoves(b, turn);
    if (depth === 0 || moves.length === 0) return evaluateBoard(b);

    if (isMax) {
        let best = -Infinity;
        for (const m of moves) {
            best = Math.max(best, minimax(applyMoveToBoard(b, m), depth - 1, false, alpha, beta));
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = Infinity;
        for (const m of moves) {
            best = Math.min(best, minimax(applyMoveToBoard(b, m), depth - 1, true, alpha, beta));
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }
}

function aiMove() {
    if (!gameActive) return;
    const moves = getAllLegalMoves(board, 'ai');
    if (moves.length === 0) { endGame('player'); return; }

    const counts = countPieces(board);
    // Przy mniej niż 6 pionkach po każdej stronie — głębiej
    const depth = (counts.player <= 5 || counts.ai <= 5) ? 4 : 3;

    let bestScore = -Infinity;
    let bestMoves = [];
    for (const m of moves) {
        const s = minimax(applyMoveToBoard(board, m), depth - 1, false, -Infinity, Infinity);
        if (s > bestScore) { bestScore = s; bestMoves = [m]; }
        else if (s === bestScore) bestMoves.push(m);
    }

    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    board = applyMoveToBoard(board, chosen);

    const newCounts = countPieces(board);
    playerCountEl.textContent = newCounts.player;
    aiCountEl.textContent = newCounts.ai;
    renderBoard();

    const playerMoves = getAllLegalMoves(board, 'player');
    if (newCounts.player === 0 || playerMoves.length === 0) {
        endGame('ai');
        return;
    }

    currentTurn = 'player';
    aiThinking = false;
    updateUI();
    showStatus('Twój ruch. Wybierz pionek.', 'info');
}

// ─── Interakcja gracza ─────────────────────────────
function handleCellClick(r, c) {
    if (!gameActive || currentTurn !== 'player' || aiThinking) return;

    // Kliknięto na cel ruchu
    if (selectedPiece) {
        const matchingMove = activeMoves.find(m => m.to.r === r && m.to.c === c);
        if (matchingMove) {
            executePlayerMove(matchingMove);
            return;
        }
        // Kliknięto w inny pionek — zmień wybór
        selectedPiece = null;
        activeMoves = [];
    }

    // Wybór pionka gracza
    if (isPlayerPiece(board[r][c])) {
        const allLegal = getAllLegalMoves(board, 'player');
        const hasCaptures = allLegal.some(m => m.captures.length > 0);
        let pieceMoves = allLegal.filter(m => m.from.r === r && m.from.c === c);
        if (hasCaptures) pieceMoves = pieceMoves.filter(m => m.captures.length > 0);

        if (pieceMoves.length > 0) {
            selectedPiece = { r, c };
            activeMoves = pieceMoves;
            showStatus(`Wybrano pionek. Dostępnych ruchów: ${pieceMoves.length}.`, 'info');
        } else if (hasCaptures) {
            showStatus('⚠️ Musisz wykonać bicie! Wybierz pionek, który może bić.', 'warn');
        } else {
            showStatus('Ten pionek nie ma dostępnych ruchów.', 'warn');
        }
    }

    renderBoard();
}

function executePlayerMove(move) {
    const captureCount = move.captures.length;
    const piece = board[move.from.r][move.from.c];

    // Punkty za bicia
    if (captureCount > 0) score += captureCount * 10;
    // Premia za awans na damkę
    if (piece === PLAYER && move.to.r === 0) score += 5;

    board = applyMoveToBoard(board, move);
    selectedPiece = null;
    activeMoves = [];

    const counts = countPieces(board);
    scoreValueEl.textContent = score;
    playerCountEl.textContent = counts.player;
    aiCountEl.textContent = counts.ai;
    renderBoard();

    const aiMoves = getAllLegalMoves(board, 'ai');
    if (counts.ai === 0 || aiMoves.length === 0) {
        endGame('player');
        return;
    }

    currentTurn = 'ai';
    aiThinking = true;
    updateUI();
    showStatus('Przeciwnik analizuje sytuację...', 'ai');
    setTimeout(aiMove, 500 + Math.random() * 500);
}

// ─── Renderowanie planszy ──────────────────────────
function renderBoard() {
    boardEl.innerHTML = '';
    const validTargets   = new Set(activeMoves.map(m => `${m.to.r},${m.to.c}`));
    const captureTargets = new Set(
        activeMoves.filter(m => m.captures.length > 0).map(m => `${m.to.r},${m.to.c}`)
    );

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            const isDark = (r + c) % 2 === 1;
            cell.className = `cell ${isDark ? 'dark-cell' : 'light-cell'}`;
            cell.dataset.r = r;
            cell.dataset.c = c;

            const key = `${r},${c}`;

            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c)
                cell.classList.add('selected');

            if (validTargets.has(key)) {
                cell.classList.add(captureTargets.has(key) ? 'capture-target' : 'move-target');
                const dot = document.createElement('div');
                dot.className = 'move-dot';
                cell.appendChild(dot);
            }

            const piece = board[r][c];
            if (piece !== EMPTY) {
                const pieceEl = document.createElement('div');
                pieceEl.className = 'piece';
                pieceEl.classList.add(isPlayerPiece(piece) ? 'player-piece' : 'ai-piece');
                if (isKing(piece)) {
                    pieceEl.classList.add('king');
                    const crown = document.createElement('span');
                    crown.className = 'crown-icon';
                    crown.textContent = '♛';
                    pieceEl.appendChild(crown);
                }
                cell.appendChild(pieceEl);
            }

            if (isDark) cell.addEventListener('click', () => handleCellClick(r, c));
            boardEl.appendChild(cell);
        }
    }
}

// ─── Aktualizacja UI ───────────────────────────────
function updateUI() {
    if (currentTurn === 'player') {
        turnIconEl.className = 'turn-piece-icon player-turn-icon';
        turnTextEl.textContent = aiThinking ? 'Przeciwnik...' : 'Twój ruch';
        turnTextEl.style.color = 'var(--neon-amber)';
    } else {
        turnIconEl.className = 'turn-piece-icon ai-turn-icon';
        turnTextEl.textContent = 'Ruch AI';
        turnTextEl.style.color = 'var(--neon-red)';
    }
}

function showStatus(msg, type = 'info') {
    statusMsgEl.textContent = msg;
    statusMsgEl.className = `status-msg status-${type}`;
}

// ─── Zapis wyniku ──────────────────────────────────
async function saveScore() {
    saveBtn.disabled = true;
    saveMsgEl.textContent = 'Wysyłanie wyniku...';
    saveMsgEl.style.color = 'var(--neon-amber)';

    try {
        const data = await wyslijWynikNaSerwer('Warcaby', score);
        saveMsgEl.textContent = '✅ ' + data.message;
        saveMsgEl.style.color = 'var(--neon-green)';
    } catch {
        saveMsgEl.textContent = '❌ Serwer offline — spróbuj ponownie później.';
        saveMsgEl.style.color = 'var(--neon-red)';
        saveBtn.disabled = false;
    }
}

// ─── Wczytanie profilu ─────────────────────────────
function loadProfile() {
    playerName   = localStorage.getItem('arcade_nickname') || 'Anonim';
    playerAvatar = localStorage.getItem('arcade_avatar')   || '👾';
    badgeNameEl.textContent   = playerName;
    badgeAvatarEl.textContent = playerAvatar;
}

// ─── Event Listeners ───────────────────────────────
newGameBtn.addEventListener('click', initGame);
saveBtn.addEventListener('click', saveScore);

// ─── Start ─────────────────────────────────────────
loadProfile();
initGame();
