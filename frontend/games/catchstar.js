const scoreVal = document.getElementById('score-val');
const timerVal = document.getElementById('timer-val');
const bestVal = document.getElementById('best-val');
const startBtn = document.getElementById('start-btn');
const targetStar = document.getElementById('target-star');
const gameArena = document.getElementById('game-arena');

let score = 0;
let remainingSeconds = 30;
let gameTimer = null;
let isPlaying = false;

function wczytajRekord() {
    const savedScore = localStorage.getItem('arcade_score_catchstar');
    bestVal.innerText = savedScore ? savedScore : '0';
}

function ustawWidok() {
    scoreVal.innerText = score;
    timerVal.innerText = remainingSeconds;
    startBtn.innerText = isPlaying ? 'GRA TRWA' : 'Rozpocznij';
    startBtn.disabled = isPlaying;
}

function losujPozycje() {
    const arenaRect = gameArena.getBoundingClientRect();
    const targetSize = targetStar.offsetWidth;
    const maxX = arenaRect.width - targetSize - 20;
    const maxY = arenaRect.height - targetSize - 20;
    const left = Math.random() * maxX + 10;
    const top = Math.random() * maxY + 10;
    targetStar.style.left = `${left}px`;
    targetStar.style.top = `${top}px`;
}

function zakonczGre() {
    clearInterval(gameTimer);
    gameTimer = null;
    isPlaying = false;
    startBtn.disabled = false;
    startBtn.innerText = 'Rozpocznij';
    const poprzedniRekord = parseInt(localStorage.getItem('arcade_score_catchstar') || '0', 10);
    if (score > poprzedniRekord) {
        localStorage.setItem('arcade_score_catchstar', score);
        bestVal.innerText = score;
        alert(`Brawo! Nowy rekord: ${score} pkt`);
    } else {
        alert(`Koniec gry! Twój wynik: ${score} pkt`);
    }
}

function startGame() {
    if (isPlaying) return;
    score = 0;
    remainingSeconds = 30;
    isPlaying = true;
    ustawWidok();
    losujPozycje();

    gameTimer = setInterval(() => {
        remainingSeconds -= 1;
        timerVal.innerText = remainingSeconds;
        if (remainingSeconds <= 0) {
            zakonczGre();
        }
    }, 1000);
}

function handleTargetClick() {
    if (!isPlaying) return;
    score += 1;
    scoreVal.innerText = score;
    losujPozycje();
}

startBtn.addEventListener('click', startGame);
targetStar.addEventListener('click', handleTargetClick);
window.addEventListener('resize', () => {
    if (isPlaying) losujPozycje();
});

wczytajRekord();
ustawWidok();
