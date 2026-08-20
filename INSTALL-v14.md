# Installation (Foundry VTT v14)

Drei getrennte Pakete. Das System ist Pflicht, die zwei Module sind optional und
unabhängig voneinander.

## 1. System

*Game Systems → Install System → Manifest URL*

```
https://raw.githubusercontent.com/stillday/Foundry-VTT-StarWars-SagaEdition/v14/system.json
```

Getrennt vom Original, damit ein Update von dort deine Anpassungen nicht überschreibt.
Updates kommen künftig über dieselbe URL.

Voraussetzung: Foundry **14** oder neuer. Auf v13 läuft diese Fassung nicht — dort
bleibt der Upstream-Stand 13.2.4 die richtige Wahl.

## 2. Mobile- und Tablet-Unterstützung (optional)

*Add-on Modules → Install Module*

```
https://raw.githubusercontent.com/stillday/swse-mobile/main/module.json
```

Macht die Charakterblätter mit dem Finger bedienbar: einspaltiges Layout, Berührungsziele
ab 44 Pixel, wischbare Tab-Leiste, und eine kompakte Spielansicht mit Trefferpunkten,
Verteidigung, Condition Track und Angriffen.

Am Desktop ändert sich nichts — jede Regel hängt an `(pointer: coarse)` oder einer
Bildschirmbreite.

**Was am Handy nicht geht:** Drag & Drop. Ausrüsten, Umsortieren und Ablegen aus dem
Kompendium bleiben Desktop-Arbeit. Ebenso Schwenken und Zoomen der Karte.

## 3. Deutsche Übersetzung (optional)

**Erst diese zwei installieren**, sonst startet das Modul nicht:

- `lib-wrapper` — über die Paketsuche in Foundry
- `babele` — über die Paketsuche, Version 2.9.0 oder neuer

Dann:

```
https://raw.githubusercontent.com/stillday/swse-de/main/module.json
```

Die Sprache stellst du unter *Configure Settings → Core Settings → Language* auf Deutsch.
**Foundry speichert das pro Client, nicht pro Welt** — jeder Spieler entscheidet für sich.

Abdeckung: 21 von 47 Compendium-Packs. Alle 80 Backgrounds vollständig; sonst sind die
Strukturzeilen deutsch (Quellenbuch, Siehe auch, Kategorie, Relevante Fertigkeiten), die
Regeltexte englisch. Das sind rund 1 % von 3,57 Millionen Zeichen — Fundament, keine
fertige Übersetzung.

**Item-Namen bleiben absichtlich englisch.** Das System vergleicht Voraussetzungen über
exakte Zeichenkettengleichheit; ein übersetzter Talentname bricht stillschweigend jede
Voraussetzung, die ihn nennt.

## Reihenfolge

1. System installieren
2. Neue Welt anlegen, System „Star Wars: Saga Edition" wählen
3. Welt starten, Module unter *Manage Modules* aktivieren
4. Bei aktiver Übersetzung: Sprache auf Deutsch stellen und neu laden

## Compendium-Migration

Beim ersten Start einer Welt migriert Foundry die 47 Packs auf das v14-Format. Das dauert
ein bis zwei Minuten und passiert genau einmal. Im Serverlog steht dazu
`Migrating Package Data`.

**Eine in v14 geöffnete Welt lässt sich nicht mehr in v13 verwenden.** Wenn du eine
bestehende Kampagne migrieren willst, mach vorher ein Backup.

## Wenn etwas nicht funktioniert

Die Browser-Konsole (F12) ist die wertvollste Fehlerquelle. Beim Test dieser Fassung
haben vier Fehler, die zwei automatisierte Testsuiten übersehen hatten, sich dort in
Minuten gezeigt — weil ein Mensch klickt, wo ein Testskript die Programmschnittstelle
aufruft.
