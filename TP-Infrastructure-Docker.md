# TP Infrastructure Docker - Bac+4

## Partie 1 : Contexte et objectifs

### 1.1 Scénario

Vous rejoignez une startup en tant que développeur fullstack. L'équipe a développé une API en Node.js (Express) qui fonctionne en local. Votre mission : mettre en place l'infrastructure de déploiement complète, de la conteneurisation jusqu'au monitoring.

L'infrastructure doit être reproductible, documentée, et prête pour un environnement de staging.

### 1.2 Objectifs pédagogiques

À l'issue de ce TP, vous serez capable de :

- Concevoir une architecture multi-conteneurs avec Docker Compose
- Configurer un reverse proxy Traefik avec terminaison TLS
- Comprendre les réseaux Docker (bridge, isolation, résolution DNS)
- Implémenter une stack de monitoring (Prometheus, Grafana)
- Débugger des problèmes réseau dans un environnement conteneurisé

### 1.3 Stack technique

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Reverse Proxy | Traefik | Point d'entrée, TLS, routage automatique |
| Application | Express (Node.js) | API REST + métriques Prometheus |
| Base de données | PostgreSQL | Persistance des données |
| Cache | Redis | Cache applicatif, sessions |
| Métriques | Prometheus | Collecte et stockage des métriques |
| Visualisation | Grafana | Dashboards de supervision |
| Conteneurs | cAdvisor | Métriques des conteneurs Docker |

### 1.4 Prérequis

Configuration minimale :

- macOS (version récente)
- Docker Desktop installé et démarré
- Accès internet pour télécharger les images Docker
- Terminal (Terminal.app ou iTerm2)

💡 **Installation de Docker Desktop** : Si Docker Desktop n'est pas encore installé, téléchargez-le depuis https://www.docker.com/products/docker-desktop/ et suivez les instructions d'installation. Assurez-vous que Docker Desktop est démarré avant de commencer le TP.

---

## Partie 2 : Fondations Docker et réseau

### 2.1 Vérification de l'installation Docker

Avant de commencer, vérifiez que Docker Desktop est bien installé et fonctionnel :

```bash
# Vérifier la version de Docker
docker --version

# Vérifier que Docker Compose est disponible
docker compose version

# Vérifier que Docker fonctionne
docker ps
```

Si Docker Desktop n'est pas démarré, lancez-le depuis les Applications macOS.

### 2.2 Comprendre les réseaux Docker

Avant de construire notre stack, explorons le fonctionnement des réseaux Docker.

❓ **Exécutez `docker network ls`. Quels réseaux existent par défaut ? Quel est le rôle de chacun ?**

**Réponse :**

Par défaut, Docker crée trois réseaux :

1. **`bridge`** (réseau par défaut) :
   - C'est le réseau par défaut utilisé par les conteneurs Docker si aucun réseau n'est spécifié
   - Les conteneurs sur ce réseau peuvent communiquer entre eux via leurs adresses IP
   - Les conteneurs sont isolés de l'hôte par défaut, mais peuvent accéder à l'extérieur via NAT
   - Chaque conteneur obtient une adresse IP privée dans la plage 172.17.0.0/16

2. **`host`** :
   - Les conteneurs utilisent directement la pile réseau de l'hôte
   - Pas d'isolation réseau entre le conteneur et l'hôte
   - Les conteneurs partagent l'interface réseau de l'hôte
   - Utile pour des performances maximales, mais moins sécurisé

3. **`none`** :
   - Le conteneur n'a aucune connectivité réseau
   - Aucune interface réseau n'est attachée au conteneur
   - Utile pour des cas d'usage très spécifiques nécessitant une isolation complète

💡 **Note** : Sur macOS avec Docker Desktop, vous verrez également un réseau `docker_gwbridge` utilisé par Docker Desktop pour la connectivité.

Créez un réseau bridge personnalisé :

```bash
docker network create --driver bridge tp-network
docker network inspect tp-network
```

❓ **Quelle plage d'adresses IP a été attribuée à ce réseau ? Quelle est l'adresse de la gateway ?**

**Réponse :**

D'après la sortie de `docker network inspect tp-network`, on peut voir dans la section `IPAM.Config` :

- **Plage d'adresses IP (Subnet)** : `172.25.0.0/16`
  - Cela signifie que le réseau peut accueillir jusqu'à 65 536 adresses IP (de 172.25.0.0 à 172.25.255.255)
  - Le masque `/16` indique que les 16 premiers bits sont utilisés pour identifier le réseau

- **Adresse de la gateway** : `172.25.0.1`
  - C'est l'adresse IP de la passerelle par défaut du réseau
  - Les conteneurs utilisent cette adresse pour accéder à l'extérieur du réseau (via NAT)
  - Cette adresse est généralement la première adresse utilisable du sous-réseau

💡 **Note** : Docker choisit automatiquement une plage d'adresses disponible qui ne chevauche pas avec les réseaux existants. Dans cet exemple, Docker a choisi `172.25.0.0/16` car le réseau bridge par défaut utilise généralement `172.17.0.0/16`.

Testons la résolution DNS interne de Docker :

```bash
# Lancez deux conteneurs sur le même réseau
docker run -d --name test-server --network tp-network nginx:alpine
docker run -it --rm --network tp-network alpine sh

# Dans le conteneur alpine :
ping -c 3 test-server
nslookup test-server
```

❓ **Comment Docker résout-il le nom 'test-server' ? Quel serveur DNS est utilisé ?**

**Réponse :**

D'après les résultats de `nslookup test-server` dans le conteneur alpine, on peut observer :

1. **Serveur DNS utilisé** : `127.0.0.11:53`
   - C'est le serveur DNS intégré de Docker qui s'exécute dans chaque conteneur
   - L'adresse `127.0.0.11` est une adresse IP locale spéciale utilisée uniquement par Docker
   - Ce serveur DNS est automatiquement configuré dans chaque conteneur via `/etc/resolv.conf`

2. **Résolution du nom** :
   - Le nom `test-server` est résolu vers l'adresse IP `172.25.0.2`
   - Cette adresse correspond au conteneur `test-server` sur le réseau `tp-network`
   - Le ping confirme que la résolution fonctionne : `PING test-server (172.25.0.2)`

3. **Fonctionnement** :
   - Docker maintient automatiquement une table de correspondance entre les noms de conteneurs et leurs adresses IP
   - Quand un conteneur fait une requête DNS pour un nom de conteneur sur le même réseau, le serveur DNS Docker (127.0.0.11) répond avec l'adresse IP correspondante
   - Cela permet aux services de communiquer entre eux en utilisant leurs noms plutôt que leurs adresses IP, ce qui simplifie grandement la configuration

💡 **Avantages** : Cette approche permet une communication par nom de service, ce qui est plus maintenable et résilient. Si un conteneur redémarre et obtient une nouvelle adresse IP, les autres conteneurs peuvent toujours le joindre via son nom.

Nettoyage :

```bash
docker stop test-server && docker rm test-server
docker network rm tp-network
```

---

## Partie 3 : Déploiement de l'application

### 3.1 Structure du projet

Créez l'arborescence suivante :

```bash
mkdir -p ~/tp-docker/{app,traefik,prometheus,grafana}
cd ~/tp-docker
```

### 3.2 Code de l'API Express

Créez le fichier `app/app.js` :

```javascript
const express = require('express');
const redis = require('redis');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();

// Métriques Prometheus
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const REQUEST_COUNT = new client.Counter({
  name: 'app_requests_total',
  help: 'Total requests',
  labelNames: ['endpoint', 'method'],
  registers: [register]
});

const REQUEST_LATENCY = new client.Histogram({
  name: 'app_request_latency_seconds',
  help: 'Request latency',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Connexion Redis
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'redis',
  port: 6379
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

// Connexion PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  port: 5432
});

app.get('/health', (req, res) => {
  REQUEST_COUNT.inc({ endpoint: '/health', method: 'GET' });
  res.json({ status: 'healthy' });
});

app.get('/api/data', async (req, res) => {
  const startTime = Date.now();
  REQUEST_COUNT.inc({ endpoint: '/api/data', method: 'GET' });
  
  try {
    // Tentative cache Redis
    const cached = await redisClient.get('data_cache');
    if (cached) {
      const latency = (Date.now() - startTime) / 1000;
      REQUEST_LATENCY.observe({ endpoint: '/api/data' }, latency);
      return res.json({ data: cached, source: 'cache' });
    }
    
    // Sinon, requête DB
    const result = await pool.query('SELECT NOW()');
    const data = result.rows[0].now.toString();
    
    // Mise en cache (60s)
    await redisClient.setEx('data_cache', 60, data);
    
    const latency = (Date.now() - startTime) / 1000;
    REQUEST_LATENCY.observe({ endpoint: '/api/data' }, latency);
    res.json({ data, source: 'database' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 3.3 Dockerfile de l'application

Créez le fichier `app/Dockerfile` :

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY app.js .

EXPOSE 5000

CMD ["node", "app.js"]
```

Créez le fichier `app/package.json` :

```json
{
  "name": "tp-api",
  "version": "1.0.0",
  "description": "API Express avec métriques Prometheus",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.10",
    "pg": "^8.11.3",
    "prom-client": "^15.1.0"
  }
}
```

❓ **Analysez le Dockerfile. Pourquoi utilise-t-on `npm ci` au lieu de `npm install` ? Quelle est la différence entre `npm ci` et `npm install` ?**

**Réponse :**

`npm ci` (Clean Install) est utilisé dans les environnements de production et de build pour plusieurs raisons importantes :

1. **Reproductibilité** :
   - `npm ci` lit directement le fichier `package-lock.json` (ou `npm-shrinkwrap.json`) et installe exactement les versions spécifiées
   - Il supprime automatiquement le dossier `node_modules` avant l'installation pour garantir un état propre
   - `npm install` peut modifier le `package-lock.json` si des versions compatibles sont trouvées, ce qui peut introduire des différences entre les builds

2. **Performance** :
   - `npm ci` est généralement plus rapide que `npm install` car il saute certaines vérifications et optimisations
   - Il est optimisé pour les environnements CI/CD où la reproductibilité est cruciale

3. **Sécurité et stabilité** :
   - `npm ci` échoue si le `package-lock.json` est incompatible avec `package.json`, ce qui évite les installations incohérentes
   - Il garantit que tous les développeurs et les environnements de déploiement utilisent exactement les mêmes versions de dépendances

4. **Dans Docker** :
   - L'option `--only=production` installe uniquement les dépendances de production (pas les `devDependencies`)
   - Cela réduit la taille de l'image Docker et améliore la sécurité en excluant les outils de développement

💡 **Règle générale** : Utilisez `npm install` en développement local pour mettre à jour les dépendances, et `npm ci` dans les Dockerfiles, CI/CD et production pour garantir la reproductibilité.

### 3.4 Docker Compose - Stack applicative

Créez le fichier `docker-compose.yml` à la racine du projet :

```yaml
services:
  # Base de données PostgreSQL
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: apppassword
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Cache Redis
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Application Express
  api:
    build: ./app
    container_name: api
    restart: unless-stopped
    environment:
      DB_HOST: postgres
      DB_NAME: appdb
      DB_USER: appuser
      DB_PASSWORD: apppassword
      REDIS_HOST: redis
    networks:
      - backend
      - frontend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge

volumes:
  postgres-data:
```

❓ **Pourquoi l'API est-elle connectée à deux réseaux (frontend et backend) alors que PostgreSQL et Redis ne sont que sur backend ?**

**Réponse :**

L'API est connectée à deux réseaux pour respecter le principe de **séparation des responsabilités** et améliorer la **sécurité** :

1. **Réseau `backend`** :
   - Contient les services internes : PostgreSQL, Redis et l'API
   - Ces services doivent communiquer entre eux (API → PostgreSQL, API → Redis)
   - Ce réseau est **privé** et n'est pas exposé directement à l'extérieur
   - PostgreSQL et Redis n'ont pas besoin d'accéder au frontend, donc ils restent uniquement sur `backend`

2. **Réseau `frontend`** :
   - Contiendra le reverse proxy Traefik (qui sera ajouté dans la partie 4)
   - L'API doit être accessible depuis Traefik pour recevoir les requêtes HTTP/HTTPS
   - Ce réseau sert de **point d'entrée** pour le trafic externe

3. **Avantages de cette architecture** :
   - **Isolation** : PostgreSQL et Redis ne sont jamais exposés directement au trafic externe, même via Traefik
   - **Sécurité** : Seule l'API peut communiquer avec les services backend, réduisant la surface d'attaque
   - **Séparation des couches** : Frontend (Traefik) ↔ API ↔ Backend (DB, Cache)
   - **Scalabilité** : On peut facilement ajouter plusieurs instances de l'API sur le réseau frontend sans exposer les services backend

💡 **Schéma de communication** :
```
Internet → Traefik (frontend) → API (frontend + backend) → PostgreSQL/Redis (backend uniquement)
```

🎯 **Challenge**

Dessinez un schéma montrant quels conteneurs peuvent communiquer entre eux. Quels services sont isolés ?

### 3.5 Premier déploiement

Construisez et lancez la stack :

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

Testez l'API :

```bash
curl http://localhost:5001/health
curl http://localhost:5001/api/data
# Relancez plusieurs fois pour voir le cache
curl http://localhost:5001/api/data
```

💡 **Note** : Le port 5001 est utilisé temporairement car le port 5000 est déjà occupé. Ce port sera retiré dans la partie 4 lorsque Traefik sera configuré.

❓ **Observez la différence entre 'source: database' et 'source: cache'. Combien de temps le cache est-il valide ?**

**Réponse :**

Lors des tests avec `curl http://localhost:5001/api/data`, on observe deux comportements différents :

1. **Première requête** : `"source": "database"`
   - L'API vérifie d'abord le cache Redis
   - Le cache est vide (première requête)
   - L'API interroge PostgreSQL pour obtenir `SELECT NOW()`
   - Le résultat est mis en cache dans Redis avec `setEx('data_cache', 60, data)`
   - La réponse indique `"source": "database"`

2. **Requêtes suivantes (dans les 60 secondes)** : `"source": "cache"`
   - L'API trouve les données dans le cache Redis
   - Pas besoin d'interroger PostgreSQL
   - Réponse beaucoup plus rapide
   - La réponse indique `"source": "cache"`

3. **Durée de validité du cache** : **60 secondes**
   - Le code utilise `redisClient.setEx('data_cache', 60, data)`
   - `setEx` définit une clé avec expiration automatique après 60 secondes
   - Après 60 secondes, le cache expire et la prochaine requête retournera à `"source": "database"`

4. **Avantages du cache** :
   - **Performance** : Les requêtes depuis le cache sont beaucoup plus rapides (pas d'accès disque DB)
   - **Réduction de charge** : Moins de requêtes sur PostgreSQL
   - **Scalabilité** : Redis peut gérer beaucoup plus de requêtes simultanées que PostgreSQL

💡 **Test pour vérifier** :
```bash
# Première requête (cache vide)
curl http://localhost:5001/api/data
# Réponse : {"data":"...","source":"database"}

# Requêtes immédiates (cache valide)
curl http://localhost:5001/api/data
curl http://localhost:5001/api/data
# Réponse : {"data":"...","source":"cache"}

# Attendre 60 secondes puis relancer
sleep 60
curl http://localhost:5001/api/data
# Réponse : {"data":"...","source":"database"} (nouveau cache créé)
```

⚠️ Si l'API ne démarre pas, vérifiez les logs avec `docker compose logs api`. Les erreurs de connexion sont souvent liées au healthcheck qui n'est pas encore passé.

---

## Partie 4 : Reverse Proxy Traefik

### 4.1 Pourquoi un reverse proxy ?

En production, on n'expose jamais directement une application. Le reverse proxy apporte :

- Terminaison TLS (HTTPS)
- Load balancing entre plusieurs instances
- Découverte automatique des services (service discovery)
- Protection contre certaines attaques (rate limiting, headers)
- Routage par nom de domaine (virtual hosts)
- Dashboard de monitoring intégré

### 4.2 Configuration Traefik

Traefik utilise une approche différente de Nginx : la configuration se fait via des **labels Docker** plutôt que des fichiers de configuration. Cela permet une configuration déclarative et automatique.

Créez le fichier `traefik/traefik.yml` :

```yaml
api:
  dashboard: true
  insecure: true  # Pour le développement uniquement

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: frontend

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com  # À remplacer par votre email
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

❓ **Pourquoi Traefik utilise-t-il des labels Docker plutôt que des fichiers de configuration ? Quels sont les avantages de cette approche ?**

### 4.3 Ajout de Traefik au Compose

Ajoutez le service Traefik dans `docker-compose.yml` (dans la section `services`) :

```yaml
  # Reverse Proxy Traefik
  traefik:
    image: traefik:v2.11
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=frontend"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard Traefik
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik.yml:ro
      - traefik-certs:/letsencrypt
    networks:
      - frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.localhost`)"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.tls=true"
```

Maintenant, ajoutez les labels Traefik au service `api` pour le rendre accessible via Traefik :

```yaml
  # Application Express
  api:
    build: ./app
    container_name: api
    restart: unless-stopped
    environment:
      DB_HOST: postgres
      DB_NAME: appdb
      DB_USER: appuser
      DB_PASSWORD: apppassword
      REDIS_HOST: redis
    networks:
      - backend
      - frontend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      # Router HTTP (redirigé vers HTTPS)
      - "traefik.http.routers.api.rule=Host(`api.localhost`)"
      - "traefik.http.routers.api.entrypoints=web"
      # Router HTTPS
      - "traefik.http.routers.api-secure.rule=Host(`api.localhost`)"
      - "traefik.http.routers.api-secure.entrypoints=websecure"
      - "traefik.http.routers.api-secure.tls=true"
      - "traefik.http.services.api.loadbalancer.server.port=5000"
      # Protection des métriques (accès interne uniquement)
      - "traefik.http.routers.api-metrics.rule=Host(`api.localhost`) && PathPrefix(`/metrics`)"
      - "traefik.http.routers.api-metrics.entrypoints=websecure"
      - "traefik.http.routers.api-metrics.tls=true"
      - "traefik.http.routers.api-metrics.middlewares=metrics-auth"
      - "traefik.http.middlewares.metrics-auth.ipwhitelist.sourcerange=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
```

Ajoutez le volume pour les certificats dans la section `volumes` :

```yaml
volumes:
  postgres-data:
  traefik-certs:
```

Supprimez l'exposition du port 5000 de l'API (retirez la section `ports` du service `api` si elle existe).

Relancez la stack :

```bash
docker compose up -d
curl http://api.localhost/health
curl http://api.localhost/api/data
```

💡 **Note pour macOS** : Sur macOS, `api.localhost` devrait fonctionner directement. Si ce n'est pas le cas, ajoutez `127.0.0.1 api.localhost` dans `/etc/hosts` ou utilisez `http://localhost` avec les headers appropriés.

Accédez au dashboard Traefik : http://localhost:8080

❓ **L'API n'expose plus de port directement. Comment y accède-t-on maintenant ? Quel est l'avantage en termes de sécurité ?**

### 4.4 Ajout du TLS (HTTPS)

Traefik peut générer automatiquement des certificats TLS avec Let's Encrypt, mais pour le développement local, nous utiliserons des certificats auto-signés.

Générez un certificat auto-signé (pour le développement uniquement) :

```bash
mkdir -p traefik/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout traefik/certs/server.key \
    -out traefik/certs/server.crt \
    -subj "/CN=localhost"
```

Pour utiliser ce certificat avec Traefik, vous pouvez soit :
1. Utiliser le certificat auto-signé via un volume monté
2. Configurer Traefik pour générer automatiquement des certificats avec Let's Encrypt (en production)

Pour le développement, Traefik générera automatiquement des certificats auto-signés. Testez :

```bash
curl -k https://api.localhost/health  # -k ignore l'erreur de certificat
```

🎯 **Challenge**

Configurez Traefik pour utiliser Let's Encrypt en production. Remplacez les certificats auto-signés par des certificats Let's Encrypt en modifiant les labels du service `api` pour utiliser `certificatesResolvers.letsencrypt`.

---

## Partie 5 : Stack de monitoring

### 5.1 Vue d'ensemble

Notre stack de monitoring comprend :

- Prometheus : collecte les métriques en mode pull (scrape)
- Grafana : visualisation et dashboards
- cAdvisor : métriques des conteneurs Docker
- Node Exporter : métriques système de l'hôte (optionnel)

### 5.2 Configuration Prometheus

Créez le fichier `prometheus/prometheus.yml` :

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Métriques de l'API Express
  - job_name: 'express-api'
    static_configs:
      - targets: ['api:5000']

  # Métriques des conteneurs via cAdvisor
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  # Prometheus lui-même
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### 5.3 Ajout des services monitoring

Complétez `docker-compose.yml` avec les services de monitoring :

```yaml
  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=15d'
    networks:
      - backend
      - monitoring

  # Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring

  # cAdvisor - Métriques des conteneurs
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - monitoring
```

Ajoutez le réseau et les volumes manquants :

```yaml
networks:
  frontend:
  backend:
  monitoring:

volumes:
  postgres-data:
  prometheus-data:
  grafana-data:
```

N'oubliez pas de connecter Prometheus au réseau backend pour qu'il puisse atteindre l'API.

### 5.4 Déploiement et vérification

```bash
docker compose up -d
docker compose ps
```

Vérifiez Prometheus : http://localhost:9090

Allez dans Status > Targets. Tous les endpoints doivent être UP (vert).

❓ **Si un target est DOWN, comment diagnostiquer le problème ? Quelles commandes utiliseriez-vous ?**

### 5.5 Configuration de Grafana

Accédez à Grafana : http://localhost:3000 (admin / admin123)

Ajoutez Prometheus comme data source :

1. Menu latéral > Connections > Data sources > Add data source
2. Sélectionnez Prometheus
3. URL : http://prometheus:9090
4. Save & Test

❓ **Pourquoi utilise-t-on 'prometheus' comme hostname et non 'localhost' ou l'adresse IP de la machine hôte ?**

Importez un dashboard cAdvisor :

5. Menu > Dashboards > Import
6. ID du dashboard : 14282 (cAdvisor)
7. Sélectionnez la data source Prometheus

### 5.6 Dashboard personnalisé

Créez un nouveau dashboard avec les métriques de votre API :

- Panel 1 : Requêtes par seconde → `rate(app_requests_total[5m])`
- Panel 2 : Latence 95e percentile → `histogram_quantile(0.95, rate(app_request_latency_seconds_bucket[5m]))`
- Panel 3 : Répartition par endpoint → `sum by (endpoint) (rate(app_requests_total[5m]))`

🎯 **Challenge**

Générez du trafic avec une boucle (`while true; do curl -s http://api.localhost/api/data; sleep 0.5; done`) et observez les métriques en temps réel.

---

## Partie 6 : Alerting

### 6.1 Configuration des règles d'alerte

Créez le fichier `prometheus/alert.rules.yml` :

```yaml
groups:
  - name: api_alerts
    rules:
      - alert: APIHighLatency
        expr: histogram_quantile(0.95, rate(app_request_latency_seconds_bucket[5m])) > 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "API latency is high"
          description: "95th percentile latency is above 1s for 2 minutes"

      - alert: APIDown
        expr: up{job="express-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API is down"
          description: "The Express API has been unreachable for 1 minute"

      - alert: ContainerHighMemory
        expr: container_memory_usage_bytes{name=~".+"} / container_spec_memory_limit_bytes{name=~".+"} > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Container memory usage high"
          description: "Container {{ $labels.name }} is using more than 80% of its memory limit"
```

Mettez à jour `prometheus/prometheus.yml` pour inclure les règles :

```yaml
global:
  scrape_interval: 15s

rule_files:
  - /etc/prometheus/alert.rules.yml

scrape_configs:
  # ... (reste inchangé)
```

Ajoutez le volume dans `docker-compose.yml` pour le service prometheus :

```yaml
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alert.rules.yml:/etc/prometheus/alert.rules.yml:ro
      - prometheus-data:/prometheus
```

```bash
docker compose restart prometheus
```

Vérifiez dans Prometheus > Status > Rules que les alertes sont chargées.

❓ **Déclenchez l'alerte APIDown en arrêtant le conteneur api. Combien de temps avant que l'alerte passe en état 'firing' ?**

**Réponse :**

L'alerte `APIDown` passe en état `firing` après **1 minute** (60 secondes).

**Explication du mécanisme :**

1. **Configuration de l'alerte** :
   ```yaml
   - alert: APIDown
     expr: up{job="express-api"} == 0
     for: 1m  # ← Durée pendant laquelle la condition doit être vraie
   ```
   Le paramètre `for: 1m` indique que la condition (`up{job="express-api"} == 0`) doit être vraie pendant **1 minute** avant que l'alerte passe en état `firing`.

2. **Cycle de vérification** :
   - Prometheus vérifie les métriques toutes les **15 secondes** (`scrape_interval: 15s`)
   - Prometheus évalue les règles d'alerte toutes les **15 secondes** (`evaluation_interval: 15s`)

3. **Séquence temporelle** :
   - **T+0s** : Le conteneur API est arrêté
   - **T+15s** : Prometheus détecte que `up{job="express-api"} == 0` (première vérification)
   - **T+30s, T+45s, T+60s** : Prometheus continue de vérifier
   - **T+60s** : La condition est vraie depuis 1 minute → L'alerte passe en état `firing`

4. **États de l'alerte** :
   - **Pending** : La condition est vraie mais le délai `for` n'est pas encore écoulé
   - **Firing** : La condition est vraie depuis le délai `for` → L'alerte est active

💡 **Pourquoi ce délai ?** Le paramètre `for` évite les alertes "fantômes" causées par des problèmes temporaires (redémarrage rapide, problème réseau passager, etc.). Il garantit que le problème persiste avant d'alerter.

---

## Partie 7 : Debugging réseau

### 7.1 Outils de diagnostic

Maîtriser le debug réseau dans Docker est essentiel. Voici les commandes clés :

```bash
# Inspecter les réseaux
docker network ls
docker network inspect frontend

# Voir les logs en temps réel
docker compose logs -f traefik api

# Exécuter des commandes dans un conteneur
docker exec -it traefik sh
docker exec -it api sh

# Tester la connectivité depuis un conteneur
docker exec -it traefik ping api
docker exec -it traefik nslookup api

# Voir les connexions réseau
docker exec -it api netstat -tlnp
```

### 7.2 Scénarios de debug

**Scénario 1 : L'API ne répond pas via Traefik**

```bash
# 1. Vérifier que l'API fonctionne directement
docker exec -it traefik wget -qO- http://api:5000/health

# 2. Vérifier la configuration Traefik via le dashboard
# Accédez à http://localhost:8080 et vérifiez les routers et services

# 3. Voir les logs Traefik
docker compose logs traefik

# 4. Vérifier que les labels sont correctement appliqués
docker inspect api | grep -A 20 Labels
```

**Scénario 2 : L'API ne peut pas se connecter à PostgreSQL**

```bash
# 1. Vérifier que postgres est up
docker compose ps postgres

# 2. Tester la connectivité depuis l'API (utiliser un conteneur temporaire postgres)
# Récupérez d'abord le nom du réseau avec : docker network ls | grep backend
docker run --rm --network tp-docker_backend postgres:16-alpine psql -h postgres -U appuser -d appdb -c "SELECT 1;"

# 3. Vérifier les logs postgres
docker compose logs postgres
```

🎯 **Challenge Debug**

Introduisez volontairement une erreur (mauvais nom de service, port incorrect, réseau manquant) et utilisez les outils de debug pour la localiser et la corriger.

---

## Partie 8 : Pour aller plus loin

### 8.1 Challenges bonus

🎯 **Load Balancing**

Dupliquez le service API (api2, api3) avec les mêmes labels Traefik. Traefik répartira automatiquement la charge entre les instances. Vérifiez avec les métriques que les requêtes sont bien distribuées.

🎯 **Healthchecks Traefik**

Configurez Traefik pour vérifier la santé des backends en ajoutant des healthchecks dans les labels. Traefik retirera automatiquement les instances non disponibles.

🎯 **Let's Encrypt avec Traefik**

Configurez Traefik pour générer automatiquement des certificats Let's Encrypt en production. Utilisez le `certificatesResolvers` configuré dans `traefik.yml` et ajoutez les labels appropriés aux services.

🎯 **Alertmanager**

Déployez Alertmanager et configurez l'envoi d'alertes par email ou Slack.

### 8.2 Questions de synthèse

❓ **Comparez cette architecture Docker Compose avec un déploiement Kubernetes. Quels avantages apporterait Kubernetes ?**

**Réponse :**

**Docker Compose** (architecture actuelle) :
- ✅ **Simplicité** : Configuration déclarative en YAML, facile à comprendre et maintenir
- ✅ **Développement local** : Idéal pour le développement et les tests locaux
- ✅ **Démarrage rapide** : Pas de complexité supplémentaire, tout fonctionne sur une seule machine
- ✅ **Ressources limitées** : Nécessite moins de ressources qu'un cluster Kubernetes
- ❌ **Scalabilité limitée** : Difficile de scaler horizontalement automatiquement
- ❌ **Haute disponibilité** : Pas de gestion automatique des pannes (redémarrage manuel)
- ❌ **Orchestration basique** : Pas de gestion avancée du cycle de vie des conteneurs
- ❌ **Multi-nœuds** : Fonctionne sur une seule machine (ou nécessite Swarm pour multi-nœuds)

**Kubernetes** apporterait :

1. **Orchestration avancée** :
   - Gestion automatique du cycle de vie (déploiements, rollbacks, rolling updates)
   - Auto-scaling horizontal (HPA) et vertical
   - Auto-healing : redémarrage automatique des pods en échec
   - Gestion des ressources (CPU, mémoire) avec limites et requêtes

2. **Haute disponibilité** :
   - Distribution des pods sur plusieurs nœuds
   - Gestion automatique des pannes de nœuds
   - Load balancing intégré (Service, Ingress)
   - Rolling updates sans interruption de service

3. **Scalabilité** :
   - Scaling automatique basé sur les métriques (CPU, mémoire, requêtes)
   - Gestion de milliers de conteneurs
   - Multi-cluster et multi-région

4. **Gestion des secrets et config** :
   - Secrets Kubernetes (chiffrés au repos)
   - ConfigMaps pour la configuration
   - Intégration avec des systèmes de secrets externes (Vault, AWS Secrets Manager)

5. **Réseau avancé** :
   - Service mesh (Istio, Linkerd) pour observabilité et sécurité
   - Network policies pour la segmentation réseau
   - Ingress controllers multiples (Traefik, Nginx, etc.)

6. **Stockage persistant** :
   - PersistentVolumes et PersistentVolumeClaims
   - Support de nombreux types de stockage (NFS, EBS, Azure Disk, etc.)
   - Gestion du cycle de vie du stockage

**Quand utiliser Docker Compose vs Kubernetes ?**
- **Docker Compose** : Développement local, petits projets, environnements de staging simples, équipes petites
- **Kubernetes** : Production à grande échelle, microservices complexes, besoin de haute disponibilité, équipes importantes

---

❓ **Comment géreriez-vous les secrets (mots de passe DB, clés API) en production au lieu des variables d'environnement en clair ?**

**Réponse :**

En production, les secrets ne doivent **jamais** être stockés en clair dans les fichiers de configuration ou les variables d'environnement. Voici plusieurs approches :

**1. Docker Secrets (Docker Swarm)** :
```yaml
services:
  api:
    secrets:
      - db_password
      - api_key
secrets:
  db_password:
    external: true
  api_key:
    file: ./secrets/api_key.txt
```
- ✅ Intégré à Docker Swarm
- ❌ Nécessite Docker Swarm (pas disponible avec Docker Compose seul)

**2. Docker Compose avec fichiers externes** :
```yaml
services:
  api:
    env_file:
      - .env.production  # Fichier non versionné, avec permissions restrictives
```
- ✅ Simple à mettre en place
- ⚠️ Nécessite une gestion stricte des permissions (chmod 600)
- ⚠️ Le fichier `.env` ne doit jamais être commité dans Git

**3. HashiCorp Vault** :
```yaml
services:
  vault:
    image: vault:latest
    # Configuration Vault...
```
- ✅ Solution professionnelle et sécurisée
- ✅ Chiffrement au repos, audit trail, rotation automatique
- ✅ Intégration avec de nombreux systèmes
- ❌ Complexité supplémentaire

**4. Secrets managés par le cloud** :
- **AWS** : AWS Secrets Manager ou Parameter Store
- **Azure** : Azure Key Vault
- **GCP** : Secret Manager
- ✅ Gestion centralisée, rotation automatique, audit
- ✅ Intégration native avec les services cloud
- ❌ Dépendance au fournisseur cloud

**5. Solutions hybrides avec Docker Compose** :
```yaml
services:
  api:
    environment:
      DB_PASSWORD: ${DB_PASSWORD}  # Variable injectée au runtime
```
- Utiliser des outils comme `docker-secrets` ou `sops` pour déchiffrer avant le déploiement
- Utiliser des CI/CD pour injecter les secrets au moment du build

**Bonnes pratiques recommandées** :

1. **Ne jamais commiter les secrets** :
   - Ajouter `.env`, `*.secret`, `secrets/` dans `.gitignore`
   - Utiliser `.env.example` avec des valeurs factices

2. **Chiffrement au repos** :
   - Chiffrer les fichiers de secrets avec des outils comme `sops`, `ansible-vault`, ou `gpg`

3. **Rotation régulière** :
   - Changer les mots de passe régulièrement
   - Automatiser la rotation quand possible

4. **Principe du moindre privilège** :
   - Chaque service n'accède qu'aux secrets dont il a besoin
   - Utiliser des comptes de service avec permissions limitées

5. **Audit et monitoring** :
   - Logger les accès aux secrets (sans logger les valeurs)
   - Monitorer les tentatives d'accès non autorisées

**Exemple concret pour ce TP** :
```bash
# Créer un fichier .env.production (non versionné)
DB_PASSWORD=$(openssl rand -base64 32)
API_KEY=$(openssl rand -base64 32)

# Dans docker-compose.yml
services:
  api:
    env_file:
      - .env.production
    # Ou utiliser des secrets externes injectés par le CI/CD
```

---

❓ **Quelle stratégie de backup mettriez-vous en place pour PostgreSQL ?**

**Réponse :**

Une stratégie de backup robuste pour PostgreSQL doit couvrir plusieurs aspects :

**1. Types de backups** :

**a) Backup complet (Full Backup)** :
```bash
# Backup avec pg_dump
docker exec postgres pg_dump -U appuser -d appdb > backup_$(date +%Y%m%d_%H%M%S).sql

# Ou avec pg_dumpall pour tout le cluster
docker exec postgres pg_dumpall -U appuser > full_backup_$(date +%Y%m%d).sql
```
- ✅ Simple à restaurer
- ❌ Peut être long pour de grandes bases
- **Fréquence recommandée** : Quotidienne ou hebdomadaire

**b) Backup continu (WAL archiving)** :
```yaml
# Configuration PostgreSQL pour WAL archiving
services:
  postgres:
    environment:
      POSTGRES_INITDB_ARGS: "-c wal_level=replica"
    command:
      - "postgres"
      - "-c"
      - "archive_mode=on"
      - "-c"
      - "archive_command='test ! -f /backups/wal/%f && cp %p /backups/wal/%f'"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups/wal:/backups/wal
```
- ✅ Point-in-time recovery (PITR) possible
- ✅ Moins d'impact sur les performances
- ✅ Permet de restaurer à n'importe quel moment
- **Fréquence** : Continu (tous les fichiers WAL)

**c) Backup physique (pg_basebackup)** :
```bash
docker exec postgres pg_basebackup -U appuser -D /backups/basebackup -Ft -z -P
```
- ✅ Plus rapide pour de grandes bases
- ✅ Copie exacte des fichiers de données
- **Fréquence recommandée** : Quotidienne

**2. Stratégie recommandée (3-2-1 Rule)** :

- **3 copies** : Production + 2 backups
- **2 types de stockage** : Disque local + Stockage distant (S3, Azure Blob, etc.)
- **1 copie hors-site** : Backup géographiquement distant

**3. Implémentation avec Docker Compose** :

```yaml
services:
  postgres:
    # ... configuration existante ...
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups:/backups

  # Service de backup automatique
  postgres-backup:
    image: postgres:16-alpine
    restart: "no"  # S'exécute via cron
    environment:
      PGHOST: postgres
      PGDATABASE: appdb
      PGUSER: appuser
      PGPASSWORD: apppassword
      S3_BUCKET: my-backups-bucket
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    volumes:
      - ./backups:/backups
      - ./scripts/backup.sh:/backup.sh
    entrypoint: /backup.sh
    networks:
      - backend
    depends_on:
      - postgres
```

**Script de backup** (`scripts/backup.sh`) :
```bash
#!/bin/sh
BACKUP_FILE="/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE | gzip > $BACKUP_FILE

# Upload vers S3
aws s3 cp $BACKUP_FILE s3://$S3_BUCKET/postgres/

# Garder seulement les 7 derniers backups locaux
ls -t /backups/backup_*.sql.gz | tail -n +8 | xargs rm -f
```

**4. Planification avec cron** :
```yaml
  postgres-backup:
    # ... configuration ...
    command: >
      sh -c "
        echo '0 2 * * * /backup.sh' | crontab - &&
        crond -f -l 2
      "
```

**5. Tests de restauration** :

**Restauration depuis un backup SQL** :
```bash
# Créer une nouvelle base de test
docker exec postgres createdb -U appuser appdb_test

# Restaurer
docker exec -i postgres psql -U appuser -d appdb_test < backup_20260205.sql
```

**Point-in-time recovery (PITR)** :
```bash
# Restaurer un backup de base + WAL jusqu'à un point précis
docker exec postgres pg_basebackup -D /var/lib/postgresql/data/restore
# Puis restaurer les WAL jusqu'au timestamp souhaité
```

**6. Monitoring et alertes** :

- Vérifier que les backups se terminent avec succès
- Monitorer la taille des backups
- Tester régulièrement la restauration (au moins mensuellement)
- Alertes si un backup échoue

**7. Bonnes pratiques** :

- ✅ **Automatisation** : Ne jamais compter sur des backups manuels
- ✅ **Test de restauration** : Tester régulièrement la restauration
- ✅ **Documentation** : Documenter la procédure de restauration
- ✅ **Rétention** : Définir une politique de rétention (ex: 30 jours quotidiens, 12 mois mensuels)
- ✅ **Chiffrement** : Chiffrer les backups sensibles
- ✅ **Séparation** : Stocker les backups sur un système différent de la production

**Exemple de politique de rétention** :
- Backups quotidiens : 30 jours
- Backups hebdomadaires : 12 semaines
- Backups mensuels : 12 mois
- Backups annuels : 7 ans

### 8.3 Ressources

- Documentation Docker : https://docs.docker.com/
- Documentation Traefik : https://doc.traefik.io/traefik/
- Documentation Prometheus : https://prometheus.io/docs/
- Galerie dashboards Grafana : https://grafana.com/grafana/dashboards/

---

**Bon TP !**
