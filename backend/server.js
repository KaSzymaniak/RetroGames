const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Endpoint statusu
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', message: 'Serwer z grami jest gotowy!' });
});

// 2. Endpoint do zapisywania wyników z gier
app.post('/api/zapisz-wynik', (req, res) => {
    const { gra, punkty, gracz } = req.body;
    
    // Tu Osoba od Bazy Danych doda kod zapisu, na razie wypisujemy w konsoli
    console.log(`[NOWY WYNIK] Gracz ${gracz} w grze ${gra} zdobył ${punkty} pkt!`);
    
    res.json({ success: true, message: 'Wynik został zapisany pomyślnie!' });
});

app.listen(PORT, () => {
    console.log(`Backend działa. Nasłuchuję na porcie: ${PORT}`);
});