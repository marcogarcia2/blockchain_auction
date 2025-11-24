# Blockchain Auction
Aplicação descentralizada (DApp) que permite criar e acompanhar leilões na rede Ethereum utilizando os contratos inteligentes `Registry.sol` e `Auction.sol`.

- Marco Antonio Gaspar Garcia **(11833581)**
- Prof. Dr. Jó Ueyama

## Pré-requisitos
- Node.js 18+ e npm instalados.
- Carteira compatível com Ethereum (ex.: MetaMask) conectada à rede onde os contratos foram implantados.
- RPC da rede configurado na carteira (Hardhat, Sepolia, etc.).

## Passo a passo para rodar a DApp
1. Instale as dependências do frontend:
   ```bash
   cd auction-dapp
   npm install
   ```
2. Configure o endereço do contrato `Registry` no arquivo `auction-dapp/src/shared.ts` (constante `REGISTRY_ADDRESS`). Se você gerar novos ABIs, substitua os arquivos em `auction-dapp/src/abi-*.json`.
3. Inicie o servidor de desenvolvimento da Vite:
   ```bash
   npm run dev
   ```
4. Abra o endereço indicado pelo Vite (geralmente `http://127.0.0.1:5173`) no navegador, conecte sua carteira e teste os leilões.

