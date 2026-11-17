# GeoProno

Les paris de l'école en pièces virtuelles : matchs, baby-foot, et tous les paris que les élèves proposent.

- **Comptes** avec email de l'école (domaine restreint), historique des paris et de tous les mouvements de pièces.
- **Argent virtuel** : bonus à l'inscription ; chaque matin (7 h, heure de Paris, réglable), les soldes sous le seuil (1000) remontent au seuil.
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

## Déploiement (GitHub Actions + Portainer)

1. Pousse le dépôt sur GitHub. À chaque push sur `main`, le workflow vérifie l'API (migrations sur un vrai Postgres, typecheck, tests) et le front, puis publie
   `ghcr.io/<owner>/geoprono-api` et `ghcr.io/<owner>/geoprono-web` (tags `latest` et SHA).
2. Si les packages GHCR sont privés, ajoute le registre `ghcr.io` dans Portainer (Registries) avec un token GitHub `read:packages`, ou rends les packages publics.
3. Dans Portainer : **Stacks → Add stack → Repository**, chemin `deploy/portainer-stack.yml`, et ces variables :

   | Variable | Exemple |
   |---|---|
   | `GHCR_OWNER` | ton pseudo GitHub en minuscules |
   | `POSTGRES_PASSWORD` | mot de passe long aléatoire |
   | `JWT_SECRET` | 32+ caractères aléatoires (`openssl rand -hex 32`) |
   | `ALLOWED_EMAIL_DOMAINS` | `ecole.fr,etu.ecole.fr` |
   | `ADMIN_EMAILS` | `toi@ecole.fr` |
   | `WEB_PORT` | `8080` (à mettre derrière ton reverse proxy HTTPS) |
   | `COOKIE_SECURE` | `true` en HTTPS, `false` seulement en HTTP simple |

4. Active **GitOps updates → Webhook** avec « Re-pull image and redeploy », copie l'URL du webhook dans le secret GitHub `PORTAINER_WEBHOOK_URL` (environnement `production`). Chaque push sur `main` redéploie alors automatiquement.

Les migrations Prisma s'appliquent au démarrage du conteneur API.

## Design

Direction « Tableau du gymnase » (bleu, doré, noir), choisie avec la skill [Impeccable](https://github.com/pbakaus/impeccable) : contexte produit dans `PRODUCT.md`, contrat de direction dans `.impeccable/surfaces/`, système visuel dans `DESIGN.md`.
