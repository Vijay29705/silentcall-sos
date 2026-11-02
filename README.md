# SilentCall-SOS: Zero-Audio Emergency Triage Engine
### Final Year B.Tech IT Capstone Project

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](#)
[![Stack: Node.js + React + Leaflet](https://img.shields.io/badge/TechStack-Express%20%7C%20ws%20%7C%20React%20%7C%20Leaflet-rose.svg)](#)
[![Compliance: Zero--Audio Privacy](https://img.shields.io/badge/Privacy-100%25%20Zero--Audio%20GDPR%20Compliant-cyan.svg)](#)

---

## 📌 1. Project Overview & Motivation

In hostile emergencies such as **domestic violence, armed robbery, kidnappings, hostage situations, or stalking**, victims are physically prevented or actively deterred from placing traditional audible emergency calls (such as dialing 112/911). Assailants routinely inspect screens, demand phones, and react violently to any emergency UI.

**SilentCall-SOS** resolves this life-threatening barrier with a triple-layered covert trigger matrix:
1. **Duress Lock Screen (`DuressLockscreen.jsx`)**:
   - Clean unlock PIN `1234` unlocks the smartphone into the covert calculator.
   - Duress Coercion PIN `9999` (used when forced to unlock phone by an assailant): immediately dispatches a critical SOS packet, displays a 2.5s simulated "Shutting down..." animation, blacks out into a pitch-black screen, and transmits periodic background telemetry beacons every 3 seconds.
2. **Proximity Blind-Tap (`proximityTrigger.js`)**:
   - Detects 3 quick hand covers / pocket taps within 2 seconds using W3C ProximitySensor or simulated camera notch taps. Dispatches `PROXIMITY_BLIND_TAP` emergency telemetry without needing to look at or unlock the phone.
3. **Covert Disguise (Stealth Calculator PWA)**: Disguised as an authentic dark-mode iOS/Android calculator with functional basic arithmetic (`+`, `-`, `*`, `/`). Typing `112` and pressing `=` silently captures telemetry without visual alerts.
4. **Zero-Audio Telemetry Ingestion (Web Audio API)**: Instantaneously computes Root-Mean-Square (RMS) Decibels over 400ms, and **immediately terminates hardware microphone tracks without ever recording, caching, or streaming raw audio** (satisfying GDPR and Section 69 privacy safeguards).
5. **Mission-Control 112 Command Console**: Ingests real-time WebSockets packets (`ws://`), plotting the victim's live GPS coordinates on an OpenStreetMap Leaflet tactical radar with animated pulsating beacons, distress level classification, and battery health telemetry.

---

## 🏗️ 2. Architectural Diagram

```
[ Citizen Smartphone / PWA ]
          │
          ├── State 1: LOCKSCREEN
          │     ├── Enters "1234" -> Clean Unlock -> CALCULATOR
          │     └── Enters "9999" -> DURESS_PIN_COERCION
          │           ├── FAKE SHUTDOWN (2.5s Spinner) -> PITCH-BLACK SCREEN
          │           └── Periodic 3-second background tracking beacons
          │
          ├── State 2: PROXIMITY SENSOR
          │     └── 3 taps/covers in 2000ms -> PROXIMITY_BLIND_TAP
          │
          └── State 3: COVERT CALCULATOR
                └── Types "112" and hits "=" -> COVERT_CALCULATOR_112
          │
          ▼
[ Stealth Telemetry Aggregation Engine ]
          │
          ├─► HTML5 Geolocation API (Lat, Lng, Accuracy)
          ├─► Web Audio API (400ms RMS Analyser -> Decibels -> Tracks Immediately Terminated)
          ├─► Battery Status API (Charge Level %, Power Source)
          │
          ▼
[ Covert SOS Telemetry Packet ]
          │ (WebSocket ws://localhost:5000 / HTTP Fallback)
          ▼
[ Node.js + Express + 'ws' Broadcast Server ]
          │
          ├─ In-memory Incident Repository
          ├─ Threat Classification Matrix (Critical / High / Moderate)
          ├─ Trigger Origin Identification (Duress PIN, Proximity, Calculator 112)
          ├─ WebSocket Broadcast: INITIAL_STATE, TRIGGER_SOS, RESOLVE_INCIDENT
          │
          ▼
[ 112 Emergency Dispatch Console (React-Leaflet) ]
          │
          ├─ Tactical Dark Matter OpenStreetMap with Auto-Recenter (useMap)
          ├─ Pulsating Red Beacon Markers (L.divIcon) with Trigger-Specific Badges
          ├─ Ambient Decibel Progress Gauge & Distress Bar
          ├─ 1-Click Incident Resolution & Team Dispatch Sync
```

---

## 📁 3. Project Structure

```
c:\silentcall-sos/
├── package.json               # Monorepo controller script
├── start-all.js               # Concurrently launches Server & Client
├── README.md                  # Comprehensive engineering documentation
├── server/                    # Node.js + Express + ws Backend
│   ├── package.json
│   └── index.js               # REST endpoints & WebSocket state broadcaster
└── client/                    # React + Vite + Leaflet + Tailwind Frontend
    ├── index.html             # Entry HTML including Leaflet CDN & Inter typography
    ├── package.json
    ├── vite.config.js         # Vite proxy configuration (/api & /ws)
    ├── tailwind.config.js     # Custom tactical theme colors & animations
    ├── postcss.config.js
    └── src/
        ├── main.jsx           # React DOM root
        ├── index.css          # Tailwind base & tactical CSS radar beacon styles
        ├── App.jsx            # State machine & presentation tab switcher
        ├── components/
        │   ├── DuressLockscreen.jsx    # Smartphone lock screen with 1234 unlock & 9999 duress shutdown
        │   ├── CovertCalculator.jsx    # Functional iOS calculator with stealth 112 intercept
        │   └── DispatcherDashboard.jsx # Dark-slate 112 console with React-Leaflet map
        └── utils/
            ├── telemetry.js            # Native Web API collector (GPS, Web Audio, Battery)
            └── proximityTrigger.js     # Proximity sensor 3x near listener & desktop notch fallback
```

---

## 🚀 4. How to Run the Project

### Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)

### Installation
Run npm install in both server and client:
```bash
npm --prefix server install
npm --prefix client install
```

### Launching the Application
Launch both backend and frontend concurrently from the root directory:
```bash
npm run dev
```

Or run them individually in separate terminals:
```bash
# Terminal 1: Backend Server (Port 5000)
cd server
npm run dev

# Terminal 2: Frontend Client (Port 3000)
cd client
npm run dev
```

Open your browser at:
👉 **`http://localhost:3000`**

---

## 🎯 5. How to Demonstrate in Viva / Project Presentation

1. **Select "Dual Presentation (Split)" Mode**:
   - The left pane renders the **Covert Citizen Phone** running inside a simulated smartphone bezel.
   - The right pane renders the **112 Central Dispatch Command** running the tactical Leaflet map.

2. **Trigger the Covert SOS**:
   - On the citizen calculator, type `112` and press `=`.
   - **Observer Note**: The screen stays on `112` just like a regular calculator—no popups or alarms to avoid tipping off an assailant.
   - Behind the scenes, the browser captures:
     - Real-time GPS coordinates.
     - Ambient noise level (RMS dB SPL).
     - Battery percentage.
   - The right 112 Console **instantly flashes with an incoming emergency alert**, emits a soft dispatch chime, pans the map smoothly to the incident, and plots a glowing pulsating red beacon pin!

3. **Explore Emergency Triage Features**:
   - Click on the incident card in the right queue or tap the map marker to view detailed telemetry.
   - Click **"Resolve & Clear Incident"** to witness real-time WebSocket state synchronization.

---

## 🔒 6. Zero-Audio Privacy Compliance (Defense Questions)

| Evaluator / Viva Question | Engineering Implementation |
|---|---|
| **"Does the app record voice or violate privacy laws?"** | **Strictly No.** SilentCall utilizes Web Audio API solely to compute an instantaneous numeric Root-Mean-Square (RMS) amplitude. The audio stream is immediately disconnected and disposed of within 400 milliseconds. 0 bytes of audio are ever recorded, written to disk, or transmitted over the wire. |
| **"What if the victim's device is in an elevator or basement?"** | The telemetry module leverages HTML5 Geolocation with automatic fallback to cellular tower triangulation coordinates and last-known cached positions. |
| **"Why is the trigger '112 =' instead of a dedicated SOS button?"** | In hostage or domestic violence encounters, assailants actively inspect phones. A dedicated SOS app invites physical retribution. A standard calculator icon and UI provides absolute plausible deniability. |

---

## 📜 7. License & Academic Attribution
Developed as an open-source Final Year B.Tech IT Capstone Project demonstrating advanced browser sensor integration, real-time WebSockets, and geospatial emergency dispatching.
