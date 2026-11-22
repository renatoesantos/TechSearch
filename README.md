
# TechSearch

**Sistema Web de Monitoramento e Comparação de Preços de Componentes de Hardware.**

O TechSearch é um projeto acadêmico desenvolvido com o objetivo de facilitar a pesquisa e a comparação de preços de componentes de hardware em diferentes lojas.

## Objetivo

Centralizar informações de produtos e ofertas, permitindo acompanhar preços e apoiar decisões de compra.

## Funcionalidades

- Catálogo de produtos de hardware.
- Consulta e comparação de ofertas.
- Monitoramento e histórico de preços.
- Listas de desejos.
- Alertas de preços.
- Indicadores e gráficos.
- Coleta automatizada de informações de lojas.

*As funcionalidades estão em desenvolvimento e podem apresentar diferentes níveis de integração.*

## Tecnologias

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

### Outros recursos
- Docker e Docker Compose
- Puppeteer e Cheerio
- JWT e bcrypt
- Zod
- Socket/HTTP e integração com API REST

## Estrutura do projeto

```text
TechSearch/
├── backend/
│   ├── prisma/
│   ├── scripts/
│   └── src/
├── frontend/
│   └── src/
├── docker-compose.yml
├── .env.docker.example
├── DOCKER.md
└── README.md
```

## Como executar com Docker

1. Clone o repositório.
2. Copie `.env.docker.example` para `.env`.
3. Configure as variáveis de ambiente, principalmente a senha do PostgreSQL e o segredo JWT.
4. Execute:

```bash
docker compose up -d --build
```

Acesse o frontend:

http://localhost:8080

Consulte o arquivo [DOCKER.md](DOCKER.md) para obter instruções adicionais.

## Testes automatizados

Os testes E2E do backend podem ser executados com:

```bash
cd backend
npm install
npm run test:e2e
```

É necessário configurar o PostgreSQL e as variáveis de ambiente conforme o arquivo `backend/.env.example`. O teste de scraping também requer um navegador compatível com a versão do Puppeteer instalada.

## Status

Projeto acadêmico em desenvolvimento.

## Licença

Projeto desenvolvido para fins acadêmicos.
