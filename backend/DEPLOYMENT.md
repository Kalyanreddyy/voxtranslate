# VoxTranslate Backend Deployment Guide

## Production Deployment

### Prerequisites

- Python 3.12+
- PostgreSQL 13+ (managed service recommended)
- Redis 7+ (managed service recommended)
- Docker & Docker Compose
- Domain name and SSL certificate
- API keys: ElevenLabs, Anthropic (Claude)

### 1. Prepare Environment

```bash
# Clone repository
git clone <repo-url>
cd backend

# Create production .env file
cp .env.example .env
# Edit .env with production values:
# - Set DEBUG=False
# - Use strong SECRET_KEY
# - Configure DATABASE_URL for managed PostgreSQL
# - Configure REDIS_URL for managed Redis
# - Add API keys
```

### 2. Docker Image Build

```bash
# Build the image
docker build -t voxtranslate-backend:latest .

# Tag for registry
docker tag voxtranslate-backend:latest registry.example.com/voxtranslate-backend:latest

# Push to registry
docker push registry.example.com/voxtranslate-backend:latest
```

### 3. Database Setup

```bash
# Create database in PostgreSQL
psql -U postgres << EOF
CREATE DATABASE voxtranslate;
CREATE USER voxtranslate WITH PASSWORD 'strong-password';
ALTER ROLE voxtranslate SET client_encoding TO 'utf8';
ALTER ROLE voxtranslate SET default_transaction_isolation TO 'read committed';
ALTER ROLE voxtranslate SET default_transaction_deferrable TO on;
ALTER ROLE voxtranslate SET default_transaction_read_only TO off;
ALTER ROLE voxtranslate SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE voxtranslate TO voxtranslate;
EOF

# Initialize tables
python -c "import asyncio; from app.db import create_tables; asyncio.run(create_tables())"
```

### 4. Kubernetes Deployment

#### ConfigMap for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: voxtranslate-config
  namespace: production
data:
  DEBUG: "false"
  APP_VERSION: "1.0.0"
  STORAGE_PATH: "/data/voxtranslate"
  TEMP_PATH: "/tmp/voxtranslate"
  CORS_ORIGINS: '["https://example.com"]'
```

#### Secret for Sensitive Data

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: voxtranslate-secrets
  namespace: production
type: Opaque
stringData:
  SECRET_KEY: <generate-with-openssl-rand-hex-32>
  DATABASE_URL: postgresql+asyncpg://user:pass@postgres-host:5432/voxtranslate
  REDIS_URL: redis://redis-host:6379/0
  CELERY_BROKER_URL: redis://redis-host:6379/0
  CELERY_RESULT_BACKEND: redis://redis-host:6379/1
  ELEVENLABS_API_KEY: <your-api-key>
  ANTHROPIC_API_KEY: <your-api-key>
```

#### API Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voxtranslate-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: voxtranslate-api
  template:
    metadata:
      labels:
        app: voxtranslate-api
    spec:
      containers:
      - name: api
        image: registry.example.com/voxtranslate-backend:latest
        command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: voxtranslate-config
        - secretRef:
            name: voxtranslate-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 20
          periodSeconds: 5
        volumeMounts:
        - name: storage
          mountPath: /data/voxtranslate
        - name: temp
          mountPath: /tmp/voxtranslate
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: voxtranslate-storage
      - name: temp
        emptyDir: {}
```

#### Celery Worker Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voxtranslate-worker
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: voxtranslate-worker
  template:
    metadata:
      labels:
        app: voxtranslate-worker
    spec:
      containers:
      - name: worker
        image: registry.example.com/voxtranslate-backend:latest
        command: ["celery", "-A", "app.pipeline.tasks", "worker", "--loglevel=info", "--concurrency=4"]
        envFrom:
        - configMapRef:
            name: voxtranslate-config
        - secretRef:
            name: voxtranslate-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        volumeMounts:
        - name: storage
          mountPath: /data/voxtranslate
        - name: temp
          mountPath: /tmp/voxtranslate
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: voxtranslate-storage
      - name: temp
        emptyDir: {}
```

#### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: voxtranslate-api
  namespace: production
spec:
  selector:
    app: voxtranslate-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer
```

#### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: voxtranslate
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.voxtranslate.example.com
    secretName: voxtranslate-tls
  rules:
  - host: api.voxtranslate.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: voxtranslate-api
            port:
              number: 80
```

### 5. Docker Compose Production

```bash
# Production docker-compose.yml (without development mounts)
docker-compose -f docker-compose.yml up -d

# Check logs
docker-compose logs -f api
docker-compose logs -f celery_worker
```

### 6. Nginx Reverse Proxy

```nginx
upstream voxtranslate_api {
    server 127.0.0.1:8000;
}

server {
    listen 443 ssl http2;
    server_name api.voxtranslate.example.com;

    ssl_certificate /etc/letsencrypt/live/api.voxtranslate.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.voxtranslate.example.com/privkey.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://voxtranslate_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://voxtranslate_api;
        access_log off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.voxtranslate.example.com;
    return 301 https://$server_name$request_uri;
}
```

### 7. Systemd Services

#### voxtranslate-api.service

```ini
[Unit]
Description=VoxTranslate API Service
After=network.target

[Service]
Type=notify
User=voxtranslate
WorkingDirectory=/opt/voxtranslate/backend
Environment="PATH=/opt/voxtranslate/backend/venv/bin"
ExecStart=/opt/voxtranslate/backend/venv/bin/gunicorn -w 4 -b 0.0.0.0:8000 --timeout 120 wsgi:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### voxtranslate-worker.service

```ini
[Unit]
Description=VoxTranslate Celery Worker
After=network.target

[Service]
Type=forking
User=voxtranslate
WorkingDirectory=/opt/voxtranslate/backend
Environment="PATH=/opt/voxtranslate/backend/venv/bin"
ExecStart=/opt/voxtranslate/backend/venv/bin/celery -A app.pipeline.tasks worker --loglevel=info --concurrency=4 --pidfile=/var/run/voxtranslate-worker.pid --logfile=/var/log/voxtranslate/worker.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 8. Monitoring & Logging

#### Prometheus Metrics

```yaml
# Add prometheus client dependency
pip install prometheus-client

# In app/main.py:
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
```

#### Log Aggregation (ELK Stack)

```yaml
# Configure logging to stdout for Docker/Kubernetes
# Add to logging.conf or app/main.py
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
```

#### Application Performance Monitoring

```python
# Add to app/main.py for Sentry integration
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[
        FastApiIntegration(),
        CeleryIntegration(),
    ],
    traces_sample_rate=0.1,
)
```

### 9. Backup Strategy

```bash
# PostgreSQL automated backup
pg_dump -U voxtranslate voxtranslate | gzip > backup_$(date +%Y%m%d).sql.gz

# S3 backup
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://voxtranslate-backups/

# Redis persistence (RDB snapshots) - configured in docker-compose
# BGSAVE is called automatically
```

### 10. Security Checklist

- [ ] Set DEBUG=False
- [ ] Use strong SECRET_KEY (openssl rand -hex 32)
- [ ] Enable HTTPS/TLS with valid certificate
- [ ] Configure CORS to specific allowed origins
- [ ] Use managed database with encryption at rest
- [ ] Enable database connection encryption
- [ ] Use environment variables for all secrets
- [ ] Implement rate limiting (FastAPI slowdown)
- [ ] Set up firewall rules
- [ ] Enable audit logging
- [ ] Configure backup and disaster recovery
- [ ] Use strong database passwords
- [ ] Implement API key rotation
- [ ] Set up monitoring and alerting
- [ ] Regular security updates

### 11. Performance Tuning

```python
# Database connection pooling
SQLALCHEMY_POOL_SIZE=20
SQLALCHEMY_POOL_RECYCLE=3600
SQLALCHEMY_POOL_PRE_PING=True

# Celery optimization
CELERY_WORKER_PREFETCH_MULTIPLIER=1
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP=True
CELERY_BROKER_CONNECTION_MAX_RETRIES=10

# Uvicorn workers
# --workers = (2 × CPU count) + 1
# For 8 CPU: --workers 17
```

### 12. Disaster Recovery

```bash
# Restore from backup
gunzip < backup_YYYYMMDD.sql.gz | psql -U voxtranslate voxtranslate

# Verify database integrity
psql -U voxtranslate voxtranslate -c "SELECT COUNT(*) FROM jobs;"

# Recreate tables if needed
python -c "import asyncio; from app.db import create_tables; asyncio.run(create_tables())"
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Verify database connection: `psql -U voxtranslate voxtranslate`
3. Test Redis: `redis-cli ping`
4. Check Celery workers: `celery -A app.pipeline.tasks inspect active`
