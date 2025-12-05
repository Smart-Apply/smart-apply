# Docker Build - Was passiert gerade?

## Wenn der Build bei npm-Warnungen "hängt"

**Das ist NORMAL!** Der Build ist nicht gehängt, es läuft gerade:

### Phase 1: npm ci (2-5 Minuten)
```
npm warn deprecated glob@6.0.4
npm warn deprecated inflight@1.0.6
npm warn deprecated rimraf@2.7.1
...viele weitere Warnungen...
```
**Was passiert:** npm installiert 400+ Pakete, keine Panik!

### Phase 2: Native Modules kompilieren (1-3 Minuten)
```
> @prisma/engines@5.x.x postinstall
> argon2@0.x.x install
> bcrypt@5.x.x install
```
**Was passiert:** Native C++ Module werden für Alpine Linux kompiliert

### Phase 3: Prisma Client generieren (1-2 Minuten)
```
> prisma generate --schema=./prisma/schema.prisma
✔ Generated Prisma Client to ./node_modules/@prisma/client
```
**Was passiert:** Prisma analysiert Schema und generiert TypeScript Types

### Phase 4: NestJS Build (1-2 Minuten)
```
> nest build
Compiling TypeScript...
```
**Was passiert:** TypeScript wird zu JavaScript kompiliert

---

## Gesamtzeit (erste Build)
- **Mit Cache:** 3-5 Minuten
- **Ohne Cache:** 8-12 Minuten

## Gesamtzeit (weitere Builds mit Cache)
- **Mit Cache:** 1-2 Minuten ✨
- BuildKit cached Layers automatisch

---

## Live-Progress anzeigen

Statt `tail -50` verwende:
```bash
# Vollständige Output mit Progress
docker build --progress=plain --target production -f infra/Dockerfile .

# Nur wichtige Steps anzeigen
docker build --target production -f infra/Dockerfile . 2>&1 | grep -E "(#[0-9]+ \[|DONE|ERROR)"
```

---

## Wenn WIRKLICH gehängt (> 15 Minuten)

```bash
# 1. Build abbrechen
Ctrl+C

# 2. Cleanup
docker builder prune -f

# 3. Nochmal mit Verbose Output
docker build --progress=plain --no-cache --target production -f infra/Dockerfile .
```

---

## Optimierungen bereits implementiert ✅

1. **BuildKit Cache Mount** - npm Cache wird zwischen Builds wiederverwendet
2. **--prefer-offline** - Verwendet lokalen Cache wenn möglich
3. **Multi-Stage Builds** - Nur Production Code im finalen Image
4. **Layer Caching** - Dependencies werden nur neu installiert wenn package.json ändert

---

## Nächster Build wird VIEL schneller sein! 🚀

Nach dem ersten erfolgreichen Build:
- npm Cache ist gefüllt
- Docker Layers sind cached
- Nur geänderte Dateien werden neu gebaut

**Typische Zeiten danach:**
- Code-Änderung: 30-60 Sekunden
- Dependency-Update: 2-3 Minuten
- Clean Build: 3-5 Minuten
