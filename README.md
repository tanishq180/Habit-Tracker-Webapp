# Orbit • Habit & Task Mastery Webapp

<p align="center">
  <img src="static/icons/icon.svg" width="96" height="96" alt="Orbit Logo" />
</p>

An ultra-modern, responsive Habit & Task Tracker web application built with **Python (Flask)**, **Semantic HTML5**, and **Retro Pixel Vanilla CSS3** with **Zero Client-Side JavaScript**. Designed for seamless speed, instant reliability, and maximum accessibility across every device (smartphones, tablets, and desktop), featuring dark/light mode, CSS `:target` modals, CRT scanlines effect, habit streak calculations, and a retro arcade aesthetic.

---

## ✨ Features

- **⚡ Zero JavaScript Architecture**: 100% pure HTML5 + CSS3 on the client side with lightning-fast SSR (Server-Side Rendering).
- **Cross-Device Responsive Design**: Optimized for desktops, tablets, and mobile screens.
- **Pure CSS Interactive Modals & Toggles**: Modal editing and category creation using CSS `:target` and CRT toggle via CSS checkbox state.
- **Live Momentum & Stats**: Dynamic SVG circular progress gauge showing completion rate, active quests, and streak records (🔥).
- **Categorization & Filtering**:
  - Filter by folder pills with dynamic quest counters.
  - Quick status tabs (*All*, *Active*, *Done*).
  - Search filter.
- **Priorities & Streaks**: Casual, Normal, and Boss priority tags with auto-incrementing streaks.
- **Themes**: Smooth toggle between sleek arcade dark and clean Famicom light modes with cookie persistence.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask, SQLite3, Jinja2
- **Frontend**: Pure Semantic HTML5, Vanilla CSS3 (Custom Retro Arcade Design System & CRT Scanlines)
- **Client Scripting**: **None (Zero JS)**
- **Typography**: Google Fonts (*Silkscreen*, *Press Start 2P*, *VT323*)

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

To access from mobile devices on the same Wi-Fi network, navigate to `http://<YOUR_LOCAL_IP>:5000`.

---

## 📱 Installing on Mobile (PWA)

- **Android (Chrome)**: Tap the **Install** button in the header or select **Install app** from the browser menu.
- **iOS (Safari)**: Tap the **Share** button (⎋) and select **Add to Home Screen**.
