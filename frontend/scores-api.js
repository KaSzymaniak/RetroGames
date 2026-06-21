import { API_URL } from './config.js';

export async function wyslijWynikNaSerwer(gra, punkty) {
    const nick = localStorage.getItem('arcade_nickname') || 'Anonim';
    const avatar = localStorage.getItem('arcade_avatar') || '👾';

    const resp = await fetch(`${API_URL}/api/zapisz-wynik`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gra,
            punkty,
            nick,
            avatar,
            gracz: `${avatar} ${nick}`
        })
    });

    if (!resp.ok) {
        throw new Error('Nie udało się zapisać wyniku.');
    }

    return resp.json();
}
