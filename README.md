# ethereal-news-tools

Tools for Ethereum news and information gathering.

## Ethereum Client Release Checker

Checks GitHub for the latest releases of Ethereum execution and consensus layer clients, showing release dates and summaries from the last 7 days.

### Clients Monitored

- **Execution Layer**: Geth, Erigon, Nethermind, Besu, Reth
- **Consensus Layer**: Prysm, Lighthouse, Teku, Nimbus, Lodestar, Grandine

### Usage

```bash
npm install
npm run check-clients
```

Or directly:
```bash
node scripts/check-client-releases.js
```

## Ethereum Dev Tools Release Checker

Checks GitHub for the latest releases of Ethereum development tools (testing frameworks, libraries, compilers, etc.), showing release dates and summaries from the last 7 days.

Monitors 50+ development tools including Foundry, Hardhat, OpenZeppelin, Viem, Wagmi, and more.

### Usage

```bash
npm run check-dev-tools
```

Or directly:
```bash
node scripts/check-dev-tools-releases.js
```

### Setup (Optional)

Create a `.env` file with a GitHub token for higher rate limits (5,000 vs 60 requests/hour):

```
GITHUB_TOKEN=your_github_token_here
```

Get a token at: https://github.com/settings/tokens

### License

MIT
