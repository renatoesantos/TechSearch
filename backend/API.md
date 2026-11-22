# TechSearch API

Backend do TechSearch — rastreamento e histórico de preços de hardware no Brasil.

**Stack:** Node.js 20+ · TypeScript · Express 4 · Prisma 6 · PostgreSQL · Zod · JWT · bcrypt

## Estrutura

```
backend/
├── prisma/
│   └── schema.prisma          # modelagem completa do banco
└── src/
    ├── app.ts                 # monta o Express (helmet, CORS, rate limit, rotas)
    ├── server.ts              # listen + graceful shutdown
    ├── config/env.ts          # variáveis de ambiente validadas com Zod
    ├── lib/
    │   ├── prisma.ts          # PrismaClient singleton
    │   ├── jwt.ts             # assinatura/verificação (HS256, 24h estritas)
    │   ├── password.ts        # bcrypt (custo 12) + hash descartável anti-timing
    │   ├── errors.ts          # AppError com status HTTP e código
    │   └── token-denylist.ts  # revogação de tokens (logout)
    ├── middleware/
    │   ├── auth.ts            # requireAuth (JWT + denylist + conta ativa)
    │   ├── rate-limit.ts      # limiters global, login, cadastro e reset
    │   ├── validate.ts        # validação de body com Zod
    │   └── error-handler.ts   # tratamento central de erros
    ├── schemas/auth.schema.ts # contratos de entrada
    ├── services/
    │   ├── auth.service.ts    # regras de cadastro/login/recuperação
    │   └── mail.service.ts    # envio de e-mail (SMTP ou log em dev)
    ├── scrapers/               # Puppeteer + Cheerio + adapters por loja
    ├── workers/                # ciclo isolado + node-cron 2x/dia
    ├── routes/
    │   ├── auth.routes.ts
    │   ├── health.routes.ts
    │   ├── catalog.routes.ts
    │   ├── wishlist.routes.ts
    │   ├── alert.routes.ts
    │   └── profile.routes.ts
    ├── types/express.d.ts     # tipagem de req.auth / req.user
    └── utils/                 # logger JSON e asyncHandler
```

## Como rodar

```bash
cd backend
cp .env.example .env
# Configure DATABASE_URL e JWT_SECRET no arquivo .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Endpoints

| Método | Rota | Auth | Rate limit | Descrição |
|---|---|---|---|---|
| GET | `/health` | — | global | Liveness |
| GET | `/health/ready` | — | global | Readiness (ping no banco) |
| POST | `/api/auth/register` | — | 20/h por IP | Cadastro; retorna token |
| POST | `/api/auth/login` | — | 10 falhas/15min por IP | Login; retorna token |
| POST | `/api/auth/logout` | Bearer | global | Revoga o token atual (204) |
| GET | `/api/auth/me` | Bearer | global | Dados da conta |
| POST | `/api/auth/forgot-password` | — | 5/15min por IP | Envia link (sempre 202) |
| POST | `/api/auth/reset-password` | — | 5/15min por IP | Troca senha com token |

Rate limit global: **120 requisições/minuto por IP**.

## Scraper

O scheduler inicia junto com a API e executa `0 0,12 * * *` em UTC (00:00 e 12:00, duas vezes ao dia). Para executar um ciclo manual:

```bash
npm run scraper:run
```

Cada loja é processada dentro de um bloco `try/catch` independente. Cada oferta também possui isolamento próprio: falha de uma URL registra `ProductOffer.lastError`, incrementa `offersFailed` em `ScraperRun` e não interrompe as próximas ofertas/lojas.

O browser é Puppeteer; o HTML renderizado é entregue ao Cheerio. Os adaptadores só aceitam preço associado explicitamente a Pix/Boleto e salvam `NULL` quando a página sinaliza falta de estoque. O histórico usa `upsert` por `(produto, loja, dia UTC)`, portanto as duas execuções diárias não criam pontos duplicados.

Em produção, configure `SCRAPER_USER_AGENT`, respeite os termos/robots de cada loja e use Redis/uma fila dedicada se a aplicação tiver múltiplas instâncias. O lock atual evita sobreposição dentro de um único processo.

## Alertas de preço

O `price-alert.service.ts` é executado ao final de cada ciclo de scraping e também pelo scheduler de segurança a cada 15 minutos (`*/15 * * * *`, UTC). Para cada alerta ativo, ele seleciona a menor oferta em estoque, compara com `targetPrice` e envia e-mail somente quando o preço é menor ou igual ao alvo.

O cooldown é de **7 dias por usuário/produto**. A reserva do envio usa `updateMany` condicional dentro de uma transação: mesmo que duas instâncias rodem simultaneamente, apenas uma consegue atualizar `lastNotifiedAt` e criar a `Notification`. O envio fica auditado com status `PENDING`, `SENT` ou `FAILED`; se o SMTP falhar, o alerta é liberado novamente para retry.

## API de catálogo e dados do usuário

O catálogo público está disponível em `GET /api/products` com `q`, `category`, `page` e `limit`, e em `GET /api/products/:id`. As respostas já convertem valores `Decimal` do PostgreSQL para números JSON e incluem ofertas ativas, estoque e histórico diário.

As rotas `GET|POST|PATCH|DELETE /api/wishlists` e `/api/wishlists/:id/items` exigem `Authorization: Bearer <token>` e validam que cada lista pertence ao usuário autenticado. `GET|POST|PATCH|DELETE /api/alerts` implementa o mesmo isolamento e usa a chave única `(userId, productId)` para criar ou atualizar o alerta sem duplicação. `DELETE /api/profile` executa a exclusão lógica da conta, preservando a auditoria para a janela de purga posterior.

Para executar tudo via Docker Compose, consulte `../DOCKER.md`.

### Exemplos

```bash
# Cadastro
curl -X POST http://localhost:3333/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza","email":"ana@example.com","password":"senhaSegura123"}'

# Login
curl -X POST http://localhost:3333/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"senhaSegura123"}'

# Rota protegida
curl http://localhost:3333/api/auth/me -H "Authorization: Bearer $TOKEN"
```

## Formato de erro

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos.", "details": [{ "field": "email", "message": "Informe um e-mail válido." }] } }
```

## Decisões de segurança

- **JWT 24h estritas** (`expiresIn: 24h` + `maxAge` na verificação), HS256, com `issuer`/`audience`.
- **Logout real** via denylist de `jti` até o `exp`. Em múltiplas instâncias, trocar por Redis.
- **Troca de senha invalida sessões**: `User.passwordChangedAt` é comparado com o `iat` do token.
- **Senhas**: bcrypt custo 12, 8–72 caracteres, ao menos 1 letra e 1 número.
- **Anti-enumeração**: login usa hash descartável quando o e-mail não existe; `forgot-password` sempre responde 202.
- **Tokens de recuperação**: 32 bytes aleatórios, só o SHA-256 fica no banco, validade de 60 min, uso único.
- **Conta excluída (soft delete)** perde acesso imediatamente, pois o `requireAuth` consulta `deletedAt`.

## Testes automatizados

Execute todos os testes E2E:

npm run test:e2e

Testes individuais:

npm run test:e2e:auth
npm run test:e2e:api
npm run test:e2e:alerts
npm run test:e2e:scraper

Os testes utilizam NODE_ENV=test e um banco PostgreSQL
configurado por meio de DATABASE_URL.

O teste de scraping requer um navegador Chrome compatível
com a versão do Puppeteer instalada.

## Próximos passos

1. Validar a execução das migrations em um banco de dados limpo.
2. Executar e validar os testes de integração da API.
3. Validar o funcionamento completo dos workers e agendadores.
4. Verificar o tratamento de falhas durante o scraping.
5. Validar o envio de e-mails e o funcionamento dos alertas.
6. Revisar a integração entre frontend e backend.
7. Aprimorar os testes automatizados e a documentação técnica.
