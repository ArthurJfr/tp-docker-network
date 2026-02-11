# Révision QCM Réseau - 40 Questions

## Table des matières
1. [Adresses IP et masques de sous-réseau](#1-adresses-ip-et-masques-de-sous-réseau)
2. [Calculs réseau (CIDR, sous-réseaux)](#2-calculs-réseau-cidr-sous-réseaux)
3. [DHCP (Dynamic Host Configuration Protocol)](#3-dhcp-dynamic-host-configuration-protocol)
4. [DNS (Domain Name System)](#4-dns-domain-name-system)
5. [VLAN, LAN, WAN](#5-vlan-lan-wan)
6. [Réseaux Docker (applications pratiques)](#6-réseaux-docker-applications-pratiques)
7. [Exercices pratiques](#7-exercices-pratiques)
8. [Formules et rappels rapides](#8-formules-et-rappels-rapides)

---

## 1. Adresses IP et masques de sous-réseau

### 1.1 Structure d'une adresse IPv4

Une adresse IPv4 est composée de **32 bits** (4 octets) :

```
192.168.1.100
│   │   │ │
│   │   │ └─ Octet 4 (hôte)
│   │   └─── Octet 3 (hôte)
│   └─────── Octet 2 (réseau/hôte selon masque)
└─────────── Octet 1 (réseau)
```

**Format décimal pointé** : `A.B.C.D`
- Chaque lettre représente un octet (8 bits)
- Valeur de chaque octet : 0 à 255
- Exemple : `192.168.1.100`

### 1.2 Classes d'adresses IP (historique)

| Classe | Plage | Masque par défaut | Usage |
|--------|-------|-------------------|-------|
| A | 1.0.0.0 - 126.255.255.255 | /8 (255.0.0.0) | Grandes organisations |
| B | 128.0.0.0 - 191.255.255.255 | /16 (255.255.0.0) | Organisations moyennes |
| C | 192.0.0.0 - 223.255.255.255 | /24 (255.255.255.0) | Petits réseaux |
| D | 224.0.0.0 - 239.255.255.255 | - | Multicast |
| E | 240.0.0.0 - 255.255.255.255 | - | Réservé |

**Note** : Le système de classes est obsolète, on utilise maintenant CIDR.

### 1.3 Adresses IP privées (RFC 1918)

Ces adresses ne sont **jamais routées sur Internet** :

| Plage | Masque | Usage |
|-------|--------|-------|
| 10.0.0.0 - 10.255.255.255 | /8 | Grandes entreprises |
| 172.16.0.0 - 172.31.255.255 | /12 | Réseaux moyens |
| 192.168.0.0 - 192.168.255.255 | /16 | Réseaux domestiques |

**Dans Docker** :
- Réseau bridge par défaut : `172.17.0.0/16`
- Réseaux personnalisés : `172.18.0.0/16`, `172.19.0.0/16`, etc.

### 1.4 Adresses IP spéciales

- **0.0.0.0** : Toutes les interfaces / adresse non configurée
- **127.0.0.1** : Localhost (boucle locale)
- **255.255.255.255** : Broadcast (tous les hôtes du réseau)
- **169.254.x.x** : APIPA (Auto-Configuration IP, échec DHCP)

---

## 2. Calculs réseau (CIDR, sous-réseaux)

### 2.1 Notation CIDR (Classless Inter-Domain Routing)

**Format** : `IP/Masque`
- Exemple : `192.168.1.0/24`
- `/24` signifie que les **24 premiers bits** identifient le réseau
- Les **8 derniers bits** (32 - 24 = 8) identifient les hôtes

### 2.2 Masques de sous-réseau

**Conversion CIDR → Masque décimal** :

| CIDR | Masque décimal | Bits réseau | Bits hôtes | Nombre d'hôtes |
|------|----------------|-------------|------------|----------------|
| /8 | 255.0.0.0 | 8 | 24 | 16 777 216 |
| /16 | 255.255.0.0 | 16 | 16 | 65 536 |
| /24 | 255.255.255.0 | 24 | 8 | 256 |
| /25 | 255.255.255.128 | 25 | 7 | 128 |
| /26 | 255.255.255.192 | 26 | 6 | 64 |
| /27 | 255.255.255.224 | 27 | 5 | 32 |
| /28 | 255.255.255.240 | 28 | 4 | 16 |
| /30 | 255.255.255.252 | 30 | 2 | 4 |

**Formule** : Nombre d'hôtes = 2^(32 - CIDR) - 2
- **-2** car : adresse réseau et adresse broadcast ne sont pas utilisables

### 2.3 Calcul du masque décimal depuis CIDR

**Méthode** :
1. Convertir `/24` en binaire : `11111111.11111111.11111111.00000000`
2. Convertir chaque octet en décimal :
   - `11111111` = 255
   - `00000000` = 0
3. Résultat : `255.255.255.0`

**Exemple** : `/26`
- Binaire : `11111111.11111111.11111111.11000000`
- Décimal : `255.255.255.192`
- Calcul : 128 + 64 = 192 (les deux premiers bits de l'octet sont à 1)

### 2.4 Calcul de la plage d'adresses

**Exemple** : `192.168.1.0/24`

1. **Adresse réseau** : `192.168.1.0` (tous les bits hôte à 0)
2. **Première adresse utilisable** : `192.168.1.1`
3. **Dernière adresse utilisable** : `192.168.1.254`
4. **Adresse broadcast** : `192.168.1.255` (tous les bits hôte à 1)

**Formule générale** :
- Adresse réseau : `IP & Masque`
- Adresse broadcast : `IP | ~Masque`
- Plage utilisable : `[Réseau + 1]` à `[Broadcast - 1]`

### 2.5 Sous-réseaux (subnetting)

**Objectif** : Diviser un réseau en plusieurs sous-réseaux plus petits.

**Exemple** : Diviser `192.168.1.0/24` en 4 sous-réseaux

1. **Nombre de bits nécessaires** : log₂(4) = 2 bits
2. **Nouveau masque** : /24 + 2 = `/26`
3. **Masque décimal** : `255.255.255.192`
4. **Taille de chaque sous-réseau** : 2^(32-26) - 2 = 64 - 2 = **62 hôtes**

**Sous-réseaux créés** :
- Sous-réseau 1 : `192.168.1.0/26` (192.168.1.0 - 192.168.1.63)
- Sous-réseau 2 : `192.168.1.64/26` (192.168.1.64 - 192.168.1.127)
- Sous-réseau 3 : `192.168.1.128/26` (192.168.1.128 - 192.168.1.191)
- Sous-réseau 4 : `192.168.1.192/26` (192.168.1.192 - 192.168.1.255)

**Calcul de l'adresse réseau** :
- Pour `192.168.1.64/26` :
  - 64 en binaire = `01000000`
  - Les 2 premiers bits (01) identifient le sous-réseau
  - Les 6 derniers bits identifient l'hôte

### 2.6 Exemples pratiques du TP Docker

**Réseau bridge par défaut** : `172.17.0.0/16`
- Masque : `255.255.0.0`
- Nombre d'hôtes possibles : 65 534 (2^16 - 2)
- Plage : `172.17.0.1` à `172.17.255.254`
- Gateway : `172.17.0.1`

**Réseau personnalisé** : `172.25.0.0/16`
- Masque : `255.255.0.0`
- Nombre d'hôtes possibles : 65 534
- Plage : `172.25.0.1` à `172.25.255.254`
- Gateway : `172.25.0.1`

**Conteneur API** : `172.25.0.3/16`
- Réseau : `172.25.0.0/16`
- Adresse hôte : `.0.3` (3ème conteneur sur ce réseau)

---

## 3. DHCP (Dynamic Host Configuration Protocol)

### 3.1 Rôle du DHCP

Le DHCP **attribue automatiquement** les paramètres réseau aux clients :

- **Adresse IP**
- **Masque de sous-réseau**
- **Passerelle par défaut (gateway)**
- **Serveurs DNS**
- **Durée de bail (lease time)**

### 3.2 Processus DHCP (DORA)

**D**iscover → **O**ffer → **R**equest → **A**cknowledge

1. **DISCOVER** (Client → Broadcast)
   - Client envoie un paquet DHCP Discover en broadcast (à toutes les machines, le premier dhcp qui répond attribut les adresses)
   - "Qui peut me donner une adresse IP ?"

2. **OFFER** (Serveur → Client)
   - Serveur DHCP répond avec une offre (adresse IP proposée)
   - Plusieurs serveurs peuvent répondre

3. **REQUEST** (Client → Broadcast)
   - Client accepte une offre et demande cette adresse
   - Envoi en broadcast pour informer tous les serveurs

4. **ACKNOWLEDGE** (Serveur → Client)
   - Serveur confirme l'attribution de l'adresse IP
   - Client configure son interface réseau

### 3.3 Renouvellement du bail (lease renewal)

- **T1 (50% du bail)** : Tentative de renouvellement auprès du serveur qui a attribué l'IP
- **T2 (87.5% du bail)** : Tentative de renouvellement auprès de n'importe quel serveur DHCP
- **Expiration** : Si aucun renouvellement, l'IP est libérée

### 3.4 DHCP dans Docker

**Docker attribue automatiquement les IP** aux conteneurs :

```bash
# Docker agit comme serveur DHCP pour les réseaux
docker network create mon-reseau
# Docker attribue automatiquement :
# - IP dans la plage du réseau
# - Gateway (première adresse)
# - Configuration DNS (127.0.0.11)
```

**Exemple** :
- Réseau : `172.25.0.0/16`
- Gateway : `172.25.0.1` (attribuée automatiquement)
- Conteneur 1 : `172.25.0.2` (attribuée automatiquement)
- Conteneur 2 : `172.25.0.3` (attribuée automatiquement)

### 3.5 Ports DHCP

- **Port serveur** : **67/UDP**
- **Port client** : **68/UDP**

### 3.6 Réservation d'adresse (DHCP Reservation)

Le serveur DHCP peut **réserver une IP spécifique** pour un client (via MAC address) :

```
MAC: aa:bb:cc:dd:ee:ff → IP: 192.168.1.100 (réservée)
```

---

## 4. DNS (Domain Name System)

### 4.1 Rôle du DNS

Le DNS **résout les noms de domaine en adresses IP** :

```
www.example.com → 93.184.216.34
```

### 4.2 Structure hiérarchique

```
                    . (racine)
                    │
        ┌───────────┼───────────┐
        │           │           │
      .com        .org        .fr
        │           │           │
    example      example    example
        │
    www, mail, ftp
```

**Exemple** : `www.example.com`
- `.` : Racine (implicite)
- `com` : TLD (Top Level Domain)
- `example` : Domaine de second niveau
- `www` : Sous-domaine / hôte

### 4.3 Types d'enregistrements DNS

| Type | Description | Exemple |
|------|-------------|---------|
| **A** | Adresse IPv4 | `www.example.com → 93.184.216.34` |
| **AAAA** | Adresse IPv6 | `www.example.com → 2606:2800:220:1:248:1893:25c8:1946` |
| **CNAME** | Alias (canonical name) | `www → example.com` |
| **MX** | Mail Exchange | `example.com → mail.example.com` |
| **NS** | Name Server | `example.com → ns1.example.com` |
| **PTR** | Reverse DNS (IP → nom) | `93.184.216.34 → www.example.com` |
| **TXT** | Texte (SPF, DKIM, etc.) | `example.com → "v=spf1 ..."` |

### 4.4 Processus de résolution DNS

**Résolution récursive** :

```
1. Client demande : www.example.com
   ↓
2. Serveur DNS local (127.0.0.11 dans Docker)
   ↓
3. Serveur racine (.)
   ↓
4. Serveur TLD (.com)
   ↓
5. Serveur autoritaire (example.com)
   ↓
6. Réponse : 93.184.216.34
```

**Cache DNS** :
- Les réponses sont mises en cache pour éviter les requêtes répétées
- TTL (Time To Live) : Durée de validité du cache

### 4.5 DNS dans Docker

**Serveur DNS intégré** : `127.0.0.11:53`

**Fonctionnement** :
- Docker maintient une table de correspondance **nom conteneur → IP**
- Résolution automatique sur les réseaux personnalisés
- Configuration automatique dans `/etc/resolv.conf`

**Exemple du TP** :
```bash
# Conteneur nommé "api" sur réseau "frontend"
docker exec traefik nslookup api
# Résultat : api → 172.25.0.3
```

**Avantages** :
- Communication par nom (plus maintenable)
- Résilience (IP peut changer, nom reste)
- Simplicité de configuration

### 4.6 Ports DNS

- **Port standard** : **53/UDP** (requêtes)
- **Port standard** : **53/TCP** (transferts de zone)

### 4.7 Types de serveurs DNS

1. **Serveur récursif** : Résout les requêtes pour les clients
2. **Serveur autoritaire** : Détient les informations sur un domaine
3. **Serveur racine** : Point d'entrée de la hiérarchie DNS

---

## 5. VLAN, LAN, WAN

### 5.1 LAN (Local Area Network)

**Définition** : Réseau local couvrant une zone géographique limitée.

**Caractéristiques** :
- Zone limitée (bâtiment, campus)
- Haute vitesse (Gigabit Ethernet)
- Faible latence
- Contrôle local

**Exemples** :
- Réseau d'une entreprise
- Réseau domestique
- Réseau d'un datacenter

**Technologies** :
- Ethernet (câble)
- Wi-Fi (802.11)
- Switch Ethernet

### 5.2 WAN (Wide Area Network)

**Définition** : Réseau étendu couvrant une grande zone géographique.

**Caractéristiques** :
- Grande distance (pays, continents)
- Vitesse variable (dépend de la connexion)
- Latence plus élevée
- Utilise des opérateurs tiers

**Exemples** :
- Internet
- Réseau d'une multinationale
- Connexions entre sites distants

**Technologies** :
- Fibre optique longue distance
- Satellite
- Lignes louées (leased lines)
- VPN (Virtual Private Network)

### 5.3 VLAN (Virtual Local Area Network)

**Définition** : Réseau logique créé au sein d'un réseau physique.

**Objectif** : **Segmenter un réseau physique** en plusieurs réseaux logiques.

**Avantages** :
- **Sécurité** : Isolation entre VLANs
- **Performance** : Réduction du broadcast domain
- **Flexibilité** : Réorganisation logique sans changer le câblage
- **Gestion** : Groupement logique d'appareils

**Exemple** :
```
Switch physique unique :
├── VLAN 10 (Comptabilité) : Ports 1-10
├── VLAN 20 (RH) : Ports 11-20
└── VLAN 30 (IT) : Ports 21-30
```

**Communication entre VLANs** :
- Nécessite un **routeur** ou un **switch Layer 3**
- Les VLANs sont isolés par défaut

### 5.4 Comparaison LAN vs WAN vs VLAN

| Caractéristique | LAN | WAN | VLAN |
|-----------------|-----|-----|------|
| **Portée** | Local | Étendue | Logique (local) |
| **Distance** | < 1 km | > 1 km | Même infrastructure |
| **Vitesse** | Élevée (Gbps) | Variable (Mbps-Gbps) | Élevée (Gbps) |
| **Latence** | Faible | Élevée | Faible |
| **Contrôle** | Local | Opérateurs | Local |
| **Coût** | Faible | Élevé | Faible |

### 5.5 VLAN dans le contexte Docker

**Concept similaire** : Les **réseaux Docker** fonctionnent comme des VLANs :

```
Réseau physique (hôte Docker)
├── Réseau "frontend" (VLAN logique)
│   ├── Traefik
│   └── API
├── Réseau "backend" (VLAN logique)
│   ├── PostgreSQL
│   ├── Redis
│   └── API
└── Réseau "monitoring" (VLAN logique)
    ├── Prometheus
    ├── Grafana
    └── cAdvisor
```

**Isolation** : Comme les VLANs, les réseaux Docker isolent les conteneurs.

---

## 6. Réseaux Docker (applications pratiques)

### 6.1 Types de réseaux Docker

| Type | Description | Isolation | Performance |
|------|-------------|-----------|-------------|
| **bridge** | Réseau virtuel isolé | ✅ Complète | Bonne |
| **host** | Partage la pile réseau de l'hôte | ❌ Aucune | Excellente |
| **none** | Aucune connectivité | ✅ Totale | N/A |
| **overlay** | Réseau multi-hôte (Swarm) | ✅ Complète | Variable |

### 6.2 Architecture réseau du TP

```
┌─────────────────────────────────────────────┐
│         RÉSEAU FRONTEND (172.25.0.0/16)     │
│  ┌──────────┐         ┌──────────┐          │
│  │ Traefik  │─────────│   API    │          │
│  │172.25.0.2│         │172.25.0.3│          │
│  └──────────┘         └─────┬────┘          │
└─────────────────────────────┼───────────────┘
                              │
┌─────────────────────────────┼───────────────┐
│      RÉSEAU BACKEND (172.24.0.0/16)        │
│                              │              │
│  ┌──────────┐      ┌────────▼────┐ ┌──────┐│
│  │PostgreSQL│      │    API      │ │Redis ││
│  │172.24.0.2│      │172.24.0.3   │ │172.24││
│  └──────────┘      └─────────────┘ └──────┘│
└─────────────────────────────────────────────┘
```

### 6.3 Résolution DNS dans Docker

**Serveur DNS** : `127.0.0.11:53`

**Fonctionnement** :
1. Conteneur demande : `postgres`
2. Requête vers `127.0.0.11:53`
3. Docker résout : `postgres → 172.24.0.2`
4. Communication établie

**Table de correspondance** :
```
Nom conteneur    →    Adresse IP
─────────────────────────────────
postgres         →    172.24.0.2
redis            →    172.24.0.4
api              →    172.24.0.3 (backend)
api              →    172.25.0.3 (frontend)
traefik          →    172.25.0.2
```

### 6.4 Matrice de communication

| De \ Vers | Traefik | API | PostgreSQL | Redis | Prometheus |
|-----------|---------|-----|------------|-------|------------|
| **Traefik** | - | ✅ (frontend) | ❌ | ❌ | ❌ |
| **API** | ✅ (frontend) | - | ✅ (backend) | ✅ (backend) | ✅ (backend) |
| **PostgreSQL** | ❌ | ✅ (backend) | - | ❌ | ✅ (backend) |
| **Redis** | ❌ | ✅ (backend) | ❌ | - | ❌ |
| **Prometheus** | ❌ | ✅ (backend) | ✅ (backend) | ❌ | - |

---

## 7. Exercices pratiques

### Exercice 1 : Calcul de masque et plage d'adresses

**Question** : Pour le réseau `192.168.10.0/26`, calculez :
1. Le masque de sous-réseau en décimal
2. Le nombre d'adresses utilisables
3. La plage d'adresses
4. L'adresse réseau et broadcast

**Réponse** :
1. **Masque** : `/26` = `255.255.255.192`
   - Calcul : 26 bits réseau = `11111111.11111111.11111111.11000000`
   - Dernier octet : `11000000` = 128 + 64 = 192

2. **Nombre d'adresses** : 2^(32-26) - 2 = 64 - 2 = **62 adresses**

3. **Plage** :
   - Adresse réseau : `192.168.10.0`
   - Première utilisable : `192.168.10.1`
   - Dernière utilisable : `192.168.10.62`
   - Adresse broadcast : `192.168.10.63`

### Exercice 2 : Sous-réseaux

**Question** : Divisez `172.16.0.0/16` en 8 sous-réseaux de taille égale.

**Réponse** :
1. **Bits nécessaires** : log₂(8) = 3 bits
2. **Nouveau masque** : /16 + 3 = `/19`
3. **Masque décimal** : `255.255.224.0`
4. **Taille par sous-réseau** : 2^(32-19) - 2 = 8192 - 2 = **8190 hôtes**

**Sous-réseaux** :
- `172.16.0.0/19` (172.16.0.0 - 172.16.31.255)
- `172.16.32.0/19` (172.16.32.0 - 172.16.63.255)
- `172.16.64.0/19` (172.16.64.0 - 172.16.95.255)
- ... (jusqu'à 8 sous-réseaux)

### Exercice 3 : DHCP

**Question** : Dans le processus DHCP, quel est l'ordre des messages ?

**Réponse** : **DORA**
1. **D**iscover (client → broadcast)
2. **O**ffer (serveur → client)
3. **R**equest (client → broadcast)
4. **A**cknowledge (serveur → client)

### Exercice 4 : DNS

**Question** : Un conteneur Docker nommé "api" sur le réseau "frontend" a l'IP `172.25.0.3`. Quel serveur DNS résout le nom "api" et quelle est son adresse ?

**Réponse** :
- **Serveur DNS** : Serveur DNS intégré Docker
- **Adresse** : `127.0.0.11:53`
- **Résolution** : `api → 172.25.0.3`

### Exercice 5 : VLAN vs Réseau Docker

**Question** : Comparez un VLAN et un réseau Docker. Quelles sont les similitudes ?

**Réponse** :
**Similitudes** :
- ✅ Isolation logique
- ✅ Segmentation du trafic
- ✅ Groupement logique d'appareils/services
- ✅ Communication nécessite un routeur/passerelle

**Différences** :
- VLAN : Au niveau switch physique
- Réseau Docker : Au niveau logiciel (conteneurs)

---

## 8. Formules et rappels rapides

### 8.1 Formules essentielles

**Nombre d'hôtes** :
```
Hôtes = 2^(32 - CIDR) - 2
```

**Nombre de sous-réseaux** :
```
Sous-réseaux = 2^bits_empruntés
```

**Masque décimal depuis CIDR** :
```
Masque = 2^bits_réseau - 1 (par octet)
```

### 8.2 Table de conversion CIDR

| CIDR | Masque | Hôtes | Exemple réseau |
|------|--------|-------|----------------|
| /8 | 255.0.0.0 | 16 777 214 | 10.0.0.0/8 |
| /16 | 255.255.0.0 | 65 534 | 172.16.0.0/16 |
| /24 | 255.255.255.0 | 254 | 192.168.1.0/24 |
| /25 | 255.255.255.128 | 126 | 192.168.1.0/25 |
| /26 | 255.255.255.192 | 62 | 192.168.1.0/26 |
| /27 | 255.255.255.224 | 30 | 192.168.1.0/27 |
| /28 | 255.255.255.240 | 14 | 192.168.1.0/28 |
| /30 | 255.255.255.252 | 2 | 192.168.1.0/30 |

### 8.3 Ports standards

| Service | Port | Protocole |
|---------|------|-----------|
| HTTP | 80 | TCP |
| HTTPS | 443 | TCP |
| DNS | 53 | UDP/TCP |
| DHCP | 67 (serveur), 68 (client) | UDP |
| SSH | 22 | TCP |
| FTP | 21 | TCP |
| SMTP | 25 | TCP |
| POP3 | 110 | TCP |
| IMAP | 143 | TCP |

### 8.4 Adresses IP privées (RFC 1918)

- `10.0.0.0/8` (10.0.0.0 - 10.255.255.255)
- `172.16.0.0/12` (172.16.0.0 - 172.31.255.255)
- `192.168.0.0/16` (192.168.0.0 - 192.168.255.255)

### 8.5 Commandes réseau essentielles

```bash
# Docker
docker network ls
docker network inspect <nom>
docker exec <container> ping <host>
docker exec <container> nslookup <host>

# Général
ping <host>
nslookup <domain>
ipconfig / ifconfig
netstat -an
traceroute <host>
```

---

## Questions types QCM

### Type 1 : Calcul d'adresse IP

**Q1** : Quelle est l'adresse broadcast du réseau `192.168.5.0/24` ?
- A) 192.168.5.0
- B) 192.168.5.255 ✅
- C) 192.168.5.254
- D) 192.168.255.255

**Q2** : Combien d'adresses utilisables dans un réseau `/26` ?
- A) 64
- B) 62 ✅ 
- C) 32
- D) 30

### Type 2 : Masque de sous-réseau

**Q3** : Quel est le masque décimal pour `/27` ?
- A) 255.255.255.0
- B) 255.255.255.224 ✅
- C) 255.255.255.240
- D) 255.255.255.248

### Type 3 : DHCP

**Q4** : Quel est l'ordre correct du processus DHCP ?
- A) Request, Offer, Discover, Acknowledge
- B) Discover, Offer, Request, Acknowledge ✅
- C) Offer, Discover, Request, Acknowledge
- D) Acknowledge, Request, Offer, Discover

**Q5** : Sur quel port écoute un serveur DHCP ?
- A) 53
- B) 67 ✅
- C) 68
- D) 80

### Type 4 : DNS

**Q6** : Quel type d'enregistrement DNS associe un nom à une adresse IPv4 ?
- A) AAAA
- B) A ✅
- C) CNAME
- D) MX

**Q7** : Dans Docker, quel serveur DNS résout les noms de conteneurs ?
- A) 127.0.0.1
- B) 127.0.0.11 ✅
- C) 8.8.8.8
- D) 172.17.0.1

### Type 5 : VLAN, LAN, WAN

**Q8** : Un VLAN permet de :
- A) Augmenter la vitesse du réseau
- B) Segmenter logiquement un réseau physique ✅
- C) Étendre un réseau sur de grandes distances
- D) Réduire la latence

**Q9** : Quelle est la principale différence entre LAN et WAN ?
- A) La vitesse
- B) La portée géographique ✅
- C) Le protocole utilisé
- D) Le nombre d'appareils

### Type 6 : Réseaux Docker

**Q10** : Un conteneur peut-il être sur plusieurs réseaux Docker ?
- A) Non, jamais
- B) Oui, c'est possible ✅
- C) Seulement avec Docker Swarm
- D) Seulement avec des réseaux bridge

---

## Conseils pour le QCM

### ✅ Stratégie de révision

1. **Maîtrisez les calculs** :
   - CIDR → Masque décimal
   - Nombre d'hôtes
   - Plage d'adresses

2. **Mémorisez les ports** :
   - DNS : 53
   - DHCP : 67/68
   - HTTP/HTTPS : 80/443

3. **Comprenez les processus** :
   - DHCP : DORA
   - DNS : Résolution récursive

4. **Distinguer les concepts** :
   - LAN vs WAN vs VLAN
   - Réseau physique vs logique

### 🎯 Points d'attention

- **Adresses IP privées** : Ne jamais routées sur Internet
- **Adresses spéciales** : 127.0.0.1, 0.0.0.0, 255.255.255.255
- **Calculs** : Toujours soustraire 2 (réseau + broadcast)
- **DNS Docker** : 127.0.0.11 (pas 127.0.0.1)

---

**Bon courage pour votre QCM ! 🚀**
