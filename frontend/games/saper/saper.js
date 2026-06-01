// Zauważ, że cofamy się o dwa foldery (../../) by pobrać config
import { API_URL } from '../../config.js';

const winBtn = document.getElementById('win-btn');
const msgLabel = document.getElementById('msg');

winBtn.addEventListener('click', async () => {
    msgLabel.innerText = "Wysyłanie wyniku do serwera...";
    winBtn.disabled = true;

    try {
        const odpowiedz = await fetch(`${API_URL}/api/zapisz-wynik`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gra: 'Saper',
                punkty: 100,
                gracz: 'Anonim'
            })
        });

        const dane = await odpowiedz.json();
        msgLabel.innerText = "✅ " + dane.message;
        msgLabel.style.color = "lightgreen";
    } catch (err) {
        msgLabel.innerText = "❌ Błąd wysyłania: Uruchom serwer backendowy!";
        msgLabel.style.color = "red";
    } finally {
        winBtn.disabled = false;
    }
});