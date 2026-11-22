# TechSearch Web

Frontend React + Vite + TypeScript + Tailwind CSS + Recharts para o TechSearch.

## Rodar

```bash
cd frontend
npm install
npm run dev
```

O Vite abre em `http://localhost:5173` e faz proxy de `/api` e `/health` para `http://localhost:3333`.

## Modo demonstração

Como os endpoints de catálogo, listas e alertas ainda serão criados no backend, o frontend inicia em modo demonstração quando `VITE_API_URL` está vazio. Produtos, listas e alertas são persistidos em `localStorage`, então a interface pode ser avaliada e usada sem banco adicional.

Para apontar para a API:

```bash
cp .env.example .env
# defina VITE_API_URL=http://localhost:3333
npm run dev
```

## Telas

- Visão geral: métricas, quedas recentes e listas salvas.
- Catálogo: busca, filtros por categoria e cards de produtos.
- Produto: ficha técnica, ofertas atuais por loja, gráfico histórico e meta de preço.
- Minhas listas: montagens, itens, metas e total estimado.
- Alertas: status, menor oferta atual, preço alvo e cooldown.
- Perfil: edição visual e confirmação de exclusão.
