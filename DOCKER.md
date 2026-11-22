# TechSearch com Docker Compose

## Primeiro uso

```bash
cd /home/ubuntu/techsearch
cp .env.docker.example .env
# edite POSTGRES_PASSWORD e JWT_SECRET

docker compose up -d --build
```

A interface fica em `http://localhost:8080`. O Nginx serve o React e encaminha `/api/*` e `/health` para o serviço Express. O banco PostgreSQL usa o volume nomeado `techsearch-postgres-data`.

## Operação

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f frontend
docker compose exec api npx prisma migrate deploy
docker compose down
```

`docker compose down` mantém os dados. Para apagar também o banco local, use `docker compose down -v` conscientemente.

## Serviços

| Serviço | Função | Porta |
|---|---|---|
| `db` | PostgreSQL 16 | somente rede interna |
| `api` | Express, Prisma, scraping e alertas | somente rede interna |
| `frontend` | Nginx + React + proxy `/api` | `8080` |

O container da API aguarda o healthcheck do PostgreSQL, aplica migrations com `prisma migrate deploy` e só então inicia o servidor. O frontend aguarda a readiness da API.
