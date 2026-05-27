# Bot de Ofertas de Informática

Bot do Discord para monitorar ofertas de informática, hardware, periféricos e itens diretamente ligados a PC, notebook, rede e setup produtivo, publicando embeds permanentes em um canal do Discord.

## Relatório de pesquisa

### Fontes recomendadas

| Loja/fonte | Nível de suporte | Método recomendado |
|---|---:|---|
| Mercado Livre | Fonte inicial confiável | Endpoint público de busca |
| Kalunga | Fonte inicial confiável | Páginas públicas de busca |
| Terabyte | Fonte forte de hardware | Páginas públicas de promoções/categorias |

### Por que essas fontes

Páginas de varejo brasileiras mudam o HTML com frequência e costumam usar proteção contra bots. Para manter o bot confiável, a base inicial usa apenas fontes estáveis que funcionam sem credenciais ocultas ou scraping extremamente frágil.

### Limitações

- Os preços mudam rapidamente.
- O armazenamento JSON pode ser perdido se `data/deals.json` for apagado.
- Render Web Service + UptimeRobot funciona bem para hobby, mas não garante disponibilidade de produção.
- O UptimeRobot pode manter o endpoint Express aquecido, mas não garante estabilidade do gateway do Discord.
- Não publique produtos com preço pouco claro ou descontos inventados.

## Plano de implementação

O bot usa:

- Node.js
- discord.js
- Express
- Axios
- Cheerio para parsing de catálogo
- node-cron
- Armazenamento JSON

## Melhorias de busca

A busca agora é focada em informática e hardware diretamente ligados ao PC: SSDs, RAM, placas-mãe, processadores, GPUs, fontes, monitores, teclados, mouses, headsets, microfones, webcams, hubs USB, placas de captura, rede, impressoras, notebooks e itens similares.
Kalunga e Terabyte estão incluídas como fontes sempre ativas, então o bot passa a consultar mais catálogos grandes sem precisar de credenciais.
A taxonomia do produto fica centralizada em `utils/dealTaxonomy.js`, o que mantém palavras-chave e categorias organizadas em vez de espalhadas pelo código.

O bot agora publica produtos com desconto percentual explícito e também pode mostrar o menor preço encontrado entre ofertas semelhantes para comparação.
Se você quiser mais resultados, reduza `MIN_DISCOUNT_PERCENT`.

## Configuração

### Variáveis de ambiente do Render

Adicione:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
CHANNEL_ID=
CHECK_INTERVAL_MINUTES=30
MAX_POSTS_PER_CHECK=10
MIN_DISCOUNT_PERCENT=1
MAX_PRICE=
PORT=3000
```

### Desenvolvimento local

```bash
npm install
npm run register
npm start
```

### UptimeRobot

Monitore:

```text
https://your-render-url.onrender.com/health
```

Use intervalo de 5 minutos no plano gratuito.

### GitHub

Não faça commit de `.env` nem de `data/deals.json`.

Commitar:

- `.env.example`
- `data/.gitkeep`
- todos os arquivos fonte

## Comandos slash

- `/deals`
- `/forcecheck`
- `/refreshdeals`
- `/status`
- `/filters`

## Checklist de testes

- O bot faz login no Discord.
- Os comandos slash são registrados.
- `/health` retorna JSON.
- `/forcecheck` roda sem travar.
- Ofertas duplicadas não são republicadas.
- O mesmo produto com preço menor pode entrar como nova oferta.
- `.env` não é commitado.
- As variáveis do Render estão configuradas.
- O UptimeRobot monitora `/health`.

## Erros comuns

| Erro | Causa | Correção |
|---|---|---|
| Variável de ambiente ausente | Variável faltando no Render | Adicione a variável ausente |
| Token inválido | Token do bot errado | Gere um novo token no Discord Developer Portal |
| Acesso ausente | Bot sem permissão no canal | Conceda Send Messages, Embed Links e Use Application Commands |
| Nenhuma oferta publicada | Filtros rígidos demais | Reduza `MIN_DISCOUNT_PERCENT` ou ajuste as palavras-chave |
| Scraping retorna 0 | Loja bloqueou ou mudou o HTML | Mantenha o scraping desligado ou atualize os seletores |
| Posts duplicados após reset | `data/deals.json` foi apagado | Restaure o backup ou aceite um histórico novo |
