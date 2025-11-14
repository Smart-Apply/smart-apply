# Applications Dashboard - UI Mockup

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Bewerbungen                                    🔄 Aktualisieren   │
│  Verwalte alle deine Bewerbungen an einem Ort  ➕ Neue Bewerbung  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [ Alle 5 ] [ Ausstehend 1 ] [ In Bearbeitung 1 ]           │   │
│  │            [ Fertig 2 ] [ Fehlgeschlagen 1 ]                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ Senior Frontend Developer                    🟢 Fertig     ┃   │
│  ┃ TechCorp GmbH • Berlin                                     ┃   │
│  ┃─────────────────────────────────────────────────────────────┃   │
│  ┃ Erstellt am 14. November 2025                              ┃   │
│  ┃                      📄 Anschreiben 📄 Lebenslauf Details  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ Backend Engineer                        🔵 Wird erstellt ⟳ ┃   │
│  ┃ StartupXYZ • München                                       ┃   │
│  ┃─────────────────────────────────────────────────────────────┃   │
│  ┃ Erstellt am 13. November 2025                              ┃   │
│  ┃                                                    Details  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ Full Stack Developer                    🟢 Fertig          ┃   │
│  ┃ InnovateAG • Frankfurt                                     ┃   │
│  ┃─────────────────────────────────────────────────────────────┃   │
│  ┃ Erstellt am 12. November 2025                              ┃   │
│  ┃                      📄 Anschreiben 📄 Lebenslauf Details  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ DevOps Specialist                       🟤 Ausstehend      ┃   │
│  ┃ CloudSystems • Hamburg                                     ┃   │
│  ┃─────────────────────────────────────────────────────────────┃   │
│  ┃ Erstellt am 11. November 2025                              ┃   │
│  ┃                                                    Details  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ Data Engineer                      🔴 Fehlgeschlagen       ┃   │
│  ┃ DataCo • Stuttgart                                         ┃   │
│  ┃─────────────────────────────────────────────────────────────┃   │
│  ┃ Erstellt am 10. November 2025                              ┃   │
│  ┃                                                    Details  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Filter View - "Fertig" Selected

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Bewerbungen                                    🔄 Aktualisieren   │
│  Verwalte alle deine Bewerbungen an einem Ort  ➕ Neue Bewerbung  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [ Alle 5 ] [ Ausstehend 1 ] [ In Bearbeitung 1 ]           │   │
│  │            [★ Fertig 2 ★] [ Fehlgeschlagen 1 ]             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ Senior Frontend Developer                    🟢 Fertig     ┃   │
│  ┃ TechCorp GmbH • Berlin                                     ┃   │
│  ┃─────────────────────────────────────────────────────────────┃   │
│  ┃ Erstellt am 14. November 2025                              ┃   │
│  ┃                      📄 Anschreiben 📄 Lebenslauf Details  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ Full Stack Developer                    🟢 Fertig          ┃   │
│  ┃ InnovateAG • Frankfurt                                     ┃   │
│  ┃─────────────────────────────────────────────────────────────┃   │
│  ┃ Erstellt am 12. November 2025                              ┃   │
│  ┃                      📄 Anschreiben 📄 Lebenslauf Details  ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Empty State - No Applications

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Bewerbungen                                    🔄 Aktualisieren   │
│  Verwalte alle deine Bewerbungen an einem Ort  ➕ Neue Bewerbung  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                               │ │
│  │                          📄                                   │ │
│  │                                                               │ │
│  │              Noch keine Bewerbungen                           │ │
│  │                                                               │ │
│  │       Erstelle deine erste Bewerbung mit KI-Unterstützung    │ │
│  │                                                               │ │
│  │              ┌──────────────────────────────┐                 │ │
│  │              │ ➕ Erste Bewerbung erstellen │                 │ │
│  │              └──────────────────────────────┘                 │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Empty State - Filtered (No Results)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Bewerbungen                                    🔄 Aktualisieren   │
│  Verwalte alle deine Bewerbungen an einem Ort  ➕ Neue Bewerbung  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [ Alle 3 ] [ Ausstehend 0 ] [ In Bearbeitung 1 ]           │   │
│  │            [★ Fertig 2 ★] [ Fehlgeschlagen 0 ]             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                               │ │
│  │                          📄                                   │ │
│  │                                                               │ │
│  │              Keine Bewerbungen gefunden                       │ │
│  │                                                               │ │
│  │     Es gibt keine Bewerbungen mit dem Status "Fertig"        │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Status Badge Legend

| Badge Color | Icon | Status | Meaning |
|-------------|------|--------|---------|
| 🟤 Gray | ⏰ Clock | PENDING | Application queued for processing |
| 🔵 Blue | ⚠️ AlertCircle (spinning ⟳) | GENERATING | AI is creating documents |
| 🟢 Green | ✓ CheckCircle | READY | Documents ready for download |
| 🔴 Red | ✕ XCircle | FAILED | Generation failed |

## Interactive Elements

### Filter Tabs
- **Hover**: Slight opacity change
- **Active**: Bold text, highlighted background
- **Click**: Instant filter update (no page reload)

### Refresh Button
- **Hover**: Background color change
- **Click**: Icon spins, button disabled during refresh
- **Complete**: Icon stops spinning, button re-enabled

### Application Cards
- **Hover**: Shadow elevation increases
- **Status Badge**: Shows animation for GENERATING status
- **Action Buttons**: 
  - Download buttons only visible for READY status
  - Details button always visible
  - Hover effect on all buttons

### Auto-Refresh Indicator
- Silent polling every 10 seconds when active applications exist
- No UI disruption during polling
- Data updates smoothly without flickering

## Responsive Behavior

### Mobile (< 768px)
- Filter tabs stack vertically or scroll horizontally
- Refresh button moves to row below title
- Application cards full width
- Action buttons stack vertically in card

### Tablet (768px - 1024px)
- Filter tabs in single row
- Buttons in header row
- Application cards full width with horizontal layout

### Desktop (> 1024px)
- Full layout as shown in mockups
- Hover effects enabled
- Optimal spacing and padding
