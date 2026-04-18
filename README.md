# ATLAS — Autopolit for UMBC COEIT

ATLAS is a real-time AI registration assistant that helps UMBC Computer Science and Information Systems students secure high-demand courses before they fill up. It combines two agents:

- **Cartographer** — parses your degree audit PDF with Gemini multimodal, maps your prerequisite graph, and flags bottlenecks (Spring-only courses, low-seat sections)
- **Pilot** — automates the UMBC Student Affairs registration flow via Playwright, narrates each step live, and stops before the final submit so you stay in control

## The Problem

Class standing determines registration priority. Juniors often lose required courses (like CMSC 441, Spring-only) to seniors. Missing one Spring-only requirement means an extra semester — roughly $13K in tuition and 6 months of lost salary.

## Features

- Upload your UMBC degree audit PDF → visual prerequisite map with bottleneck highlighting
- Real-time seat countdown for CMSC 441 with urgency indicator
- Pilot auto-launches when seats drop to 2 — opens a browser, races through registration, stops at Submit
- Live SSE stream shows every Pilot action as it happens
- Add a Finance or Entrepreneurship minor → map rebuilds instantly
- Course drawer with RateMyProfessor data, grade distributions, open sections

## Tech Stack

**Backend**
- FastAPI + Uvicorn
- Google Gemini 2.5 Flash (multimodal PDF parsing + structured outputs + vision narration)
- Playwright + Chromium (browser automation)
- Server-Sent Events for live Pilot streaming
- JSON file storage

**Frontend**
- React + Vite
- Tailwind CSS
- Lucide React icons

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

export GEMINI_API_KEY=your_key_here
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:8000`, frontend on `http://localhost:5173`.

## Usage

1. Open the app and upload your UMBC degree audit PDF (and optionally your transcript)
2. Your prerequisite map renders with bottlenecks highlighted in red
3. Watch the seat counter — when CMSC 441 drops to 2 seats, Pilot auto-launches
4. A browser window opens and races through registration automatically
5. Review the action log in the panel, then click **Confirm & Submit Registration**
6. CMSC 441 turns gold on your map

## Team

Built at MLH Hackathon in 12 hours.

- Arya Bhatt — backend, agents, API
- Dhruv Shah - Full stack
