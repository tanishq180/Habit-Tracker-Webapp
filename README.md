# Orbit • Habit & Task Mastery Webapp

<p align="center">
  <img src="static/icons/icon.svg" width="96" height="96" alt="Orbit Logo" />
</p>

An ultra-modern, responsive Habit & Task Tracker web application built with **Python (Flask)**, **Semantic HTML5**, and **Retro Pixel Vanilla CSS3** with **Instant Live Non-Reload Sync** (and progressive zero-JS fallback). Designed for seamless speed, instant reliability, and maximum accessibility across every device (smartphones, tablets, and desktop), featuring dark/light mode, CSS `:target` modals, CRT scanlines effect, habit streak calculations, dedicated monthly habit calendar views, and a retro arcade aesthetic.

---

## ✨ Features

- **🛡️ Player Accounts & Authentication**: Secure multi-user login, registration, password hashing (`Werkzeug`), session management, and strict data isolation.
- **🎮 1-Click Demo Guest Mode**: Instant access with `player1` / `orbit123` for frictionless testing.
- **📦 Auto-Seeded Starter Habits**: Every new player receives custom starter habit categories and sample quests immediately upon registration.
- **⚡ Instant Non-Reload UI Sync**: Optimistic instant quest toggle with retro 8-bit sound synthesizer and live radial gauge transitions.
- **📅 Interactive Habit Calendar**: Click any habit category to open a monthly calendar view highlighting completed days in vibrant green, with per-habit daily streak heatmaps.
- **✨ Crystal-Clear Modern Typography**: Crisp, readable UI powered by *Plus Jakarta Sans*, *Inter*, and *JetBrains Mono*, with retro *Silkscreen* brand accents.
- **Cross-Device Responsive Design**: Optimized for desktops, tablets, and mobile screens.
- **Pure CSS Interactive Modals & Toggles**: Modal editing and category creation using CSS `:target`.
- **Live Momentum & Stats**: Dynamic SVG circular progress gauge showing completion rate, active quests, and streak records (🔥).
- **Categorization & Filtering**:
  - Filter by habit pills with dynamic quest counters.
  - Quick status tabs (*All*, *Active*, *Done*).
  - Search filter.
- **Priorities & Streaks**: Casual, Normal, and Boss priority tags with auto-incrementing streaks.
- **Themes**: Smooth toggle between sleek arcade dark and clean Famicom light modes with cookie persistence.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask, SQLite3, Werkzeug Security, Jinja2
- **Frontend**: Pure Semantic HTML5, Vanilla CSS3 (Retro Arcade HUD Design System)
- **Client Scripting**: **None (Zero JS)**
- **Typography**: Google Fonts (*Plus Jakarta Sans*, *Inter*, *JetBrains Mono*, *Silkscreen*)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/tanishq180/Habit-Tracker-Webapp.git
cd Habit-Tracker-Webapp
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python app.py
```

### 4. Open in Browser
Visit **[http://localhost:5000](http://localhost:5000)** in your browser.

- **Demo Login**: Use **Player 1** (`player1` / `orbit123`) or click **1-Click Demo Guest**.
- **New Players**: Click **★ NEW PLAYER** to create your own private habit tracking account.

To access from mobile devices on the same Wi-Fi network, navigate to `http://<YOUR_LOCAL_IP>:5000`.

---

## 📱 Installing on Mobile (PWA)

- **Android (Chrome)**: Tap the **Install** button in the header or select **Install app** from the browser menu.
- **iOS (Safari)**: Tap the **Share** button (⎋) and select **Add to Home Screen**.
