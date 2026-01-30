# Changing the Game - Neighbourhood (Online Version)

Ein kooperatives Brettspiel über die Energiewende in einer Nachbarschaft - jetzt als Online-Version spielbar!

## 🎮 Spielstart

### Lokal spielen:
1. Öffne die Datei `index.html` in deinem Browser
2. Oder starte einen lokalen Webserver:
   ```bash
   python3 -m http.server 8080
   ```
3. Öffne dann http://localhost:8080 in deinem Browser

## 📋 Spielübersicht

### Ziel
Plane eine klimafreundliche Nachbarschaft und erreiche die Energiewende-Ziele über 3 Runden (Jahre 2030, 2035, 2040).

### Spielablauf
1. **Start**: 6 Startkarten werden automatisch ausgespielt
2. **Runden**: 3 Runden mit je 15 Minuten Zeit
3. **Karten spielen**: Klicke auf Karten in deiner Hand, um Details zu sehen und sie auszuspielen
4. **Ziele prüfen**: Versuche, alle drei Ziele jeder Runde zu erreichen:
   - Mobilitätsturm: Maximale Anzahl Steine
   - Alle Energietürme: Maximale Gesamtzahl Steine
   - CO₂-Emissionen: Maximal erlaubte Tonnen

## 🏗️ Implementierte Features

### ✅ Kernfunktionen
- **Originales Spielbrett**: Verwendung der originalen Spielbrett-Grafik als Hintergrund
- **Interaktive Spielfelder**: Positionierte Kartenslots über den entsprechenden Bereichen
- **Energietürme**: Visualisierung von Mobilität, Wärme, Strom und Kosten
- **Spielkarten**: Startkarten + zusätzliche Technologie-Karten
- **Visuelle Kartenanzeige**: Gespielte Karten werden auf dem Spielbrett angezeigt
- **Rundenmanagement**: 3 Runden mit steigenden Anforderungen
- **Zielkarten**: Automatische Überprüfung der Erreichung
- **CO₂-Berechnung**: Echtzeit-Berechnung der Emissionen
- **Timer**: 15-Minuten-Countdown pro Runde

### 🎯 Spielmechaniken
- **Energiesteine**: Verschiedene Farben für unterschiedliche Energieträger
  - Rot: Diesel/Benzin (5t CO₂)
  - Beige: Erdgas (4t CO₂)
  - Schwarz: Zugekaufter Strom (8t CO₂)
  - Gelb: Solar (0t CO₂)
  - Weiß: Wind (0t CO₂)
  - Blau: Wasserstoff (0t CO₂)

- **Faulis (Komfortmünzen)**: Manche Karten kosten oder geben Faulis
- **Überschuss**: Selbst erzeugte Energie kann für andere Karten genutzt werden
- **Abhängigkeiten**: Manche Karten benötigen andere Karten als Voraussetzung

## 🎲 Verfügbare Karten

### Startkarten (automatisch):
1. Stromnetz
2. Gasheizung
3. Auto (Benzin/Diesel)
4. Fahrrad
5. Konventioneller Stromzähler
6. Solarthermie

### Runde 1:
- Photovoltaik
- Elektroautos
- Smart Meter
- E-Fahrrad
- ÖPNV-Nutzung

### Runde 2:
- Wärmepumpe
- (weitere Karten können hinzugefügt werden)

## 🔧 Technische Details

### Dateistruktur
```
ctg/
├── index.html          # Hauptseite
├── styles.css          # Styling
├── game.js            # Spiellogik
└── README.md          # Diese Datei
```

### Technologien
- Vanilla JavaScript (ES6+)
- CSS3 mit Grid und Flexbox
- HTML5

### Browser-Kompatibilität
- Chrome/Edge (empfohlen)
- Firefox
- Safari

## 🎓 Lernziele

Das Spiel vermittelt:
1. **Energiesektoren**: Mobilität, Wärme und Strom
2. **Energieformen**: Unterschiedliche CO₂-Emissionen
3. **Sektorenkopplung**: Elektrifizierung von Mobilität und Wärme
4. **Erneuerbare Energien**: Solar, Wind, Wasserstoff
5. **Systemdenken**: Komplexe Probleme brauchen vielfältige Lösungen
6. **Kosten-Nutzen**: Abwägung verschiedener Maßnahmen

## 📊 Zielwerte

### Runde 1 (2030)
- Mobilitätsturm: ≤ 50 Steine
- Alle Türme: ≤ 90 Steine
- CO₂: ≤ 300 Tonnen

### Runde 2 (2035)
- Mobilitätsturm: ≤ 40 Steine
- Alle Türme: ≤ 75 Steine
- CO₂: ≤ 200 Tonnen

### Runde 3 (2040)
- Mobilitätsturm: ≤ 30 Steine
- Alle Türme: ≤ 60 Steine
- CO₂: ≤ 100 Tonnen

## 🚀 Zukünftige Erweiterungen

### Geplant:
- [ ] Alle 55+ Spielkarten aus dem Original
- [ ] Mehrspieler-Funktionalität (3-6 Spieler)
- [ ] Abstimmungssystem für demokratische Entscheidungen
- [ ] Szenario-Karten für Runden 2 und 3
- [ ] Katastrophen-Karten für zusätzliche Herausforderung
- [ ] Detaillierte Visualisierung des Spielbretts
- [ ] Sound-Effekte und Animationen
- [ ] Mobile-optimierte Version

## 📜 Lizenz & Credits

Basierend auf dem Brettspiel "Changing the Game - Neighbourhood" aus dem Forschungsprojekt "Energetisches Nachbarschaftsquartier Fliegerhorst Oldenburg" (ENaQ).

**Autor*innen des Original-Spiels:**
- Steffen Wehkamp, Mathias Lanezki, Sven Rosinger, Julia Ingensiep, Markus Reinke, Christian Pieper

**Förderkennzeichen:** 03SBE111

Weitere Informationen: https://www.enaq-fliegerhorst.de/changingthegame

## 🤝 Mitwirken

Verbesserungsvorschläge und Beiträge sind willkommen!

## ⚠️ Hinweis

Dies ist eine vereinfachte Online-Version des Brettspiels. Für das vollständige Spielerlebnis mit allen Karten und Materialien siehe die Original-PDFs im Verzeichnis "2. Edition CtG-N Materialien".
