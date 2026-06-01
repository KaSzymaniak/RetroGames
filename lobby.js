import { API_URL } from './config.js';

// Selektory
const nicknameInput = document.getElementById('nickname');
const saveProfileBtn = document.getElementById('save-profile-btn');
const avatarOpts = document.querySelectorAll('.avatar-opt');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const systemTimeVal = document.getElementById('system-time');
const searchInput = document.getElementById('game-search');
const gameCards = document.querySelectorAll('.game-card');
const leaderboardBody = document.getElementById('leaderboard-body');
const tabButtons = document.querySelectorAll('.tab-btn');

// Stan lokalny aplikacji
let currentAvatar = '👾';
let currentNickname = 'Anonim';
let selectedGameTab = 'saper';

// Tabela wyników (Makieta dynamiczna połączona z zapisem)
const leaderboardMockData = {
    saper: [
        { name: 'Slayer99', avatar: '🤖', score: 100 },
        { name: 'NeoArcade', avatar: '🚀', score: 100 },
        { name: 'PixelKing', avatar: '🕹️', score: 100 },
        { name: 'MinesWrecker', avatar: '🦊', score: 100 }
    ],
    catchstar: [
        { name: 'StarHunter', avatar: '⭐', score: 28 },
        { name: 'QuickFingers', avatar: '🚀', score: 21 },
        { name: 'ClickMaster', avatar: '🤖', score: 17 }
    ],
    oczko: [
        { name: 'CasinoRoyale', avatar: '🐱', score: 210 },
        { name: 'BlackjackPro', avatar: '🤖', score: 180 },
        { name: 'LuckyLady', avatar: '🦊', score: 150 }
    ],
    ruletka: [
        { name: 'RedOrBlack', avatar: '🚀', score: 500 },
        { name: 'WheelSpinner', avatar: '👾', score: 350 },
        { name: 'Rohan', avatar: '🕹️', score: 200 }
    ]
};

// 1. Sprawdzanie Statusu Serwera
async function sprawdzSerwer() {
    try {
        statusIndicator.className = 'pulse-dot connecting';
        statusText.innerText = 'ŁĄCZENIE...';
        statusText.style.color = 'var(--neon-yellow)';

        const odpowiedz = await fetch(`${API_URL}/api/status`);
        if (odpowiedz.ok) {
            statusIndicator.className = 'pulse-dot online';
            statusText.innerText = 'ONLINE';
            statusText.style.color = 'var(--neon-green)';
        } else {
            ustawSerwerOffline();
        }
    } catch (err) {
        ustawSerwerOffline();
    }
}

function ustawSerwerOffline() {
    statusIndicator.className = 'pulse-dot offline';
    statusText.innerText = 'OFFLINE';
    statusText.style.color = 'var(--neon-pink)';
}

// 2. Zarządzanie Profilem Użytkownika
function wczytajProfil() {
    const zapisanyNick = localStorage.getItem('arcade_nickname');
    const zapisanyAvatar = localStorage.getItem('arcade_avatar');

    if (zapisanyNick) {
        currentNickname = zapisanyNick;
        nicknameInput.value = zapisanyNick;
    } else {
        currentNickname = 'GraczRetro';
        nicknameInput.value = 'GraczRetro';
        localStorage.setItem('arcade_nickname', 'GraczRetro');
    }

    if (zapisanyAvatar) {
        currentAvatar = zapisanyAvatar;
    } else {
        currentAvatar = '👾';
        localStorage.setItem('arcade_avatar', '👾');
    }

    // Aktualizacja aktywności avatara w UI
    avatarOpts.forEach(opt => {
        if (opt.dataset.avatar === currentAvatar) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });

    wczytajLeaderboard();
}

function zapiszProfil() {
    const wpisanyNick = nicknameInput.value.trim();
    if (!wpisanyNick) {
        alert('Pseudonim nie może być pusty!');
        return;
    }

    currentNickname = wpisanyNick;
    localStorage.setItem('arcade_nickname', wpisanyNick);
    localStorage.setItem('arcade_avatar', currentAvatar);

    // Animacja przycisku zapisu
    saveProfileBtn.innerText = 'ZAPISANO! ✔';
    saveProfileBtn.style.background = 'linear-gradient(135deg, var(--neon-green) 0%, #17b978 100%)';
    saveProfileBtn.style.boxShadow = '0 0 15px var(--neon-green)';

    setTimeout(() => {
        saveProfileBtn.innerText = 'Zapisz Profil';
        saveProfileBtn.style.background = '';
        saveProfileBtn.style.boxShadow = '';
    }, 2000);

    wczytajLeaderboard();
}

// Obsługa kliknięcia w wybór awatara
avatarOpts.forEach(opt => {
    opt.addEventListener('click', () => {
        avatarOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        currentAvatar = opt.dataset.avatar;
    });
});

saveProfileBtn.addEventListener('click', zapiszProfil);

// 3. Wyszukiwarka Gier (Filtrowanie)
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    gameCards.forEach(card => {
        const title = card.dataset.title.toLowerCase();
        const genre = card.dataset.genre.toLowerCase();

        if (title.includes(query) || genre.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
});

// 4. Tablica Wyników (Leaderboard)
function wczytajLeaderboard() {
    leaderboardBody.innerHTML = '';
    
    // Sprawdzenie lokalnych punktów użytkownika, jeśli grał
    const lokalnePunkty = localStorage.getItem(`arcade_score_${selectedGameTab}`);
    
    let scoresList = [...leaderboardMockData[selectedGameTab]];

    // Jeśli gracz ma zapisany wynik, wstrzyknij go na odpowiednie miejsce w tabeli
    if (lokalnePunkty) {
        const punktyVal = parseInt(lokalnePunkty, 10);
        // Sprawdzamy czy już istnieje na liście
        const istnieje = scoresList.some(item => item.name === currentNickname);
        if (!istnieje) {
            scoresList.push({
                name: currentNickname + ' (Ty)',
                avatar: currentAvatar,
                score: punktyVal
            });
        }
    }

    // Sortowanie wyników od najwyższego
    scoresList.sort((a, b) => b.score - a.score);

    scoresList.forEach((gracz, index) => {
        const rank = index + 1;
        let rankClass = '';
        
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="rank-col ${rankClass}">${rank}</td>
            <td>
                <div class="player-cell">
                    <span class="player-avatar">${gracz.avatar}</span>
                    <span class="player-name">${gracz.name}</span>
                </div>
            </td>
            <td class="score-cell">${gracz.score} pkt</td>
        `;
        leaderboardBody.appendChild(row);
    });
}

// Obsługa zakładek w Leaderboard
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedGameTab = btn.dataset.game;
        wczytajLeaderboard();
    });
});

// 5. Retro Zegar Systemowy
function odswiezZegar() {
    const teraz = new Date();
    const godzina = String(teraz.getHours()).padStart(2, '0');
    const minuta = String(teraz.getMinutes()).padStart(2, '0');
    const sekunda = String(teraz.getSeconds()).padStart(2, '0');
    systemTimeVal.innerText = `${godzina}:${minuta}:${sekunda}`;
}

// Inicjalizacja
wczytajProfil();
sprawdzSerwer();
odswiezZegar();

// Interwały
setInterval(odswiezZegar, 1000);
setInterval(sprawdzSerwer, 10000); // sprawdzaj status serwera co 10 sekund
