const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SCORES_FILE = path.join(__dirname, 'scores.json');

const GRA_DO_KLUCZA = {
    saper: 'saper',
    Saper: 'saper',
    catchstar: 'catchstar',
    'Łap Gwiazdkę': 'catchstar',
    Catchstar: 'catchstar',
    arkanoid: 'arkanoid',
    Arkanoid: 'arkanoid',
    warcaby: 'warcaby',
    Warcaby: 'warcaby',
    sandtetris: 'sandtetris',
    'Sand Tetris': 'sandtetris',
    'Tetris z Piasku': 'sandtetris',
    flappy: 'flappy',
    'Flappy Bird': 'flappy'
};

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.redirect('/frontend/');
});

function wczytajWyniki() {
    try {
        if (fs.existsSync(SCORES_FILE)) {
            return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('[WYNIKI] Błąd odczytu pliku:', err.message);
    }
    return {};
}

function zapiszWynikiDoPliku(dane) {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(dane, null, 2), 'utf8');
}

function normalizujGre(gra) {
    if (!gra) return null;
    const klucz = GRA_DO_KLUCZA[gra] || gra.toString().toLowerCase().replace(/\s+/g, '');
    return GRA_DO_KLUCZA[klucz] || klucz;
}

function parsujGracza(body) {
    if (body.gracz) {
        const spacja = body.gracz.indexOf(' ');
        if (spacja > 0) {
            return {
                avatar: body.gracz.slice(0, spacja),
                nick: body.gracz.slice(spacja + 1).trim()
            };
        }
        return { avatar: '👾', nick: body.gracz.trim() };
    }
    return {
        avatar: body.avatar || '👾',
        nick: (body.nick || body.nickname || 'Anonim').trim()
    };
}

function zapiszWynikGry(kluczGry, nick, avatar, punkty) {
    const wszystkie = wczytajWyniki();
    if (!wszystkie[kluczGry]) {
        wszystkie[kluczGry] = {};
    }

    const poprzedni = wszystkie[kluczGry][nick];
    if (!poprzedni || punkty > poprzedni.score) {
        wszystkie[kluczGry][nick] = {
            avatar,
            score: punkty,
            updatedAt: new Date().toISOString()
        };
        zapiszWynikiDoPliku(wszystkie);
        return { zapisano: true, poprzedniRekord: poprzedni?.score ?? null };
    }

    return { zapisano: false, poprzedniRekord: poprzedni.score };
}

function pobierzRanking(kluczGry, limit = 20) {
    const wszystkie = wczytajWyniki();
    const gra = wszystkie[kluczGry] || {};

    return Object.entries(gra)
        .map(([name, dane]) => ({
            name,
            avatar: dane.avatar || '👾',
            score: dane.score
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', message: 'Serwer z grami jest gotowy!' });
});

app.get('/api/leaderboard/:gra', (req, res) => {
    const kluczGry = normalizujGre(req.params.gra);
    if (!kluczGry) {
        return res.status(400).json({ success: false, message: 'Nieznana gra.' });
    }

    res.json({
        success: true,
        gra: kluczGry,
        wyniki: pobierzRanking(kluczGry)
    });
});

app.post('/api/zapisz-wynik', (req, res) => {
    const kluczGry = normalizujGre(req.body.gra);
    const punkty = parseInt(req.body.punkty, 10);
    const { nick, avatar } = parsujGracza(req.body);

    if (!kluczGry || Number.isNaN(punkty) || punkty < 0) {
        return res.status(400).json({
            success: false,
            message: 'Nieprawidłowe dane wyniku (gra lub punkty).'
        });
    }

    if (!nick) {
        return res.status(400).json({
            success: false,
            message: 'Pseudonim gracza jest wymagany.'
        });
    }

    const wynik = zapiszWynikGry(kluczGry, nick, avatar, punkty);

    console.log(
        `[WYNIK] ${avatar} ${nick} | ${kluczGry}: ${punkty} pkt` +
        (wynik.zapisano ? ' (zapisano)' : ' (pominięto — gorszy od rekordu)')
    );

    res.json({
        success: true,
        zapisano: wynik.zapisano,
        message: wynik.zapisano
            ? 'Wynik został zapisany pomyślnie!'
            : `Twój rekord (${wynik.poprzedniRekord} pkt) pozostaje najlepszy.`,
        gra: kluczGry,
        punkty
    });
});

app.listen(PORT, () => {
    console.log(`Backend działa. Nasłuchuję na porcie: ${PORT}`);
});
