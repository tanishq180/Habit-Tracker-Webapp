# Orbit • Habit & Task Mastery Webapp

<p align="center">
  <img src="static/icons/icon.svg" width="96" height="96" alt="Orbit Logo" />
</p>

An ultra-modern, responsive Habit & Task Tracker web application built with **Python (Flask)**, **Semantic HTML5**, **Modern Vanilla CSS**, and **JavaScript**. Designed for seamless compatibility across every device (smartphones, tablets, and desktop), featuring dark/light mode, PWA capabilities, habit streak calculations, and a glassmorphic aesthetic.

---

## ✨ Features

- **Cross-Device Responsive Design**: Optimized for desktops, tablets, and mobile screens with iOS safe-area support.
- **Progressive Web App (PWA)**: Installable directly to your home screen or desktop with offline caching via Service Worker.
- **Live Momentum & Stats**: Real-time circular progress gauge showing daily completion rate, active tasks, and streak records (🔥).
- **Intelligent Quick Scheduling**:
  - One-click presets (*Today 6 PM*, *Tonight 10 PM*, *Tomorrow 9 AM*, *In 2 Days*, *Next Monday*).
  - Custom datetime selector with overdue countdown badges.
- **Categorization & Filtering**:
  - Filter by folder pills with dynamic task counters.
  - Quick status tabs (*All*, *Active*, *Done*).
  - Instant live search.
- **Priorities & Streaks**: Low, Medium, and Urgent priority tags with auto-incrementing streaks.
- **Task Celebrations**: Confetti particle bursts upon completing tasks.
- **Themes**: Smooth toggle between sleek dark and clean light modes with local persistence.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask, SQLite3
- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System & Glassmorphism), Modern JavaScript (ES6+)
- **PWA**: Web App Manifest (`manifest.json`), Service Worker (`sw.js`)
- **Typography**: Google Fonts (*Outfit* and *Plus Jakarta Sans*)

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
