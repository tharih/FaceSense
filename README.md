# FaceSense Frontend (React + Tailwind + Vite)

A production-ready SPA for FaceSense: login, webcam attendance with emotion streaming, CSV export, reports, and admin user management.

## Quick Start

```bash
npm i
npm run dev
```

> If you just unzipped this, run `npm i` first to install dependencies.

### Configure backend URL

Create `.env` in project root:

```
VITE_API_BASE=http://127.0.0.1:8000
```

Ensure your backend supports the following endpoints and CORS for http://localhost:5173:

- `POST /api/auth/login` → `{ token, user:{id,name,role} }`
- `GET /api/me`
- `GET /api/users` ; `POST /api/users` ; `DELETE /api/users/:id`
- `POST /api/attendance/start` → `{ sessionId }`
- `POST /api/attendance/frame` → `{ status:'ok' }` (body: `{ sessionId, imageBase64 }`)
- `POST /api/attendance/complete` → `{ userName, emotion, timestamp }`
- `GET /api/attendance/export?range=30d` → CSV file
- `GET /api/stats?range=7d|30d|90d` → `{ daily, emotions, timeline }`

### Tech
- React 18, React Router 6
- Tailwind CSS 3
- Vite 5
- Recharts, lucide-react

### Build
```bash
npm run build
npm run preview
```

