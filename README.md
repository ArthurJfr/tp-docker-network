# TP Infrastructure Docker

Infrastructure complète de déploiement avec Docker Compose incluant une API Express, PostgreSQL, Redis, Traefik comme reverse proxy, et une stack de monitoring avec Prometheus et Grafana.

## 📋 Table des matières

- [Description](#description)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Démarrage](#démarrage)
- [Services disponibles](#services-disponibles)
- [Structure du projet](#structure-du-projet)
- [Commandes utiles](#commandes-utiles)
- [Dépannage](#dépannage)

## 🎯 Description

Ce projet implémente une infrastructure complète de déploiement avec :

- **API Express** : Application Node.js avec métriques Prometheus
- **PostgreSQL** : Base de données relationnelle
- **Redis** : Cache applicatif
- **Traefik** : Reverse proxy avec routage automatique
- **Prometheus** : Collecte et stockage des métriques
- **Grafana** : Visualisation des métriques et dashboards
- **cAdvisor** : Métriques des conteneurs Docker

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         RÉSEAU FRONTEND                     │
│  ┌──────────┐         ┌──────────┐          │
│  │ Traefik  │─────────│   API    │          │
│  │ (proxy)  │         │          │          │
│  └──────────┘         └─────┬────┘          │
└─────────────────────────────┼───────────────┘
                              │
┌─────────────────────────────┼───────────────┐
│      RÉSEAU BACKEND         │               │
│                              │               │
│  ┌──────────┐      ┌────────▼────┐ ┌──────┐ │
│  │PostgreSQL│      │    API      │ │Redis │ │
│  └──────────┘      └─────────────┘ └──────┘ │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         RÉSEAU MONITORING                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Prometheus│  │  Grafana │  │ cAdvisor │   │
│  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────┘
```

### Flux de communication

```
Internet → Traefik (frontend) → API (frontend + backend) → PostgreSQL/Redis (backend)
                                                          ↓
                                                    Prometheus (backend + monitoring)
```

## 📦 Prérequis

- **macOS** (version récente) ou Linux
- **Docker Desktop** installé et démarré
- **Docker Compose** v2.x
- Accès internet pour télécharger les images Docker

### Vérification

```bash
docker --version
docker compose version
docker ps  # Vérifie que Docker fonctionne
```

## 🚀 Installation

1. **Cloner ou naviguer dans le projet** :
```bash
cd /Users/jd/dev/local/projects/tp-docker
```

2. **Vérifier la structure** :
```bash
ls -la
# Vous devriez voir : app/, traefik/, prometheus/, docker-compose.yml
```

## ▶️ Démarrage

### Démarrage complet de la stack

```bash
# Construire et démarrer tous les services
docker compose up -d --build

# Vérifier l'état des services
docker compose ps

# Voir les logs
docker compose logs -f
```

### Démarrage étape par étape

```bash
# 1. Démarrer les services backend (DB, Redis)
docker compose up -d postgres redis

# 2. Attendre que les healthchecks passent
docker compose ps

# 3. Démarrer l'API
docker compose up -d api

# 4. Démarrer Traefik
docker compose up -d traefik

# 5. Démarrer le monitoring
docker compose up -d prometheus grafana cadvisor
```

## 🌐 Services disponibles

| Service | URL | Description | Identifiants |
|---------|-----|-------------|--------------|
| **API** | http://api.localhost | API Express | - |
| **Traefik Dashboard** | http://localhost:8080 | Dashboard Traefik | - |
| **Prometheus** | http://localhost:9090 | Interface Prometheus | - |
| **Grafana** | http://localhost:3000 | Dashboards Grafana | admin / admin123 |
| **cAdvisor** | http://localhost:8081 | Métriques conteneurs | - |

### Endpoints de l'API

- `GET /health` - Health check
- `GET /api/data` - Données avec cache Redis
- `GET /metrics` - Métriques Prometheus

### Exemples de requêtes

```bash
# Health check
curl http://api.localhost/health

# Données (première requête = DB, suivantes = cache)
curl http://api.localhost/api/data

# Métriques Prometheus
curl http://api.localhost/metrics
```

## 📁 Structure du projet

```
tp-docker/
├── app/                    # Application Express
│   ├── app.js             # Code de l'API
│   ├── package.json       # Dépendances Node.js
│   └── Dockerfile         # Image Docker de l'API
│
├── traefik/               # Configuration Traefik
│   └── traefik.yml       # Configuration Traefik
│
├── prometheus/            # Configuration Prometheus
│   ├── prometheus.yml     # Configuration Prometheus
│   └── alert.rules.yml    # Règles d'alerte
│
├── grafana/               # Configuration Grafana
│   └── provisioning/      # Dashboards provisionnés
│
├── docker-compose.yml    # Configuration Docker Compose
├── TP-Infrastructure-Docker.md  # Énoncé du TP
└── REVISION-QCM-RESEAU.md       # Révision réseau
```

## 🛠️ Commandes utiles

### Gestion des services

```bash
# Démarrer tous les services
docker compose up -d

# Arrêter tous les services
docker compose down

# Redémarrer un service spécifique
docker compose restart api

# Voir les logs d'un service
docker compose logs -f api

# Reconstruire un service après modification
docker compose up -d --build api
```

### Inspection et debug

```bash
# État des conteneurs
docker compose ps

# Logs de tous les services
docker compose logs

# Logs en temps réel
docker compose logs -f

# Inspecter un réseau
docker network inspect tp-docker_frontend

# Tester la connectivité
docker exec -it traefik ping api
docker exec -it traefik nslookup api

# Accéder à un conteneur
docker exec -it api sh
docker exec -it postgres psql -U appuser -d appdb
```

### Nettoyage

```bash
# Arrêter et supprimer les conteneurs (garder les volumes)
docker compose down

# Arrêter et supprimer tout (conteneurs + volumes)
docker compose down -v

# Supprimer les images non utilisées
docker image prune -a
```

## 🔧 Configuration

### Variables d'environnement

Les variables sont définies dans `docker-compose.yml` :

- **PostgreSQL** : `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- **API** : `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `REDIS_HOST`
- **Grafana** : `GF_SECURITY_ADMIN_USER`, `GF_SECURITY_ADMIN_PASSWORD`

### Réseaux Docker

Le projet utilise 3 réseaux :

- **frontend** : Traefik, API (point d'entrée)
- **backend** : PostgreSQL, Redis, API, Prometheus (services internes)
- **monitoring** : Prometheus, Grafana, cAdvisor (supervision)

## 📊 Monitoring

### Configuration Grafana

1. Accéder à http://localhost:3000
2. Se connecter : `admin` / `admin123`
3. Ajouter Prometheus comme data source :
   - URL : `http://prometheus:9090`
   - Save & Test

### Dashboards disponibles

- **cAdvisor** : Dashboard ID `14282` (métriques conteneurs)
- **API personnalisé** : Créer avec les métriques `app_requests_total`, `app_request_latency_seconds`

### Métriques Prometheus

- `app_requests_total` : Nombre total de requêtes
- `app_request_latency_seconds` : Latence des requêtes
- Métriques cAdvisor : CPU, mémoire, réseau des conteneurs

## 🐛 Dépannage

### L'API ne répond pas

```bash
# Vérifier que l'API est démarrée
docker compose ps api

# Vérifier les logs
docker compose logs api

# Tester depuis Traefik
docker exec -it traefik wget -qO- http://api:5000/health

# Vérifier la résolution DNS
docker exec -it traefik nslookup api
```

### Problème de connexion à PostgreSQL

```bash
# Vérifier que PostgreSQL est démarré et healthy
docker compose ps postgres

# Tester la connexion
docker exec -it postgres psql -U appuser -d appdb -c "SELECT 1;"

# Vérifier les logs
docker compose logs postgres
```

### Problème de port déjà utilisé

```bash
# Vérifier les ports utilisés
lsof -i :80
lsof -i :3000
lsof -i :9090

# Arrêter le service qui utilise le port ou modifier le port dans docker-compose.yml
```

### Réinitialiser complètement

```bash
# Arrêter et supprimer tout
docker compose down -v

# Supprimer les images
docker image rm tp-docker-api

# Redémarrer
docker compose up -d --build
```

## 📚 Documentation

- **TP complet** : Voir `TP-Infrastructure-Docker.md`
- **Révision réseau** : Voir `REVISION-QCM-RESEAU.md`
- **Documentation Docker** : https://docs.docker.com/
- **Documentation Traefik** : https://doc.traefik.io/traefik/
- **Documentation Prometheus** : https://prometheus.io/docs/

## 🎓 Objectifs pédagogiques

Ce projet permet de :

- ✅ Comprendre les réseaux Docker (bridge, isolation, DNS)
- ✅ Configurer un reverse proxy avec Traefik
- ✅ Implémenter une stack de monitoring complète
- ✅ Débugger des problèmes réseau dans Docker
- ✅ Comprendre l'architecture multi-conteneurs

## 📝 Notes

- **Développement local** : HTTPS désactivé pour simplifier (certificats auto-signés disponibles)
- **Production** : Activer HTTPS avec Let's Encrypt (voir `traefik/traefik.yml`)
- **Secrets** : En production, utiliser Docker Secrets ou un gestionnaire de secrets (Vault)

## 🤝 Contribution

Ce projet fait partie d'un TP pédagogique. Pour toute question ou amélioration, référez-vous à l'énoncé du TP dans `TP-Infrastructure-Docker.md`.

---

**Bon TP ! 🚀**
