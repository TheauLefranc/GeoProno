# GeoProno

Les paris de l'école en GeoPuntos, la monnaie virtuelle du site : matchs, baby-foot, et tous les paris que les élèves proposent.

- **Comptes** avec email de l'école (domaine restreint), historique des paris et de tous les mouvements de GeoPuntos.
- **Argent virtuel** : bonus à l'inscription ; chaque matin (7 h, heure de Paris, réglable), les soldes sous le seuil (100 GeoPuntos) remontent au seuil.
- **Propositions** : n'importe qui propose un pari ; il ouvre quand il atteint le nombre de votes requis (10 par défaut). Les modérateurs peuvent l'ouvrir directement ou le refuser.
- **Cotes activables** : par pari, cotes fixes (gain = mise × cote, verrouillée au moment de la mise, ajustable par les modérateurs) ou cagnotte partagée entre les gagnants. Les admins peuvent couper les cotes pour tout le site.
- **Groupes** : création, code d'invitation, défis privés (votes = moitié du groupe, résultat saisi par le créateur), classement du groupe.
- **Classement général** au bénéfice net sur les paris publics réglés (7 j / 30 j / tout). Les recharges ne comptent pas.
- **Admin** : règles du jeu, rôles, ajustement de solde, recharge manuelle.

## Stack

| Dossier | Contenu |
|---|---|
| `server/` | API Node 22 / Express 5 / TypeScript, Prisma 6, PostgreSQL 17, tâche de recharge (node-cron) |
| `web/` | React 19 + Vite, TanStack Query, React Router ; servi par nginx qui proxifie `/api` |
| `deploy/portainer-stack.yml` | Stack de production (images GHCR) |
| `.github/workflows/ci-cd.yml` | Tests → images GHCR → webhook Portainer |

## Développement local

```bash
# Postgres
docker run -d --name geoprono-pg-dev -e POSTGRES_USER=geoprono -e POSTGRES_PASSWORD=geoprono -e POSTGRES_DB=geoprono -p 5433:5432 postgres:17-alpine

# API
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed        # données de démo FICTIVES, mot de passe « motdepasse »
npm run dev            # http://localhost:3000

# Front (autre terminal)
cd web
npm install
npm run dev            # http://localhost:5173
```

Le tout premier compte créé devient admin (ainsi que les emails listés dans `ADMIN_EMAILS`).

Tout en Docker : `docker compose up --build` puis http://localhost:8080.

Tests : `cd server && npm test` (calcul des gains, cagnotte, recharge, fuseau horaire).

## Déploiement (GitHub public → GHCR → Portainer)

Dépôt GitHub public + images publiques sur GHCR : Portainer n'a besoin d'aucune authentification.

1. **Pousse le dépôt sur GitHub (public)**. À chaque push sur `main`, le workflow vérifie l'API (migrations sur un vrai Postgres, typecheck, tests) et le front, puis publie
   `ghcr.io/<owner>/geoprono-api` et `ghcr.io/<owner>/geoprono-web` (tags `latest` et SHA). Aucun secret à créer pour ça : la CI utilise le `GITHUB_TOKEN` intégré.
2. **Rends les images publiques (une seule fois, après le premier passage de la CI)** : ton profil GitHub → *Packages* → `geoprono-api` → *Package settings* → *Change visibility* → **Public**. Pareil pour `geoprono-web`.
3. **Portainer** → Stacks → Add stack → **Repository** : URL du dépôt, référence `refs/heads/main`, compose path `deploy/portainer-stack.yml`, authentification désactivée, et ces variables :

   | Variable | Exemple |
   |---|---|
   | `GHCR_OWNER` | ton pseudo GitHub en minuscules |
   | `POSTGRES_PASSWORD` | mot de passe long aléatoire |
   | `JWT_SECRET` | 32+ caractères aléatoires (`openssl rand -hex 32`) |
   | `ALLOWED_EMAIL_DOMAINS` | `ecole.fr,etu.ecole.fr` |
   | `ADMIN_EMAILS` | `toi@ecole.fr` |
   | `WEB_PORT` | `8087` par défaut : n'importe quel port libre du serveur |
   | `WEB_BIND` | `127.0.0.1` si un reverse proxy tourne sur la même machine (sinon laisse vide) |
   | `COOKIE_SECURE` | laisse vide (`auto` : cookie sécurisé seulement quand le site est en HTTPS) |

   Seul `WEB_PORT` est ouvert sur le serveur : Postgres et l'API restent sur le réseau privé de la stack, donc aucun conflit possible avec tes autres services (même s'ils utilisent 5432 ou 3000).

4. **Redéploiement automatique** : dans la stack, active *GitOps updates* → **Webhook** et coche « Re-pull image ». Copie l'URL du webhook dans GitHub → Settings → Secrets and variables → Actions → secret `PORTAINER_WEBHOOK_URL` (environnement `production`). Chaque push sur `main` redéploie alors tout seul ; sans ce secret, l'étape est simplement sautée.

Rien de secret n'est dans le code ni dans les images : mots de passe et clés sont des variables de la stack Portainer. Ne commite jamais de fichier `.env`.

Les migrations Prisma s'appliquent au démarrage du conteneur API.

## Design

Direction « Tableau du gymnase » (bleu, doré, noir), choisie avec la skill [Impeccable](https://github.com/pbakaus/impeccable) : contexte produit dans `PRODUCT.md`, contrat de direction dans `.impeccable/surfaces/`, système visuel dans `DESIGN.md`.
