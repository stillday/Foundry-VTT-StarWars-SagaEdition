# Glossar der deutschen SWSE-Lokalisierung

Verbindliche Terminologie für `lang/de.json` und für alle Babele-Übersetzungs-
dateien der Compendium-Inhalte. Wer hier abweicht, macht die Lokalisierung
inkonsistent — im Zweifel gilt dieses Dokument, nicht das Sprachgefühl.

## Die Linie in einem Satz

**Regelbegriffe bleiben englisch, Oberflächenwörter werden deutsch.**

Begründung: Die Star-Wars-Saga-Edition existiert auf Deutsch nur in Form von
Haus- und Fanübersetzungen, die untereinander nicht einheitlich sind. Am Tisch
und in jeder Regeldiskussion fallen die englischen Begriffe — *Reflex Defense*,
*Damage Threshold*, *Second Wind* — weil sie so im Regelwerk, auf den
Charakterbögen und in den Voraussetzungsketten der Talente stehen. Eine
deutsche Erfindung dafür („Widerstandsschwelle") zwingt Spieler zum
Rückübersetzen und bricht die Suche im Regelwerk. Umgekehrt gibt es keinen
Grund, *Weight*, *Cost* oder *Notes* englisch zu lassen: Diese Wörter tragen
keine Regelbedeutung, sie sind bloß Oberfläche.

## Entscheidungsregeln

### Regel A — Regelbegriff → englisch

Ein Begriff bleibt englisch, wenn er **eine definierte Spielmechanik, eine
Kenngröße, einen Zustand oder eine Regelwerkskategorie benennt**, die
Spielende namentlich zitieren und im Index nachschlagen.

Test: *Würde am Spieltisch jemand diesen Begriff englisch aussprechen?*
Wenn ja → englisch.

### Regel B — Oberflächenwort → deutsch

Generische Substantive und Verben der Benutzeroberfläche sowie generische
Objektkategorien werden übersetzt. Sie tragen keine Regelbedeutung.

### Regel C — Foundry-Plattformvokabular → offizielle deutsche Foundry-Begriffe

Alles, was nicht SWSE, sondern Foundry VTT ist, folgt der offiziellen deutschen
Foundry-Lokalisierung, damit System- und Kernoberfläche zusammenpassen:
*Compendium* → **Kompendium**, *Item* → **Gegenstand**, *Actor* → **Akteur**,
*Effect* → **Effekt**, *Link* → **Verknüpfung**, *Change* → **Änderung**,
*Mode* → **Modus**, *Key* → **Schlüssel**, *Value* → **Wert**,
*Priority* → **Priorität**.

### Regel D — Bei Komposita entscheidet das Kopfnomen

*Vehicle Template* → **Vehicle Template**, weil *Template* nach Regel A
englisch bleibt. *Vehicle System* → **Fahrzeugsystem**, weil *System* hier ein
Oberflächenwort ist. Das Bestimmungswort wird nicht einzeln bewertet.

### Regel E — Pluralbildung

Englische Regelbegriffe behalten den englischen Plural (*Feats*, *Force
Powers*, *Class Features*). Ausnahme: Ist der Begriff zugleich ein deutsches
Wort, gilt der deutsche Plural — *Talent* → **Talente**.

### Regel F — Spielwerte bleiben unangetastet

Würfelausdrücke (`2d6`), Modifikatoren (`+5`, `-2`), Reichweiten, Attribut-
referenzen (`@STRMOD`), Formeln und Seitenverweise werden **nie** übersetzt,
nie umformatiert und nie lokalisiert (kein Dezimalkomma). HTML-Markup in
Beschreibungen bleibt strukturgleich erhalten.

### Regel H — Link-Labels folgen denselben Regeln wie der Fließtext

Die Compendium-Beschreibungen enthalten Wiki-Links. `href`, `title` und `class`
bleiben **immer unverändert** — sie zeigen auf englische Wiki-Seiten und werden
von anderen Packs als Referenz genutzt. Nur das **sichtbare Label** wird nach
Regel A/B behandelt: Regelbegriffe und Eigennamen (Planeten, Spezies,
Organisationen, Buchtitel) bleiben englisch, generische Wörter werden übersetzt
(*Vehicles* → **Fahrzeugen**, *Droid* → **Droide**).

**Sonderfall vorangestelltes „The":** Bei englischen Eigennamen wird ein
vorangestelltes `The` im Label weggelassen, damit der deutsche Artikel korrekt
flektieren kann — `title="The Outer Rim"` bleibt, das Label wird zu
*Outer Rim*, und im Satz steht „…den der Outer Rim zu bieten hat". Sonst
entstehen Konstruktionen wie „die The Galactic Republic", die falsch sind.

### Regel G — Mechanik vor Eleganz

Beschreibt ein Text eine Regelmechanik, hat die mechanische Eindeutigkeit
Vorrang vor dem Sprachfluss. Lieber steif und eindeutig als hübsch und
mehrdeutig. Insbesondere: *may* → **darf** (Erlaubnis) vs. *can* → **kann**
(Fähigkeit); *you may choose* → **du darfst wählen**; Bedingungssätze behalten
ihre Reihenfolge (Bedingung zuerst), damit die Auslösebedingung vorn steht.

## Attributskürzel — bleiben englisch

`Str`, `Dex`, `Con`, `Int`, `Wis`, `Cha` bleiben unverändert.

Das ist keine Bequemlichkeit, sondern eine Notwendigkeit: Voraussetzungstexte
(„Dex 13") und Wurfformeln (`@STRMOD`, `@DEXMOD`) referenzieren genau diese
Kürzel. Ein deutsches Bogenlabel („GES") neben einer Formel, die `DEXMOD`
heißt, wäre ein Bedienfehler mit Ansage. Die ausgeschriebenen Attributnamen
dürfen deutsch erscheinen, wo Platz ist (Stärke, Geschicklichkeit,
Konstitution, Intelligenz, Weisheit, Charisma) — die Kürzel nicht.

## Begriffsliste

### Englisch (Regel A)

| Englisch | Deutsch | Anmerkung |
|---|---|---|
| Reflex Defense | *Reflex Defense* | Kenngröße auf dem Bogen |
| Fortitude Defense | *Fortitude Defense* | Kenngröße auf dem Bogen |
| Will Defense | *Will Defense* | Kenngröße auf dem Bogen |
| Damage Threshold | *Damage Threshold* | Kenngröße, löst Condition Track aus |
| Condition Track | *Condition Track* | definierter Zustandsmechanismus |
| Condition -1 … -10, Helpless | unverändert | Stufen des Condition Track |
| Second Wind | *Second Wind* | benannte Aktion |
| Force Point | *Force Point* | Ressource |
| Destiny Point | *Destiny Point* | Ressource |
| Dark Side Score | *Dark Side Score* | Kenngröße |
| Hit Points | *Hit Points* | Kenngröße |
| Damage Reduction | *Damage Reduction* | Kenngröße |
| Shield Rating / Shield | *Shield* | Kenngröße/Zustand |
| Base Attack Bonus | *Base Attack Bonus* | Kenngröße |
| Grapple | *Grapple* | benannte Aktion |
| Cover, Improved Cover, Total Cover | unverändert | Regelzustände mit Bonus auf Reflex Defense |
| Low / High / Zero Gravity | unverändert | Umgebungsregelzustände; das Token-Tooltip muss den Begriff zeigen, den die Spielleitung zitiert |
| Feat | *Feat* | Charakterbau-Ressource |
| Talent | *Talent* (Pl. Talente) | zugleich deutsches Wort, Regel E |
| Force Power / Technique / Secret / Regimen | unverändert | Regelwerkskategorien |
| Starship Maneuver | *Starship Maneuver* | Regelwerkskategorie |
| Class Feature | *Class Feature* | Regelwerkskategorie |
| Trait | *Trait* | mechanisches Paket (Spezies-Traits) |
| Template | *Template* | Modifikationsmechanik |
| Background | *Background* | Regelwerkskategorie (Unknown Regions) |
| Destiny | *Destiny* | Regelwerkskategorie |
| Affiliation | *Affiliation* | Regelwerkskategorie |
| Upgrade | *Upgrade* | Regelwerkskategorie; gültiges deutsches Lehnwort |
| Hazard, Implant | unverändert | Regelwerkskategorien |
| Beast Attack / Sense / Type / Quality | unverändert | Regelwerkskategorien |
| Skill, Skill Check, Trained, Untrained | unverändert | Regelbegriffe; alle Skill-Namen (*Persuasion*, *Treat Injury*, *Knowledge (…)*) bleiben englisch, weil Voraussetzungen und `Skill Focus (…)` sie namentlich referenzieren |
| Core World / Core Worlds, Outer Rim, Colonies | unverändert | Settingbegriffe der Galaxiskarte |
| Str, Dex, Con, Int, Wis, Cha | unverändert | siehe oben |

### Deutsch (Regeln B–D)

| Englisch | Deutsch |
|---|---|
| Character | Charakter |
| Vehicle | Fahrzeug |
| Computer | Computer |
| Weapon | Waffe |
| Armor | Rüstung |
| Equipment | Ausrüstung |
| Species | Spezies |
| Class | Klasse |
| Language | Sprache |
| Vehicle System | Fahrzeugsystem |
| Droid System | Droidensystem |
| Vehicle Base Type | Fahrzeug-Basistyp |
| Name | Name |
| Type | Typ |
| Summary | Übersicht |
| Effects | Effekte |
| Changes | Änderungen |
| Links | Verknüpfungen |
| Key | Schlüssel |
| Mode | Modus |
| Priority | Priorität |
| Value | Wert |
| Weight | Gewicht |
| Cost | Kosten |
| Description | Beschreibung |
| Notes | Notizen |
| Search | Suche |
| Total | Gesamt |
| Settings | Einstellungen |
| Prerequisites | Voraussetzungen |
| Availability | Verfügbarkeit |
| Compendium Browser | Kompendium-Browser |

## Konsequenz, die man kennen muss

Von den 71 Schlüsseln in `lang/de.json` sind **41 mit dem englischen Text
identisch** — weil Regel A das so vorschreibt, nicht aus Nachlässigkeit. Der
sichtbare Effekt einer Umstellung auf Deutsch ist deshalb kleiner, als die
Anzahl der Schlüssel vermuten lässt. Das ist gewollt und dokumentiert.

## Anwendung auf die Compendium-Inhalte (Babele)

Namen von Regelwerkseinträgen (Feats, Talents, Force Powers) sind
**Nachschlagenamen**: Sie stehen in Voraussetzungsketten, die das System als
Text vergleicht. Sie werden deshalb im Namensfeld englisch geführt bzw. — wo
der deutsche Name Mehrwert bringt — als `Deutsch (English)` geführt, damit die
Suche nach dem englischen Begriff weiterhin trifft.

**Backgrounds sind die Ausnahme**, und deshalb der Pilot: Sie werden
mechanisch nicht über ihren Namen referenziert, sondern nur ausgewählt. Ihre
Namen sind vollständig übersetzbar, ohne etwas zu brechen. Babele bewahrt
zusätzlich den Originalnamen unter `flags.babele.originalName` auf und
durchsucht ihn mit — eine Suche nach „Bespin Origin" findet den Eintrag also
weiterhin, obwohl er „Bespin (Herkunft)" heißt.

### Namensschemata im Pack `backgrounds`

| Muster | Regel | Beispiel |
|---|---|---|
| `<Planet> Origin` | `<Planet> (Herkunft)` — Planetenname bleibt vorn, damit die alphabetische Suche nach dem Planeten weiter funktioniert | *Bespin Origin* → **Bespin (Herkunft)** |
| Beruf, im Original Personenbezeichnung | Personenbezeichnung | *Executive* → **Führungskraft** |
| Beruf, im Original Sachgebiet | Sachgebiet | *Technology* → **Technik** |
| Ereignis (Partizip) | Partizip | *Scarred* → **Vernarbt** |
| Klammerzusatz `(Occupation)` | nur übernehmen, wo das Original ihn führt | *Pilot (Occupation)* → **Pilot (Beruf)** |

### Eine Registerentscheidung, die begründet werden muss

*Crippled* → **Versehrt** (nicht „Verkrüppelt"). „Verkrüppelt" ist im heutigen
Deutsch abwertend, während das englische *Crippled* im Regelwerk lediglich
altmodisch klingt. „Versehrt" (wie in *Kriegsversehrter*) trifft das Register
des Originals — dauerhaft körperlich geschädigt, leicht altertümlich — ohne
herabwürdigend zu sein. Der beschreibende Text nennt zusätzlich „schwer
verwundet", sodass die Mechanik (Cybernetic Prosthesis, Damage Threshold)
eindeutig bleibt.
