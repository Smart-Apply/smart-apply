# Smart Apply - Monorepo Workspace

npm Workspaces-basiertes Monorepo für Smart Apply (Frontend + Backend).

## 📁 Struktur

```text
smart-apply/
├── package.json              # Workspace Root (Orchestrator)
├── apps/
│   ├── api/
│   │   ├── package.json      # @smart-apply/api (Backend)
│   │   ├── src/              # NestJS Source Code
│   │   ├── test/             # E2E & Unit Tests
│   │   └── prisma/           # Database Schema & Migrations
│   └── web/
│       ├── package.json      # @smart-apply/web (Frontend)
│       └── src/              # Next.js Source Code
├── node_modules/             # Shared Dependencies (Root)
├── apps/api/node_modules/    # API-specific Dependencies
└── apps/web/node_modules/    # Web-specific Dependencies
```

## 🎯 Workspace-Konzept

### Root package.json

- **Zweck:** Workspace Manager & gemeinsame DevDependencies
- **Enthält:** TypeScript, ESLint, Jest, Prettier, Prisma CLI
- **Scripts:** Orchestriert alle Workspace-Commands

### apps/api/package.json

- **Name:** `@smart-apply/api`
- **Enthält:** NestJS, Prisma Client, Azure SDKs, Puppeteer, etc.
- **Scripts:** Backend-spezifische Commands (build, test, prisma)

### apps/web/package.json

- **Name:** `@smart-apply/web`
- **Enthält:** Next.js, React, Tailwind, shadcn/ui, etc.
- **Scripts:** Frontend-spezifische Commands (dev, build, lint)

## 🚀 Commands

### Development

```bash
# Alle Apps starten (parallel)
npm run dev

# Nur Backend
npm run api:dev

# Nur Frontend
npm run web:dev
```

### Build

```bash
# Alle Apps bauen
npm run build

# Nur Backend
npm run api:build

# Nur Frontend
npm run web:build
```

### Testing

```bash
# Backend E2E Tests
npm run api:test

# Frontend Lint
npm run web:lint
```

### Database (Prisma)

```bash
# Generate Prisma Client
npm run prisma:generate

# Run Migrations
npm run prisma:migrate

# Seed Database
npm run prisma:seed

# Seed Templates
npm run prisma:seed:templates

# Open Prisma Studio
npm run prisma:studio
```

### Linting & Formatting

```bash
# Format all code
npm run format

# Lint all code
npm run lint
```

## 📦 Dependency Management

### Installation

```bash
# Installiere alle Dependencies (Root + alle Workspaces)
npm install
```

### Workspace-spezifische Dependencies

```bash
# Backend Dependency hinzufügen
npm install <package> --workspace=apps/api

# Frontend Dependency hinzufügen
npm install <package> --workspace=apps/web

# DevDependency im Root (shared)
npm install <package> --save-dev
```

### Beispiele

```bash
# Neue NestJS Library im Backend
npm install @nestjs/cache-manager --workspace=apps/api

# Neue React Library im Frontend
npm install react-icons --workspace=apps/web

# Shared Tool im Root
npm install --save-dev husky
```

## 🔧 Wie npm Workspaces funktioniert

### Dependency Resolution

1. **Root `node_modules/`**: Gemeinsame Dependencies (TypeScript, ESLint, etc.)
2. **Workspace `node_modules/`**: App-spezifische Dependencies
3. **Hoisting**: npm hebt gemeinsame Dependencies automatisch ins Root

### Symlinks

```bash
# Workspaces sind über Symlinks verbunden
node_modules/@smart-apply/api -> ../../apps/api
node_modules/@smart-apply/web -> ../../apps/web
```

### Shared Dependencies

Dependencies, die in BEIDEN Apps verwendet werden, werden ins Root gehoben:

- `typescript` ✅ (beide brauchen es)
- `@types/node` ✅ (beide brauchen es)
- `zod` ✅ (beide brauchen es)

App-spezifische Dependencies bleiben in ihrem Workspace:

- `@nestjs/*` → nur in `apps/api/node_modules/`
- `next` → nur in `apps/web/node_modules/`

## 🎨 Vorteile

### 1. Saubere Trennung

- Backend-Code und Dependencies isoliert
- Frontend-Code und Dependencies isoliert
- Klare Verantwortlichkeiten

### 2. Schnellere Installs

- Shared Dependencies werden nur einmal installiert
- Nur relevante Dependencies pro App

### 3. Bessere IDE-Performance

- TypeScript muss nur relevante Dependencies prüfen
- Schnellere Auto-Completion

### 4. Einfacheres Deployment

- Jede App kann separat deployed werden
- Docker-Images können kleiner sein (nur relevante Dependencies)

### 5. Bessere Skalierbarkeit

- Neue Workspaces einfach hinzufügen (z.B. `apps/mobile`)
- Shared Libraries möglich (`packages/shared`)

## 📝 Migration von alter Struktur

### Vorher (Problematisch)

```text
smart-apply/
├── package.json              # ALLE Dependencies gemischt
├── node_modules/             # Riesiges node_modules
└── apps/
    ├── api/                  # Keine package.json
    └── web/
        └── package.json      # Nur Frontend
```

### Nachher (Clean)

```text
smart-apply/
├── package.json              # Workspace Manager
├── node_modules/             # Nur Shared Dependencies
└── apps/
    ├── api/
    │   ├── package.json      # Backend Dependencies
    │   └── node_modules/     # Backend-spezifisch
    └── web/
        ├── package.json      # Frontend Dependencies
        └── node_modules/     # Frontend-spezifisch
```

## 🔄 Workflow-Tipps

### Neue Dependency hinzufügen

1. **Frage:** Wird es in beiden Apps gebraucht?
   - **Ja:** `npm install <package> --save-dev` (Root)
   - **Nein:** `npm install <package> --workspace=apps/api` (oder web)

2. **Beispiele:**
   - `prettier` → Root (beide nutzen es)
   - `@nestjs/common` → apps/api (nur Backend)
   - `react` → apps/web (nur Frontend)

### Scripts ausführen

```bash
# In Workspace-Root (empfohlen)
npm run api:dev

# Oder direkt im Workspace
cd apps/api && npm run start:dev
```

### Troubleshooting

```bash
# Dependencies neu installieren
rm -rf node_modules apps/*/node_modules package-lock.json
npm install

# Prisma Client neu generieren
npm run prisma:generate

# TypeScript Errors? Neu bauen
npm run build
```

## 🚢 Deployment

### Backend (Azure Container Apps)

```dockerfile
# Dockerfile für apps/api
FROM node:20-alpine

WORKDIR /app

# Kopiere Root package.json
COPY package*.json ./

# Kopiere API package.json
COPY apps/api/package*.json ./apps/api/

# Installiere Dependencies (nur Production)
RUN npm ci --workspace=apps/api --omit=dev

# Kopiere API Source
COPY apps/api ./apps/api

# Build
RUN npm run build --workspace=apps/api

CMD ["npm", "run", "start:prod", "--workspace=apps/api"]
```

### Frontend (Vercel/Azure SWA)

```dockerfile
# Dockerfile für apps/web
FROM node:20-alpine

WORKDIR /app

# Kopiere package.json
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Installiere Dependencies
RUN npm ci --workspace=apps/web --omit=dev

# Kopiere Web Source
COPY apps/web ./apps/web

# Build
RUN npm run build --workspace=apps/web

CMD ["npm", "run", "start", "--workspace=apps/web"]
```

## 🎯 Best Practices

1. **Immer vom Root ausführen:** `npm run api:dev` statt `cd apps/api && npm run start:dev`
2. **Workspace-Flag nutzen:** `--workspace=apps/api` statt in Ordner wechseln
3. **Shared Dependencies im Root:** Alles was beide Apps brauchen
4. **Keine Circular Dependencies:** Workspaces sollten nicht aufeinander referenzieren (außer via APIs)
5. **Konsistente Versionen:** Shared Dependencies sollten gleiche Version haben

## 📚 Weitere Ressourcen

- [npm Workspaces Docs](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [Monorepo Best Practices](https://monorepo.tools/)
- [NestJS Monorepo](https://docs.nestjs.com/cli/monorepo)

---

**Stand:** 23. November 2025  
**Struktur:** npm Workspaces (native npm, kein Lerna/Nx benötigt)
