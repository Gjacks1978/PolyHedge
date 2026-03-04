# LP Hedge Simulator

Simulador completo de estratégia LP ETH/USDC com hedge em Put e aposta Polymarket.

## Funcionalidades

- **Aba 1 — Put como Seguro:** Simula hedge com opções Put (Black-Scholes)
- **Aba 2 — Aposta Polymarket:** Odds ao vivo + otimizador de timing
- **Aba 3 — 4 Cenários:** Visualização animada dos cenários de mercado

## Deploy no Vercel (recomendado)

### Pré-requisitos
- Node.js 18+ instalado
- Conta gratuita no [vercel.com](https://vercel.com)

### Passo a passo

```bash
# 1. Instala o Vercel CLI
npm install -g vercel

# 2. Entra na pasta do projeto
cd lp-simulator

# 3. Instala dependências
npm install

# 4. Testa localmente
npm start
# Abre em http://localhost:3000

# 5. Faz o deploy
vercel

# Siga as instruções:
# - Set up and deploy? Y
# - Which scope? (escolha sua conta)
# - Link to existing project? N
# - Project name: lp-simulator (ou o nome que quiser)
# - Directory: ./
# - Override settings? N

# 6. Deploy de produção
vercel --prod
```

Após o deploy, você receberá um link público tipo:
`https://lp-simulator-seuuser.vercel.app`

## Deploy alternativo: Netlify (drag and drop)

```bash
# 1. Gera o build
npm run build

# 2. Acessa netlify.com/drop
# 3. Arrasta a pasta /build para o browser
# 4. Link público gerado na hora
```

## Estrutura do projeto

```
lp-simulator/
├── src/
│   └── App.jsx          ← Simulador completo
├── api/
│   └── polymarket.js    ← Proxy serverless para API Polymarket
├── public/
│   └── index.html
├── vercel.json          ← Configuração Vercel
└── package.json
```

## API Polymarket

O arquivo `api/polymarket.js` é uma Vercel Serverless Function que:
- Faz proxy para `gamma-api.polymarket.com`
- Resolve problema de CORS do browser
- Filtra mercados ETH semanais automaticamente
- Auto-refresh a cada 60 segundos no simulador

## Atualizações futuras

Para atualizar o simulador após publicado:

```bash
# Edita os arquivos localmente
# Depois:
vercel --prod
```
