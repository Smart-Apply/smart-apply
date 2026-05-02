# 🌐 Domain & Cloudflare Integration — Postmortem & Runbook

> **⚠️ Status (May 2026): Historical postmortem.** The Azure VM described
> below was decommissioned after the migration to **Fly.io** (API) +
> **Cloudflare Workers** (web). The current production topology is:
>
> - `smart-apply.io` / `www.smart-apply.io` → Cloudflare Worker `smart-apply-web`
> - `api.smart-apply.io` → CNAME (Cloudflare-proxied) → `93ke51y.smart-apply-api.fly.dev`
> - Fly issues the Let's Encrypt cert directly via DNS-01; the
>   `_acme-challenge.api` CNAME **must be DNS-only** (gray cloud) or
>   Cloudflare hides it from Let's Encrypt and issuance hangs.
> - The `_fly-ownership.api` TXT record is required because traffic is
>   proxied (Fly's anti-spoof check).
>
> The nginx + Origin Cert + Real-IP setup described below is **no longer in
> use** — Fly terminates TLS at its anycast edge with a real Let's Encrypt
> cert, so `Full (strict)` Just Works. Keep this doc as the postmortem of
> the original April 2026 cutover; for the current setup see the README and
> `infra/README.md`.

> Dokumentation der Migration von `smartapplymvp.swedencentral.cloudapp.azure.com` auf die eigene Domain **`smart-apply.io`** (April 2026), inklusive Cloudflare-Setup, nginx-Reverse-Proxy und HTTPS-Härtung.

## Inhaltsverzeichnis

1. [Endzustand & Architektur](#1-endzustand--architektur)
2. [Was gut lief](#2-was-gut-lief-)
3. [Was schief lief — und wie wir es gelöst haben](#3-was-schief-lief--und-wie-wir-es-gelöst-haben)
4. [Reproduzierbarer Schritt-für-Schritt-Ablauf](#4-reproduzierbarer-schritt-für-schritt-ablauf)
5. [Operations Runbook](#5-operations-runbook)
6. [Lessons Learned](#6-lessons-learned)
7. [Offene TODOs](#7-offene-todos)

---

## 1. Endzustand & Architektur

```
                    ┌─────────────────────────┐
   Browser  ───────▶│   Cloudflare Edge       │  Universal Edge Cert (Let's Encrypt, auto-renew)
                    │  (Bot Fight, WAF, CDN)  │  Full (strict) SSL Mode
                    └────────────┬────────────┘
                                 │ HTTPS, validates Origin Cert
                                 ▼
                    ┌─────────────────────────┐
   Azure VM ───────▶│   nginx 1.24            │  Cloudflare Origin Cert (15y, RSA-2048)
   135.225.56.134   │   ports 80, 443         │  Real-IP via CF-Connecting-IP header
                    └────────────┬────────────┘
                                 │ HTTP loopback
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
            127.0.0.1:3000  127.0.0.1:3001  127.0.0.1:5432
            (smartapply-     (smartapply-     (smartapply-
             api)             web)             db)
```

### Hostname-Mapping (Cloudflare DNS, alle 🟧 Proxied)

| Hostname                | DNS Record           | Ziel                        | Verhalten                                |
| ----------------------- | -------------------- | --------------------------- | ---------------------------------------- |
| `smart-apply.io`        | `A`                  | `135.225.56.134`            | nginx → web container (200)              |
| `www.smart-apply.io`    | `A`                  | `135.225.56.134`            | nginx → 301 → `https://smart-apply.io`   |
| `api.smart-apply.io`    | `A`                  | `135.225.56.134`            | nginx → api container (200)              |
| Legacy Azure FQDN       | unverändert          | (Cloudflare nicht aktiv)    | nginx + Let's Encrypt — Rollback-Pfad    |

### Versionierte Konfiguration im Repo

| Datei                                                                                                   | Zweck                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`infra/nginx/smart-apply.conf`](../../infra/nginx/smart-apply.conf)                                    | Komplette nginx-Site-Definition (3 server-Blöcke + Cloudflare Real-IP-Liste)                |
| [`scripts/install-domain.sh`](../../scripts/install-domain.sh)                                          | Idempotenter Installer für die VM (nginx + Cert + Env-Update + API-Restart)                 |
| [`infra/docker-compose.prod.yml`](../../infra/docker-compose.prod.yml)                                  | Container-Ports auf `127.0.0.1` gebunden (nicht mehr public-facing)                         |
| [`.github/workflows/deploy-vm.yml`](../../.github/workflows/deploy-vm.yml)                              | `VM_HOST`, `HEALTH_CHECK_HOST`, `PUBLIC_API_URL` jetzt aus GitHub Repository Variables      |

### GitHub Repository Variables

Settings → Secrets and variables → Actions → **Variables**:

| Variable             | Wert                                                                |
| -------------------- | ------------------------------------------------------------------- |
| `VM_HOST`            | `smartapplymvp.swedencentral.cloudapp.azure.com` (SSH-Ziel)         |
| `HEALTH_CHECK_HOST`  | `api.smart-apply.io`                                                |
| `PUBLIC_API_URL`     | `https://api.smart-apply.io/api/v1` (build-arg für Web-Image)       |

**Wichtig:** `VM_HOST` bleibt auf der Azure-FQDN, weil Cloudflare keinen Port 22 (SSH) proxied. Ein DNS-Eintrag für SSH wäre zwar möglich, aber unnötig.

---

## 2. Was gut lief ✅

### Architekturentscheidungen

- **Cloudflare Origin Certificate statt Let's Encrypt für Cloudflare↔Origin.** 15 Jahre gültig, kein Renewal-Cron nötig, automatisch von Cloudflare als Trust-Anchor akzeptiert. Let's Encrypt wäre zwar Auto-Renewal, aber das nginx ↔ certbot Setup hätte mehr Wartung gebracht.
- **Full (strict) SSL Mode.** Verhindert MITM zwischen Cloudflare und Origin. Mit dem Cloudflare Origin Cert ein Free-Lunch.
- **Container-Ports auf `127.0.0.1` gebunden.** Schließt einen ganzen Klasse von Cloudflare-Bypass-Angriffen aus (jemand findet `135.225.56.134:3000` durch IP-Scan und attackiert direkt). Vorher waren beide Ports public.
- **Legacy Azure-Hostname als Rollback-Pfad behalten.** Eigener nginx-server-block, eigener Let's Encrypt-Cert. Falls etwas Neues katastrophal bricht, ist der alte Hostname binnen Sekunden wieder als Fallback nutzbar.
- **Reverse-Proxy in den Repo committed.** Vorher lebte der nginx-Config nur auf der VM (single point of bus-factor). Jetzt: alles in `infra/nginx/`, Installer-Script provisioniert sie idempotent.
- **GitHub Repo Variables statt hardcoded URLs.** Domain-Wechsel braucht jetzt keinen Code-Change mehr — drei Variablen umstellen + Deploy triggern.

### Cloudflare-Vorteile out-of-the-box

- **DDoS L7 Schutz**, Bot Fight Mode, automatische Brotli-Kompression — alle Free-Tier.
- **Universal SSL Cert** für visitor↔Cloudflare automatisch eingerichtet (Let's Encrypt, 90 Tage, Auto-Renew).
- **DNS Propagation in Sekunden** statt Stunden, weil DNS-Änderungen direkt über Cloudflare gehen (kein TTL-Cache an externen Resolvern).

### Workflow

- **SSH Deploy Key statt PAT.** Vorher hatte die VM ein langlebiges Personal Access Token in der `git remote` URL versteckt. Jetzt: ed25519 Deploy Key, Read-only Scope auf das Repo. Token kann revoked werden, ohne dass die VM bricht.
- **Cert-Validierung vor Upload.** Mit `openssl x509 -modulus` + `openssl rsa -modulus` haben wir die Cert/Key-Paarung verifiziert, bevor wir auf der VM installiert haben → kein "525 SSL handshake fail" Ratespiel.

---

## 3. Was schief lief — und wie wir es gelöst haben ⚠️

### 3.1 SSL/TLS-Mode-Verwechslung (Edge vs. Origin Certificate)

**Problem:** Cloudflare bietet zwei Cert-Typen, die leicht verwechselt werden:

| Typ                     | Gilt für              | Wo erstellt                          |
| ----------------------- | --------------------- | ------------------------------------ |
| **Universal Edge Cert** | Visitor ↔ Cloudflare  | SSL/TLS → Edge Certificates (auto)   |
| **Origin Cert**         | Cloudflare ↔ VM       | SSL/TLS → **Origin Server** (manual) |

Der erste Versuch zeigte eine "Universal Certificate" Page — das war der Edge-Cert, nicht der, den wir brauchten.

**Lessons:**
- Origin Certificate liegt unter `SSL/TLS → Origin Server`, nicht `Edge Certificates`.
- Origin Cert hat `Subject Alternative Name` für `*.smart-apply.io` und `smart-apply.io` — nicht für die Azure FQDN.
- Visitor sieht nie das Origin Cert — nur Cloudflare.

### 3.2 nginx Versionsinkompatibilität (`http2` Direktive)

**Problem:** Unser Config nutzte die moderne nginx 1.25+ Syntax:

```nginx
listen 443 ssl;
http2 on;
```

VM hatte nginx 1.24, das diese Syntax nicht versteht: `unknown directive "http2"`. Crash.

**Fix:** Legacy-Syntax verwenden, die in nginx ≥1.18 funktioniert:

```nginx
listen 443 ssl http2;
listen [::]:443 ssl http2;
```

**Lesson:** Bei Server-Configs immer die niedrigste Version supporten, die in der Wild läuft. `http2 on;` ist erst seit nginx 1.25.1 (Mai 2023) verfügbar.

### 3.3 Doppeltes `gzip on;`

**Problem:** Ubuntu's `/etc/nginx/nginx.conf` aktiviert gzip schon global. Unser Site-Config wiederholte es: `"gzip" directive is duplicate`.

**Fix:** Aus dem Site-Config entfernt — Cloudflare komprimiert sowieso am Edge mit Brotli, und Ubuntu gzip ist schon aktiv.

### 3.4 OAuth Strategy Crash bei leeren ENV-Vars

**Problem:** Nach dem Update der `.env` (CORS_ORIGINS, APP_URL, API_BASE_URL) startete der API-Container nicht mehr:

```
TypeError: OAuth2Strategy requires a clientID option
    at GoogleStrategy.OAuth2Strategy
```

Die `passport-google-oauth20` Strategy bricht hart ab, wenn `clientID` falsy ist. Vorher lief der alte Container mit einer gestapelten ENV-Variable noch im Speicher; nach dem Recreate las er die fresh `.env` und der Crash kam ans Licht.

**Quick-Fix:** Dummy-Werte in ENV gesetzt (`disabled-not-yet-configured`), damit passport nicht crasht. Login-Flow würde fehlschlagen, aber alles andere bootet.

**Proper Fix (committed in `d55e667`):** OAuth-Strategien als conditional `useFactory`-Provider neuregistriert, die `null` zurückgeben + Warning loggen, wenn Creds fehlen:

```ts
const googleStrategyProvider: Provider = {
  provide: GoogleStrategy,
  inject: [AuthService, ConfigService],
  useFactory: (authService, config) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      oauthLogger.warn('Google OAuth disabled — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable');
      return null;
    }
    return new GoogleStrategy(authService, config);
  },
};
```

**Lesson:** Optionale Integrationen (OAuth, Sentry, Resend) müssen graceful degraden. App muss ohne sie booten, sonst sind sie kein "optional". Pattern: `useFactory` mit Warn-Log + `null` Return.

### 3.5 Container-Reconciliation-Drift

**Problem:** Beim ersten manuellen Restart ran `docker-compose up -d --no-deps --force-recreate api` in einen Konflikt:

```
Error: The container name "/smartapply-api" is already in use by container "...".
You have to remove (or rename) that container to be able to reuse that name.
```

**Ursache:** Der bestehende `smartapply-api` Container war außerhalb von docker-compose gestartet worden (von einem alten Setup). docker-compose findet ihn deshalb nicht in seinem State und kann ihn nicht ersetzen.

**Fix:** `docker rm -f smartapply-api` zum manuellen Entfernen, dann `docker-compose up -d`.

**Lesson:** Mischbetrieb von `docker run` + `docker-compose` führt zu Drift. Auf der VM ausschließlich docker-compose nutzen. Wenn Drift entsteht: `docker-compose down --remove-orphans` + manuelles `docker rm -f` für Container, die compose nicht kennt.

### 3.6 Apex DNS zeigte auf Namecheap-Parking

**Problem:** Erster Test von `https://smart-apply.io` ergab `522 (origin connect timeout)`. Cloudflare versuchte, eine falsche IP zu erreichen.

**Ursache:** Beim Domain-Kauf hatte Namecheap automatisch einen A-Record `smart-apply.io → 192.64.119.224` (Namecheap Parking Page) angelegt. Cloudflare hat diesen Record beim Site-Add übernommen.

**Fix:** Apex A-Record in Cloudflare DNS auf `135.225.56.134` umgestellt, Proxy 🟧 aktiviert.

**Lesson:** Nach Cloudflare-Onboarding **immer manuell die DNS-Records prüfen**. Cloudflare scannt den existierenden DNS-State und übernimmt ihn — inkl. Namecheap Parking, MX Records von alten Hostern, etc.

### 3.7 `www` CNAME-Loop / falsches Ziel

**Problem:** `https://www.smart-apply.io` lieferte intermittierend 522/525, obwohl Apex und API 200 zurückgaben — gleiche Cloudflare IPs, gleicher Origin-Cert, gleiches nginx.

**Ursache:** Der `www`-Record war als CNAME auf einen alten/falschen Wert gesetzt (vermutlich Namecheap-default). Cloudflares CNAME-Flattening löste in Edge-Cases auf eine falsche Origin-IP auf.

**Fix:** CNAME entfernt, durch direkten A-Record `www → 135.225.56.134` ersetzt.

**Lesson:** Bei Cloudflare ist ein A-Record für `www` robuster als ein CNAME-zu-Apex. CNAMEs auf der Apex selbst werden zwar geflattet, aber bei DNS-Drift entstehen subtile Bugs.

### 3.8 SSH-Permission-Denied (Key Discovery)

**Problem:** Der erste Versuch `ssh azureuser@<vm>` schlug mit "Permission denied (publickey)" fehl. Mein Tooling kannte den .pem-Pfad nicht, und der war an einem ungewöhnlichen Ort:

```
~/Desktop/Schreibtisch – Arianit's MacBook Pro/Wichtig!/SmartApply/smartapply-mvp-vm_key.pem
```

Mit Apostroph, `!`, Spaces, Umlauten — zsh's `setopt no_bang_hist` brauchte ich, um `!` zu escapen.

**Fix:** Schlüssel nach `~/.ssh/smartapply-vm.pem` kopiert, `chmod 600` gesetzt.

**Lesson:** SSH-Schlüssel gehören in `~/.ssh/` mit lesbaren Namen. Idealerweise via `~/.ssh/config` einen Host-Alias definieren:

```
Host smartapply-vm
    HostName smartapplymvp.swedencentral.cloudapp.azure.com
    User azureuser
    IdentityFile ~/.ssh/smartapply-vm.pem
```

Dann reicht `ssh smartapply-vm`.

### 3.9 GitHub PAT in Git Remote URL

**Problem:** Beim Setup hatte jemand vorher die VM mit einem Personal Access Token in der `git remote` URL eingerichtet:

```
origin  https://Ar1anit:github_pat_11AYT35CA0V8...@github.com/Ar1anit/smart-apply.git
```

Der Token war im VM-Filesystem (`.git/config`) klartext, plus jeder, der `git remote -v` ausführt, sieht ihn.

**Fix:** SSH-Deploy-Key generiert, Git-Remote auf SSH umgestellt:

```bash
git remote set-url origin git@github.com:Ar1anit/smart-apply.git
```

**Lesson:** **Nie** PATs in Git-URLs einbetten. Auf Servern: SSH Deploy Keys (per-Repo, scope-bar auf Read-only). Auf Devs: `git config credential.helper` + Keychain.

### 3.10 Repo-Drift zwischen lokal und VM

**Problem:** Nach dem ersten Versuch eines Pulls sah der VM-State so aus:

```
?? .npm-cache-hash
?? apps/api/prisma/schema.prisma:14   # ← buchstäblich ":14" im Filenamen
?? ecosystem.config.js                # ← PM2-Leftover
```

Der Schema-Datei mit `:14` im Namen war vermutlich ein Editor-Bug (jemand hat `schema.prisma:14` als Pfad-mit-Zeile interpretiert und auf "Save" geklickt).

**Fix:** Stray-Files mit `rm -f` entfernt vor `git reset --hard origin/main`.

**Lesson:** VM-Repo regelmäßig auf `git status` prüfen. CI/CD sollte `git clean -fd` vor jedem Pull machen.

### 3.11 Private Key in Chat geleaked

**Problem:** Bei der Cert-Übergabe wurde der **private** Key (PEM-Block) im Chat gepostet, statt nur den Cert.

**Risk Assessment:** Gering — Cloudflare Origin Certs werden nur akzeptiert, wenn die Verbindung von Cloudflare's Edge kommt (die signiert sie als Trusted Origin CA). Ein Angreifer kann mit dem Key allein keine MITM machen, weil er nicht aus Cloudflare's IP-Range stammt. Aber: gute Hygiene ist gute Hygiene.

**Mitigation:** Cert in 2-3 Wochen rotieren (siehe Runbook unten).

**Lesson:** Private Keys nie in Chat / Email / Slack / Code Reviews. Workflow: Datei lokal speichern, dann `scp` in Filesystem-Scope (oder kurzlebige paste services wie 1Password Secure Notes).

---

## 4. Reproduzierbarer Schritt-für-Schritt-Ablauf

Falls du diesen Vorgang für eine zweite Domain wiederholst, hier der gestraffte Ablauf:

### Phase 1 — Vorbereitung (5 min, lokal)

```bash
# 1. SSH-Key in ~/.ssh/ kopieren
cp /path/to/vm-key.pem ~/.ssh/smartapply-vm.pem
chmod 600 ~/.ssh/smartapply-vm.pem

# 2. SSH-Connectivity testen
ssh -i ~/.ssh/smartapply-vm.pem azureuser@<old-fqdn> 'curl -s ifconfig.me'
# → notiere die VM Public IP

# 3. SSH Deploy Key auf der VM erstellen
ssh -i ~/.ssh/smartapply-vm.pem azureuser@<old-fqdn> '
  ssh-keygen -t ed25519 -N "" -C "vm-deploy" -f ~/.ssh/github_deploy
  cat ~/.ssh/github_deploy.pub
'
# → Public Key in GitHub als Deploy Key (Read-only) hinterlegen
# → https://github.com/<owner>/<repo>/settings/keys/new

# 4. Git Remote auf SSH umstellen
ssh -i ~/.ssh/smartapply-vm.pem azureuser@<old-fqdn> '
  cd /path/to/repo
  git remote set-url origin git@github.com:<owner>/<repo>.git
  cat >> ~/.ssh/config <<EOF
  Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
EOF
  ssh-keyscan github.com >> ~/.ssh/known_hosts
  ssh -T git@github.com  # → Hi <user>! You'\''ve successfully authenticated
  git pull origin main
'
```

### Phase 2 — Cloudflare-Setup (10 min, im Browser)

1. Cloudflare → **Add a Site** → Domain eingeben → Free Plan
2. Nameserver bei Namecheap (oder Registrar) auf die zwei Cloudflare-NS umstellen
3. Warten auf "Cloudflare is now protecting your site" Email (5 min – 24 h)
4. **DNS Records** anlegen (alle 🟧 Proxied):

   | Type | Name | Content                |
   | ---- | ---- | ---------------------- |
   | A    | `@`  | `<vm-public-ip>`       |
   | A    | `api`| `<vm-public-ip>`       |
   | A    | `www`| `<vm-public-ip>`       |

5. **SSL/TLS → Overview → Configure** → **Full (strict)**
6. **SSL/TLS → Origin Server → Create Certificate** → RSA 2048, 15 Jahre, PEM
   - Cert + Key sofort in Passwortmanager speichern (Key wird nur einmal gezeigt!)

### Phase 3 — VM-Cutover (5 min, über SSH)

```bash
# 1. Origin Cert + Key per SCP auf die VM
scp -i ~/.ssh/smartapply-vm.pem cert.pem key.pem azureuser@<vm>:/tmp/

# 2. Cert + Key an die richtige Stelle, Permissions setzen
ssh -i ~/.ssh/smartapply-vm.pem azureuser@<vm> '
  sudo mkdir -p /etc/ssl/cloudflare
  sudo chmod 755 /etc/ssl/cloudflare
  sudo mv /tmp/cert.pem /etc/ssl/cloudflare/<domain>.pem
  sudo mv /tmp/key.pem /etc/ssl/cloudflare/<domain>.key
  sudo chmod 644 /etc/ssl/cloudflare/<domain>.pem
  sudo chmod 600 /etc/ssl/cloudflare/<domain>.key
  sudo chown root:root /etc/ssl/cloudflare/<domain>.*
'

# 3. Repo auf der VM aktualisieren + Installer ausführen
ssh -i ~/.ssh/smartapply-vm.pem azureuser@<vm> '
  cd /home/azureuser/smart-apply
  git pull origin main
  bash scripts/install-domain.sh <domain>
'

# 4. Local smoke test
for h in <domain> www.<domain> api.<domain>; do
  printf "%-30s: " "$h"
  curl -sI -o /dev/null -w "%{http_code}\n" https://$h
done
# Expect: <domain>=200, www=301, api=200 (or 404 on /, 200 on /api/v1/health)
```

### Phase 4 — GitHub Variables + Redeploy (3 min)

GitHub → Settings → Secrets and variables → Actions → **Variables**:

| Variable             | Wert                                    |
| -------------------- | --------------------------------------- |
| `VM_HOST`            | `<old-fqdn>` (für SSH)                  |
| `HEALTH_CHECK_HOST`  | `api.<domain>`                          |
| `PUBLIC_API_URL`     | `https://api.<domain>/api/v1`           |

Dann Trigger-Push oder Actions → Workflow → Run.

---

## 5. Operations Runbook

### Cert-Rotation (z.B. nach Leak, oder vor Ablauf)

```bash
# 1. Im Cloudflare Dashboard: SSL/TLS → Origin Server
#    → existierenden Cert finden → ⋯ → "Revoke"
#    → "Create Certificate" → neuen erstellen

# 2. Lokal speichern
cat > ~/Desktop/new-cert.pem  # paste cert, Ctrl-D
cat > ~/Desktop/new-key.pem   # paste key, Ctrl-D

# 3. Verifizieren dass Cert + Key zusammenpassen
CERT=$(openssl x509 -in ~/Desktop/new-cert.pem -noout -modulus | openssl md5)
KEY=$(openssl rsa -in ~/Desktop/new-key.pem -noout -modulus | openssl md5)
[ "$CERT" = "$KEY" ] && echo "✅ match" || echo "❌ NOT a pair"

# 4. Auf die VM
scp ~/Desktop/new-cert.pem ~/Desktop/new-key.pem azureuser@<vm>:/tmp/
ssh azureuser@<vm> '
  sudo mv /tmp/new-cert.pem /etc/ssl/cloudflare/smart-apply.io.pem
  sudo mv /tmp/new-key.pem  /etc/ssl/cloudflare/smart-apply.io.key
  sudo chown root:root /etc/ssl/cloudflare/smart-apply.io.*
  sudo chmod 644 /etc/ssl/cloudflare/smart-apply.io.pem
  sudo chmod 600 /etc/ssl/cloudflare/smart-apply.io.key
  sudo nginx -t && sudo systemctl reload nginx
'
# → Kein Container-Restart nötig, nginx reload reicht

# 5. Lokal testen
curl -sI https://smart-apply.io | head -3
```

### "Site ist down" — Diagnostik-Runbook

```bash
# 1. Cloudflare side: Edge erreichbar?
curl -sI https://smart-apply.io 2>&1 | head -3

# Codes interpretieren:
#   522 → Cloudflare kann VM nicht erreichen (firewall, VM down, falsche IP)
#   525 → SSL handshake fail (cert mismatch, abgelaufen)
#   502 → nginx läuft, aber Backend (3000/3001) ist down
#   521 → VM lehnt aktiv ab (UFW blockiert?)
#   524 → Origin antwortet nicht innerhalb 100s (LLM hangs?)

# 2. SSH zur VM
ssh -i ~/.ssh/smartapply-vm.pem azureuser@smartapplymvp.swedencentral.cloudapp.azure.com

# 3. Container-Status
docker ps --format "table {{.Names}}\t{{.Status}}"
# Alle drei sollten "(healthy)" sein

# 4. Direkt am Origin testen (umgeht Cloudflare)
curl -sI -H "Host: smart-apply.io" https://localhost --insecure | head -5
curl -sI -H "Host: api.smart-apply.io" https://localhost --insecure | head -5

# 5. nginx config test + Logs
sudo nginx -t
sudo tail -50 /var/log/nginx/error.log

# 6. Container Logs
docker logs smartapply-api --tail 50
docker logs smartapply-web --tail 50

# 7. Ports binden lokal?
sudo ss -tlnp | grep -E ":(80|443|3000|3001) "
# 80, 443 → nginx, 3000/3001 → docker-proxy (auf 127.0.0.1!)
```

### Komplettes Stack-Restart

```bash
ssh -i ~/.ssh/smartapply-vm.pem azureuser@<vm> '
  cd /home/azureuser/smart-apply
  docker-compose -f infra/docker-compose.prod.yml down --remove-orphans
  docker-compose -f infra/docker-compose.prod.yml up -d
  sleep 20
  docker ps --format "{{.Names}}\t{{.Status}}"
'
```

### Rollback auf alte Azure-FQDN

Funktioniert ohne weitere Änderungen, weil der Legacy-Server-Block in unserem nginx-Config aktiv bleibt:

```bash
# Visitor öffnet einfach https://smartapplymvp.swedencentral.cloudapp.azure.com
# → Wird über Let's Encrypt Cert (separat von Cloudflare) bedient
# → /api/v1/* → API container, alles andere → web container
```

Falls man den Frontend-Build zurückrollen will, GitHub Repo Variable `PUBLIC_API_URL` zurück auf die alte FQDN setzen + Deploy triggern.

---

## 6. Lessons Learned

### Architektur

1. **Reverse-Proxy gehört in den Repo.** Sonst ist die einzige Source of Truth ein einzelner Server, und niemand außer dir weiß, wie er konfiguriert ist.
2. **Optionale Integrationen müssen graceful degraden.** OAuth-Strategien, Email-Provider, LLMs, Sentry — alles muss `null` returnen + warnen können, ohne den Boot zu blockieren.
3. **Container-Ports auf `127.0.0.1` binden.** Sobald ein Reverse-Proxy davor steht, sind public-bound ports nur Angriffsfläche.
4. **Domain + Cert als Variable, nie hardcoded.** Sonst muss bei jedem Domain-Wechsel Code geändert werden.

### Workflow

5. **Vor jedem Cert-Upload `openssl modulus` Check.** Spart Stunden Debugging bei "525 SSL handshake fail".
6. **`docker-compose down --remove-orphans` als Standard-Restart-Pattern.** Verhindert Container-Konflikte nach manuellen `docker run`s.
7. **Cloudflare-Onboarding: DNS Records manuell prüfen.** Auto-Import übernimmt auch Namecheap-Parking, MX Records etc.
8. **A-Record für `www` ist robuster als CNAME-zu-Apex.** Cloudflare CNAME-Flattening hat Edge Cases.

### Sicherheit

9. **Nie Private Keys in Chat / Email.** Auch wenn Risk gering ist (z.B. Cloudflare Origin Cert), gute Hygiene rettet den Fall, wo der Key später für etwas Wichtigeres verwendet wird.
10. **Nie PATs in Git-URLs.** SSH Deploy Keys mit Read-only Scope sind der richtige Weg.
11. **`.gitignore` defensive halten.** `*.pem` reicht nicht — auch `*.pem.txt`, `*.key`, `*.key.txt` etc. Misbenamte Files sind die häufigste Leak-Quelle.
12. **Cloudflare Full (strict) Mode aktivieren.** Cloudflare ↔ Origin sollte immer mit validem, signiertem Cert laufen.

### Debugging

13. **HTTP Status Codes kennen.** 502 ≠ 522 ≠ 525 ≠ 521 ≠ 524 — jede sagt etwas anderes über den Layer-of-Failure aus (siehe Runbook oben).
14. **Origin direkt testen mit `curl -H "Host: ..." https://localhost`** umgeht Cloudflare und isoliert das Problem auf den Server.
15. **`sudo nginx -t` vor `systemctl reload`.** Sonst killst du nginx mit einem broken config und alles ist down.

---

## 7. Offene TODOs

- [ ] **GitHub PAT revoken** — `github_pat_11AYT35CA0V8...` (siehe Section 3.9). Settings → Developer settings → PATs.
- [ ] **Cloudflare Origin Cert in 2-3 Wochen rotieren** — der Key wurde im Chat geleaked (siehe Section 3.11). Runbook oben.
- [ ] **Email-Domain bei Resend verifizieren** (`smart-apply.io`) — DNS-Records (SPF/DKIM/DMARC) bei Cloudflare anlegen, sobald Resend-Account existiert.
- [ ] **Cloudflare Email Routing aktivieren** für `support@smart-apply.io` → Forward auf private Inbox.
- [ ] **Sentry Setup** — DSN für Web + API anlegen, in Repo Variables/Secrets ablegen.
- [ ] **Cloudflare Turnstile** site key + secret für Signup-Formular.
- [ ] **Azure OpenAI Credentials** auf der VM in `apps/api/.env` setzen + `LLM_PROVIDER=azure-openai`.
- [ ] **Legal Pages befüllen** — `[BITTE EINFÜGEN]` Platzhalter in Impressum, Datenschutz, AGB.
- [ ] **Legacy Azure-FQDN-Server-Block in nginx in 2 Wochen entfernen**, sobald wir sicher sind, dass keine Bookmarks / Emails mehr darauf zeigen.
- [ ] **`scripts/install-domain.sh` polishen** — der interaktive Cert-Paste-Prompt funktioniert nicht in zsh-Heredoc-Setups; entweder durch ein Flag `--cert-from /path` oder durch File-Detection vor dem Prompt.

---

## Referenz

- [Cloudflare Origin CA — docs](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
- [Cloudflare SSL/TLS encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)
- [Cloudflare IP Ranges (für nginx `set_real_ip_from`)](https://www.cloudflare.com/ips/)
- [nginx `http2` direktive change log](https://nginx.org/en/docs/http/ngx_http_v2_module.html)
- Repo: [`infra/nginx/smart-apply.conf`](../../infra/nginx/smart-apply.conf), [`scripts/install-domain.sh`](../../scripts/install-domain.sh)
