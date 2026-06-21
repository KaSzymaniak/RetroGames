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

function pokazKomunikatLeaderboarda(tekst) {
    leaderboardBody.innerHTML = `
        <tr>
            <td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">
                ${tekst}
            </td>
        </tr>
    `;
}

function wstawWierszRankingu(gracz, index) {
    const rank = index + 1;
    let rankClass = '';

    if (rank === 1) rankClass = 'rank-1';
    else if (rank === 2) rankClass = 'rank-2';
    else if (rank === 3) rankClass = 'rank-3';

    const toTy = gracz.name.replace(' (Ty)', '') === currentNickname;
    const wyswietlanaNazwa = toTy ? `${gracz.name.replace(' (Ty)', '')} (Ty)` : gracz.name;

    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="rank-col ${rankClass}">${rank}</td>
        <td>
            <div class="player-cell">
                <span class="player-avatar">${gracz.avatar}</span>
                <span class="player-name">${wyswietlanaNazwa}</span>
            </div>
        </td>
        <td class="score-cell">${gracz.score} pkt</td>
    `;
    leaderboardBody.appendChild(row);
}

// 4. Tablica Wyników (Leaderboard) — wspólna przez backend Render
async function wczytajLeaderboard() {
    pokazKomunikatLeaderboarda('Ładowanie rankingu...');

    let scoresList = [];

    try {
        const odpowiedz = await fetch(`${API_URL}/api/leaderboard/${selectedGameTab}`);
        if (odpowiedz.ok) {
            const dane = await odpowiedz.json();
            scoresList = Array.isArray(dane.wyniki) ? dane.wyniki : [];
        }
    } catch {
        pokazKomunikatLeaderboarda('Serwer offline — nie można pobrać wspólnego rankingu.');
        return;
    }

    if (scoresList.length === 0) {
        pokazKomunikatLeaderboarda('Brak wyników dla tej gry. Bądź pierwszy!');
        return;
    }

    leaderboardBody.innerHTML = '';

    scoresList.forEach((gracz, index) => {
        wstawWierszRankingu(gracz, index);
    });
}

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

// 6. Dynamiczny Licznik Gier
function aktualizujLicznikGier() {
    const kartyGier = document.querySelectorAll('.game-card');
    let aktywne = 0;
    kartyGier.forEach(karta => {
        if (!karta.classList.contains('disabled-card')) {
            aktywne++;
        }
    });
    const licznik = document.getElementById('status-games-count');
    if (licznik) {
        licznik.innerText = `${aktywne} / ${kartyGier.length}`;
    }
}

wczytajProfil();
sprawdzSerwer();
odswiezZegar();
aktualizujLicznikGier();

setInterval(odswiezZegar, 1000);
setInterval(sprawdzSerwer, 10000);
setInterval(wczytajLeaderboard, 15000);
