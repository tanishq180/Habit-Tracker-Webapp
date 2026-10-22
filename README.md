# Orbit • Habit & Task Mastery Webapp

<p align="center">
  <img src="frontend/icons/icon.svg" width="96" height="96" alt="Orbit Logo" />
</p>

An ultra-modern, responsive Habit & Task Tracker web application structured cleanly into **Frontend** and **Backend**.

---

## 📁 Project Structure

```text
Habit-Tracker-Webapp/
├── frontend/
│   ├── index.html            # Main HUD Dashboard (Quests, Filters, Modals)
│   ├── auth.html             # Player Login & Registration Gateway
│   ├── pack_calendar.html    # Monthly Habit Calendar & Heatmap View
│   ├── css/
│   │   └── style.css         # Retro Pixel-Art & Glassmorphism Design System
│   ├── js/
│   │   ├── app.js            # Frontend Client Audio & Interaction Scripts
│   │   └── instant_actions.js# Optimistic UI Sync with 8-bit Sound Effects
│   ├── icons/
│   │   └── icon.svg          # Vector Logo Mark
│   └── manifest.json         # PWA Manifest
│
└── backend/
    ├── server.js             # Node.js / Express Web Server (JavaScript)
    ├── package.json          # Dependencies (express, nunjucks, bcryptjs, session)
    └── habits.db             # SQLite Database (Multi-user, tasks, completions)
```

---

## ✨ Features

- **🛡️ Player Accounts & Authentication**: Multi-user login, registration, password hashing (`bcrypt`), and session isolation.
- **🎮 1-Click Demo Guest Mode**: Instant access with `player1` / `orbit123` for frictionless testing.
- **📦 Auto-Seeded Starter Habits**: Starter habit packs and sample quests auto-provisioned upon registration.
- **⚡ Instant Non-Reload UI Sync**: Optimistic instant quest toggle with retro 8-bit sound synthesizer and live radial gauge transitions.
- **📅 Interactive Habit Calendar**: Monthly calendar view highlighting completed days in green, with per-habit daily streak heatmaps.
- **✨ Crystal-Clear Modern Typography**: Crisp UI powered by *Plus Jakarta Sans*, *Inter*, *JetBrains Mono*, and *Silkscreen*.
- **Pure CSS Interactive Modals**: Modal editing and category creation using CSS `:target`.
- **Live Momentum & Stats**: Dynamic SVG circular progress gauge showing completion rate, active quests, and streaks (🔥).
- **Themes**: Smooth toggle between arcade dark and Famicom light modes.

---

## 🚀 Getting Started

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Run the Application
```bash
npm start
```
*(or run `node server.js` from within `backend`)*

### 3. Open in Browser
Visit **[http://localhost:5000](http://localhost:5000)** in your browser.

- **Demo Login**: Click **1-Click Demo Guest** or use:
  - **Username:** `player1`
  - **Password:** `orbit123`
- **New Players**: Click **★ NEW PLAYER** to create your own private habit tracking account.
