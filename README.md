# 🏕️ Rural Property Scout

A dead-simple, mobile-friendly, GitHub Pages web app that tells you one thing:  
**"If I bought this Zillow property... am I in civilization, or the boonies?"**

Paste a Zillow link or address and instantly get:
- 📍 Cleaned & geocoded location
- 🗺️ Google Maps jump links (school, hospital, etc)
- 🚘 Drive time to nearest anchor (school, store, etc)
- 🧠 Heuristic that guesses whether you're **in a city**, **near one**, or **absolutely off-grid**

## 🌟 Features

- **Drop in a Zillow link or plain address**  
  Parses the link smartly or uses raw input.

- **Google Maps geocoding + nearby search**  
  Built on Maps JavaScript SDK — no sketchy REST calls, works entirely client-side.

- **"City sense" via clustered heuristics**  
  Uses distance matrix results from multiple anchor points to guess urban proximity.

- **Mobile-first, zero-dependency frontend**  
  Clean layout, responsive styles, emoji-coded vibes.

## USE

- **try it on mine**
  https://sampanes.github.io/rural-scout/index.html

## 🔧 Setup

1. Clone this repo  
2. Add your **Google Maps API key** with these APIs enabled:
   - Maps JavaScript
   - Places
   - Distance Matrix
3. Restrict it to your GitHub Pages domain for security  
4. Paste it into `script.js`

## 🚀 Deployment

- Push to any GitHub repo
- Go to **Settings → Pages → Source** and choose `main`, `/ (root)`
- App will be live at `https://yourusername.github.io/repo-name`

### 🔐 Reminder about keys
If your API key is restricted to `https://sampanes.github.io/*`, make sure your repo lives under that domain path.

## 🧠 Future ideas

- Let users pick anchor type (school, store, hospital)
- Embedded maps with pins
- Show clusters and spread of urban density
- LocalStorage for favorite searches
- Sidebar with "city stats" from census data?

---

## ✨ Credits

Crafted with sweat and joy by [@sampanes](https://github.com/sampanes),  
with help from the internet and the crushing weight of Zillow-fueled fantasies.

