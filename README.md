# RetroGames — Retro Arcade Hub

**Projekt zespołowy**.  
Aplikacja webowa w stylu retro salonu gier — jedno lobby, kilka klasycznych tytułów i wspólna tabela wyników.

**Demo:** [https://kaszymaniak.github.io/RetroGames/frontend](https://kaszymaniak.github.io/RetroGames/frontend)

---

## Opis projektu

RetroGames to przeglądarkowa platforma arcade inspirowana starymi automatami. Użytkownik wchodzi do wirtualnego lobby, ustawia profil (pseudonim + awatar), wybiera grę z katalogu i rywalizuje o miejsce w rankingu.

Projekt składa się z dwóch części:
- **Frontend** — statyczna aplikacja (HTML, CSS, JavaScript), hostowana na GitHub Pages
- **Backend** — serwer Node.js (Express), hostowany na Render, odpowiedzialny za zapis i odczyt wyników

Wyniki są współdzielone między użytkownikami — po zapisaniu punktów w grze pojawiają się na tablicy w lobby (odświeżana co 15 sekund).

---

## Funkcjonalności

### Lobby (frontend)
- Profil gracza z pseudonimem i wyborem awatara (zapis w `localStorage`)
- Katalog 6 gier z wyszukiwarką po tytule i gatunku
- Tabela wyników z zakładkami dla każdej gry
- Panel statusu serwera (online / offline)
- Estetyka retro / neon (Font Awesome, własny CSS)

### Backend API
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/status` | Sprawdzenie, czy serwer działa |
| `GET` | `/api/leaderboard/:gra` | Ranking najlepszych wyników dla danej gry |
| `POST` | `/api/zapisz-wynik` | Zapis wyniku gracza (tylko jeśli lepszy od poprzedniego rekordu) |

Wyniki trzymane są w pliku `backend/scores.json` (jeden najlepszy wynik na gracza i grę).

---

## Dostępne gry

| Gra | Gatunek | Technologia | Opis |
|-----|---------|-------------|------|
| **Saper** | logiczna | HTML + JS | Klasyczne Minesweeper z poziomami trudności |
| **Łap Gwiazdkę** | zręcznościowa | HTML + JS | Klikaj gwiazdki w 30 sekund — im więcej, tym lepiej |
| **Arkanoid** | arcade | Canvas | Odbijanie piłki, niszczenie klocków, ulepszenia |
| **Warcaby** | strategiczna | HTML + JS | Gra przeciwko komputerowi, bicie obowiązkowe |
| **Tetris z Piasku** | puzzle | Canvas | Klocki rozsypują się w piasek; łączenie kolorów czyści planszę |
| **Flappy Bird** | arcade | Canvas | Ptak lecący przez rurki, kilka poziomów trudności |

---