# Egzaminator IT - Standalone

Minimalistyczna aplikacja do przeprowadzania egzaminów technicznych z wykorzystaniem OpenAI API.

## Wymagania

- Python 3.11+
- Node.js 18+
- Klucz API OpenAI

## Instalacja

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
```

### 3. Konfiguracja

Utwórz plik `.env` w katalogu `backend/`:

```
OPENAI_API_KEY=sk-twoj-klucz-api
```

## Uruchomienie

### Backend

```bash
cd backend
python main.py
```

Backend uruchomi się na `http://localhost:8000`

### Frontend

```bash
cd frontend
npm run dev
```

Frontend uruchomi się na `http://localhost:5173`

## Użytkowanie

1. Otwórz przeglądarkę na `http://localhost:5173`
2. Wybierz technologie i poziomy trudności
3. Wybierz liczbę pytań (1-5)
4. Kliknij "Przeprowadź egzamin"
5. Odpowiadaj na pytania i otrzymuj feedback z AI

## Struktura projektu

```
egzaminator-standalone/
├── backend/
│   ├── main.py              # Główny plik FastAPI
│   ├── prompts/             # Prompty dla OpenAI
│   │   ├── guardian.md
│   │   ├── check.md
│   │   ├── lesson.md
│   │   ├── welcome.md
│   │   └── summary.md
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── Home.tsx
    │   │   └── Egzaminator.tsx
    │   └── types.ts
    ├── package.json
    └── index.html
```

## Technologie

- **Backend:** FastAPI + OpenAI API
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **AI:** OpenAI GPT-4o-mini

## Licencja

MIT
