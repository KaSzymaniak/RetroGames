// Zauważ, że cofamy się o dwa foldery (../../) i wchodzimy do frontend/ by pobrać config
import { API_URL } from '../../frontend/config.js';
import { wyslijWynikNaSerwer } from '../../frontend/scores-api.js';

const winBtn = document.getElementById('win-btn');
const msgLabel = document.getElementById('msg');

winBtn.addEventListener('click', async () => {
    msgLabel.innerText = "Wysyłanie wyniku do serwera...";
    winBtn.disabled = true;

    const graczNick = localStorage.getItem('arcade_nickname') || 'Anonim';
    const graczAvatar = localStorage.getItem('arcade_avatar') || '👾';
    const punktyZdobyte = 100;

    try {
        const dane = await wyslijWynikNaSerwer('Saper', punktyZdobyte);
        
        // Zapisujemy punkty lokalnie, aby lobby mogło odczytać nasz wynik
        const aktualnyNajlepszy = localStorage.getItem('arcade_score_saper') || 0;
        if (punktyZdobyte > parseInt(aktualnyNajlepszy, 10)) {
            localStorage.setItem('arcade_score_saper', punktyZdobyte);
        }
        msgLabel.innerText = "✅ " + dane.message;
        msgLabel.style.color = "lightgreen";
    } catch (err) {
        msgLabel.innerText = "❌ Błąd wysyłania: Uruchom serwer backendowy!";
        msgLabel.style.color = "red";
    } finally {
        winBtn.disabled = false;
    }
});