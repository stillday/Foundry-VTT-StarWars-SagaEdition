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

**Korrektur (Sicherheitsmatrix, siehe `i18n-tools/state/safety.json`):** Die
frühere Annahme, Backgrounds seien die Ausnahme und ihre Namen frei übersetzbar,
ist **falsch**. 33 der 80 Background-Namen werden namentlich referenziert — die
NPC-Statblocks in den Packs `swse.units-cl-*` führen ihren Background als
`system.providedItems: {name: "Crippled", type: "background"}`. Wird der Name
übersetzt, findet `getIndexEntryByName()` den Eintrag nicht mehr und der NPC
bekommt seinen Background stillschweigend nicht.

Deshalb gilt jetzt für **alle** Regelpacks ohne Ausnahme: **Namen bleiben
englisch.** Nur `swse.templates` (54 Einträge) und die Actor-Packs sind
nachweislich referenzfrei. Die deutschen Namen sind nicht verloren — sie liegen
in `i18n-tools/state/names.json` und werden vom Build bewusst verweigert
(`Namen verweigert: 80`). Sollte das System eines Tages beim Vergleich auf
`flags.babele.originalName` zurückfallen, sind sie mit einem Schalter wieder da
(`i18n build --names=partial` bzw. eine dann erweiterte Sicherheitsmatrix).

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

---

# Maschinenlesbarer Teil

Alles unterhalb dieser Linie liest das Werkzeug `i18n-tools/i18n` direkt aus dieser
Datei. Die Tabellen oben sind die menschliche Begründung, die Tabellen hier unten
sind die **Durchsetzung**. Wer oben etwas ergänzt, muss es hier ergänzen —
`i18n glossary --lint` meldet erkennbare Abweichungen zwischen beiden Teilen.

Geprüft wird immer der **fertig zusammengesetzte deutsche Text** (also nach dem
Wiedereinsetzen der HTML-Elemente), verglichen mit dem englischen Quelltext des
gleichen Segments. Steht ein Begriff im Quelltext, muss die deutsche Fassung die
hier festgelegte Entsprechung enthalten. Bei `Schwere = error` bricht der Build ab,
bei `warn` wird die Fundstelle gemeldet; `i18n build --strict` macht aus jeder
Warnung einen Fehler.

Modi:

* `keep` — der englische Begriff muss unverändert im deutschen Text stehen.
* `stem` — die deutsche Entsprechung muss als Zeichenkette vorkommen; deutsche
  Endungen sind damit automatisch erlaubt (*Fahrzeug* deckt *Fahrzeugen* ab).
* `any` — mehrere Entsprechungen zulässig, getrennt durch ` | `.

Zwei Toleranzen, damit die Prüfung nicht gegen die deutsche Grammatik arbeitet:
Bei `keep` gilt ein mehrteiliger Begriff auch als eingehalten, wenn er als deutsches
Bindestrich-Kompositum erscheint (*Outer-Rim-Welt*) — der Begriff bleibt lesbar und
im Regelwerk auffindbar. Bei `stem` und `any` wird die Groß-/Kleinschreibung
ignoriert, damit Komposita wie *Bonussprache* die Entsprechung *Sprache* erfüllen.

## Begriffe (Durchsetzung)

| Quelltext (EN) | Erwartet im deutschen Text | Modus | Schwere |
|---|---|---|---|
| Reflex Defense | Reflex Defense | keep | error |
| Fortitude Defense | Fortitude Defense | keep | error |
| Will Defense | Will Defense | keep | error |
| Damage Threshold | Damage Threshold | keep | error |
| Condition Track | Condition Track | keep | error |
| Helpless | Helpless | keep | error |
| Second Wind | Second Wind | keep | error |
| Force Point | Force Point | keep | error |
| Force Points | Force Points | keep | error |
| Destiny Point | Destiny Point | keep | error |
| Destiny Points | Destiny Points | keep | error |
| Dark Side Score | Dark Side Score | keep | error |
| Hit Points | Hit Points | keep | error |
| Damage Reduction | Damage Reduction | keep | error |
| Shield Rating | Shield Rating | keep | error |
| Base Attack Bonus | Base Attack Bonus | keep | error |
| Grapple | Grapple | keep | error |
| Total Cover | Total Cover | keep | error |
| Improved Cover | Improved Cover | keep | error |
| Cover | Cover | keep | warn |
| Low Gravity | Low Gravity | keep | error |
| High Gravity | High Gravity | keep | error |
| Zero Gravity | Zero Gravity | keep | error |
| Feat | Feat | keep | error |
| Feats | Feats | keep | error |
| Talent | Talent \| Talente | any | error |
| Talents | Talente \| Talents | any | error |
| Talent Tree | Talent Tree | keep | error |
| Talent Trees | Talent Trees | keep | error |
| Force Power | Force Power | keep | error |
| Force Powers | Force Powers | keep | error |
| Force Technique | Force Technique | keep | error |
| Force Techniques | Force Techniques | keep | error |
| Force Secret | Force Secret | keep | error |
| Force Secrets | Force Secrets | keep | error |
| Force Regimen | Force Regimen | keep | error |
| Force Regimens | Force Regimens | keep | error |
| Starship Maneuver | Starship Maneuver | keep | error |
| Starship Maneuvers | Starship Maneuvers | keep | error |
| Class Feature | Class Feature | keep | error |
| Class Features | Class Features | keep | error |
| Trait | Trait | keep | error |
| Traits | Traits | keep | error |
| Template | Template | keep | error |
| Templates | Templates | keep | error |
| Background | Background | keep | error |
| Backgrounds | Backgrounds | keep | error |
| Destiny | Destiny | keep | error |
| Affiliation | Affiliation | keep | error |
| Affiliations | Affiliations | keep | error |
| Upgrade | Upgrade | keep | error |
| Upgrades | Upgrades | keep | error |
| Hazard | Hazard | keep | error |
| Hazards | Hazards | keep | error |
| Implant | Implant | keep | error |
| Implants | Implants | keep | error |
| Beast Attack | Beast Attack | keep | error |
| Beast Sense | Beast Sense | keep | error |
| Beast Type | Beast Type | keep | error |
| Beast Quality | Beast Quality | keep | error |
| Skill Check | Skill Check | keep | error |
| Skill Focus | Skill Focus | keep | error |
| Skill | Skill | keep | error |
| Skills | Skills | keep | error |
| Trained | Trained | keep | warn |
| Untrained | Untrained | keep | error |
| Core World | Core World | keep | error |
| Core Worlds | Core Worlds | keep | error |
| Outer Rim | Outer Rim | keep | error |
| Colonies | Colonies | keep | error |
| Str | Str | keep | error |
| Dex | Dex | keep | error |
| Con | Con | keep | warn |
| Int | Int | keep | warn |
| Wis | Wis | keep | error |
| Cha | Cha | keep | error |
| Character | Charakter | stem | warn |
| Vehicle | Fahrzeug | stem | warn |
| Vehicles | Fahrzeug | stem | warn |
| Weapon | Waffe | stem | warn |
| Weapons | Waffe | stem | warn |
| Armor | Rüstung | stem | warn |
| Equipment | Ausrüstung | stem | warn |
| Species | Spezies | stem | warn |
| Class | Klasse | stem | warn |
| Language | Sprache | stem | warn |
| Languages | Sprache | stem | warn |
| Vehicle System | Fahrzeugsystem | stem | warn |
| Droid System | Droidensystem | stem | warn |
| Vehicle Base Type | Fahrzeug-Basistyp | stem | warn |
| Weight | Gewicht | stem | warn |
| Cost | Kosten | stem | warn |
| Description | Beschreibung | stem | warn |
| Notes | Notiz | stem | warn |
| Prerequisites | Voraussetzung | stem | warn |
| Prerequisite | Voraussetzung | stem | warn |
| Availability | Verfügbarkeit | stem | warn |
| Compendium | Kompendium | stem | warn |
| Item | Gegenstand \| Gegenstände | any | warn |
| Actor | Akteur | stem | warn |
| Effect | Effekt | stem | warn |
| Effects | Effekt | stem | warn |
| Shield | Shield | keep | error |
| Computer | Computer | keep | error |
| Name | Name | keep | error |
| Type | Typ | stem | warn |
| Summary | Übersicht | stem | warn |
| Search | Suche | stem | warn |
| Total | Gesamt | stem | warn |
| Settings | Einstellungen | stem | warn |
| Key | Schlüssel | stem | warn |
| Mode | Modus | stem | warn |
| Priority | Priorität | stem | warn |
| Value | Wert | stem | warn |
| Changes | Änderung | stem | warn |
| Links | Verknüpfung | stem | warn |
| Compendium Browser | Kompendium-Browser | stem | warn |

## Boilerplate-Labels

Die Compendium-Beschreibungen aus dem Wiki beginnen tausendfach mit demselben
Doppelpunkt-Label. Diese Zuordnung übersetzt es einmal; das Werkzeug erledigt den
Rest der Zeile automatisch, wenn dahinter nur Links, Zahlen und Bindewörter stehen.

| Label (EN) | Label (DE) |
|---|---|
| Reference Book | Quellenbuch |
| Homebrew Reference Book | Homebrew-Quellenbuch |
| See also | Siehe auch |
| Main Article | Hauptartikel |
| Main Articles | Hauptartikel |
| Effect | Effekt |
| Special | Besonderes |
| Personality | Persönlichkeit |
| Age Groups | Altersgruppen |
| Physical Description | Körperliche Beschreibung |
| Homeworld | Heimatwelt |
| Adventurers | Abenteurer |
| Example Names | Beispielnamen |
| Prerequisite | Voraussetzung |
| Prerequisites | Voraussetzungen |
| Language | Sprache |
| Languages | Sprachen |
| Trigger | Auslöser |
| Attack | Angriff |
| Recurrence | Wiederholung |
| Keywords | Keywords |
| Time | Zeit |
| Target | Ziel |
| Targets | Ziele |
| Relevant Skills | Relevante Skills |
| Suggested Skills | Empfohlene Skills |
| Emplacement Points | Emplacement Points |
| Bonus Language | Bonussprache |
| Normal | Normal |
| Accurate | Accurate |
| Inaccurate | Inaccurate |
| Manufactured By | Hergestellt von |
| Applicable To | Anwendbar auf |
| Weapons | Waffen |
| Armors | Rüstungen |
| Size Restriction | Größenbeschränkung |
| Maximum Dexterity Bonus | Maximum Dexterity Bonus |
| Bonus to Reflex Defense | Bonus auf Reflex Defense |
| Bonus to Fortitude Defense | Bonus auf Fortitude Defense |
| Bonus to Will Defense | Bonus auf Will Defense |
| Benefit | Vorteil |
| Rejection Attack Bonus | Rejection Attack Bonus |
| Enemies and Allies | Feinde und Verbündete |
| Scale | Scale |
| Criteria Tables | Kriterientabellen |
| Requirements | Anforderungen |
| Availability | Verfügbarkeit |
| Cost | Kosten |
| Weight | Gewicht |
| Damage | Schaden |
| Source | Quelle |
| Notes | Notizen |
| Duration | Dauer |
| Range | Reichweite |
| Size | Größe |
| Speed | Geschwindigkeit |
| Crew | Besatzung |
| Passengers | Passagiere |
| Cargo Capacity | Frachtkapazität |
| Consumables | Verbrauchsgüter |
| Hyperdrive | Hyperdrive |
| Availability Note | Hinweis zur Verfügbarkeit |

## Bindewörter in Aufzählungen

| EN | DE |
|---|---|
| and | und |
| or | oder |
| and/or | und/oder |
| see | siehe |
| also | auch |
| per | pro |
| none | keine |

## Kategoriezeilen

| Quelltext (EN) | Deutsch |
|---|---|
| Background Planet of Origin | Background: Heimatwelt |
| Background Occupation | Background: Beruf |
| Background Event | Background: Ereignis |
