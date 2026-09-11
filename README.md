# RR Study Timer

Version 0.5.8 · Roland Russwurm · Plugin-ID `rr-study-timer`

Aktive Lernzeit, tägliche Kartenanzahl, Tageszeit nach Dokument/Ordner und Wochenübersicht Montag–Sonntag. Die Queue-Zeile zeigt nur Zeit, Karten und Durchschnitt. Mobile Unterstützung ist aktiviert.

## Übersicht öffnen

Die beiden Boxen stehen wieder auf der Karteikarten-Statistikseite. Die Registrierung auf DeckPage in 0.5.7 zeigte sie in der Desktop-App nicht an. Eine direkte Einbettung auf der neuen Karteikarten-Startseite ist derzeit nicht bestätigt und wird in dieser Version nicht versprochen.

Zusätzlich in RemNotes Befehlssuche `Lernzeit anzeigen` ausführen: Die Übersicht öffnet sich in einer eigenen Ansicht. Bei mindestens 654 px verfügbarer Breite stehen Wochen- und Tagesbox nebeneinander, in schmalen Ansichten untereinander. Die Breite des Bereichs, den RemNote einem Plugin auf der Statistikseite zuweist, bestimmt die tatsächliche Anordnung.

## Update

Die gebaute PluginZip-v0.5.8.zip über den Plugin-Entwicklerbereich als Update laden. Die vorhandene Installation nicht deinstallieren und ihre Daten nicht löschen. Danach RemNote vollständig neu laden und Version 0.5.8 prüfen.

Für localhost: vorherigen Server stoppen, das Source-ZIP neu entpacken, im Ordner rr-study-timer `npm ci` und `npm run dev` ausführen. Die vorhandene Verbindung zu http://localhost:8080 weiterverwenden und RemNote vollständig neu laden.

Zum Bauen aus einem frischen Source-ZIP:

```sh
git init
npm ci
npm test
npm run build
```

Der offizielle RemNote-Validator benötigt ein Git-Repository. Der Build erzeugt eine frische PluginZip.zip und prüft vorher die TypeScript-Typen und das Manifest.

## Verhalten und Daten

Die in 0.5.6 live bestätigte Zeitmessung und Zuordnung verspäteter Abschlussereignisse über die Karten-ID bleiben unverändert. Nach standardmäßig 30 Sekunden ohne Kartenladen, Antwortzeigen oder Bewerten pausiert die Zeit. Die Einstellung Pause after inactivity (seconds) wirkt nach Plugin-Neustart; Minimum fünf Sekunden. Sichtbarkeit wird vom Queue-Widget gemeldet.

Dokument-/Ordner-IDs bleiben die dauerhaften Schlüssel; Umbenennungen ändern nicht die historischen Werte. Die vorhandenen Tageswerte werden weitergelesen. Wiederholte Bewertungen derselben Karte zählen erneut. Nie aufgezeichnete Zeiten lassen sich nicht rückwirkend rekonstruieren.

Speicherungen erfolgen regelmäßig und bei Kartenwechsel/Abschluss. Ein abruptes Schließen kann den letzten noch nicht gespeicherten Abschnitt verlieren. Paralleles Lernen in mehreren Instanzen hat weiterhin keine atomare Zusammenführung synchronisierter Tageswerte.

## Änderungen in 0.5.8

Die Übersicht ist wieder auf LearningProgressPage registriert, dem in der Desktop-App bereits funktionierenden Platz. Zusätzlich ist sie als Pane über Lernzeit anzeigen aufrufbar. DeckPage wird nicht mehr verwendet. Responsive Anordnung, reduzierte Queue-Zeile und Entfernung der Diagnosefunktion aus 0.5.7 bleiben erhalten. Historische DEBUG-Dateien dokumentieren frühere Versionen und sind keine aktuelle Bedienungsanleitung.
