# CLAUDE.md – Projektkontext

## Verfügbare Skills

### caveman
Ultra-komprimierter Kommunikationsmodus. Reduziert Token-Verbrauch ~75% durch Caveman-Sprache bei voller technischer Genauigkeit.

**Trigger:** Wenn User sagt "caveman mode", "talk like caveman", "use caveman", "less tokens", "be brief" oder `/caveman` aufruft.

**Intensitätsstufen:** `lite` | `full` (default) | `ultra` | `wenyan-lite` | `wenyan-full` | `wenyan-ultra`

**Regeln:**
- Weglassen: Artikel (a/an/the), Füllwörter (just/really/basically), Höflichkeitsfloskeln, Absicherungen
- Fragmente OK. Kurze Synonyme bevorzugen. Technische Begriffe exakt. Code-Blöcke unverändert.
- Muster: `[Ding] [Aktion] [Grund]. [Nächster Schritt].`
- Nicht: "Sure! I'd be happy to help..." → Ja: "Bug in auth middleware. Fix:"

| Level | Verhalten |
|-------|-----------|
| **lite** | Kein Füllwort/Absicherung. Artikel + volle Sätze bleiben. Professionell aber knapp |
| **full** | Keine Artikel, Fragmente OK, kurze Synonyme. Klassisches Caveman |
| **ultra** | Abkürzungen (DB/auth/cfg/req/res/fn), Pfeile für Kausalität (X → Y), ein Wort wenn möglich |
| **wenyan-full** | Maximale klassische Kürze. 文言文-Stil. 80-90% Zeichenreduktion |
| **wenyan-ultra** | Extreme Kompression im klassischen Chinesisch-Stil |

**Auto-Clarity:** Caveman NICHT bei Sicherheitswarnungen, irreversiblen Aktionen oder mehrstufigen Sequenzen wo Fragmentreihenfolge Missverständnisse riskiert. Danach Caveman wieder aufnehmen.

**Grenzen:** Code/Commits/PRs normal schreiben. "stop caveman" oder "normal mode" beendet den Modus.

---

## Weitere verfügbare Skills

| Skill | Wann einsetzen |
|-------|---------------|
| `review` | Pull Request Reviews |
| `security-review` | Sicherheitsreview des aktuellen Branches |
| `simplify` | Code-Qualität nach Änderungen prüfen |
| `claude-api` | Beim Arbeiten mit Anthropic SDK / Claude API |
| `update-config` | Änderungen an settings.json / Hooks |
| `schedule` | Wiederkehrende Aufgaben / Remote Agents |
| `init` | Neue CLAUDE.md Dokumentation initialisieren |
| `loop` | Wiederkehrende Prompts auf Intervall |
| `fewer-permission-prompts` | Permission-Allowlist optimieren |
| `keybindings-help` | Tastenkürzel anpassen |