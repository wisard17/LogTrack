

# Run and deploy app

This contains everything you need to run your app locally.

## Run Frontend (Vite)

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
3. Run the app:
   `npm run dev`

## Run Backend API (FastAPI)

**Prerequisites:** Python 3.10+

1. (Recommended) Create virtual environment:
   - Windows (PowerShell):
     `python -m venv .venv`
     `.\.venv\Scripts\Activate`
2. Install API dependencies:
   `pip install -r api/requirements.txt`
3. Set PostgreSQL environment variables (password diisi manual):
   - `POSTGRES_HOST=localhost`
   - `POSTGRES_PORT=5432`
   - `POSTGRES_DB=logbook_db`
   - `POSTGRES_USER=postgres`
   - `POSTGRES_PASSWORD=your_password_here`
4. Run FastAPI server:
   `uvicorn api.main:app --reload --host 0.0.0.0 --port 8000`
5. Open API docs:
   - Swagger UI: `http://localhost:8000/docs`
   - PostgreSQL connection endpoint: `http://localhost:8000/db/connect`
