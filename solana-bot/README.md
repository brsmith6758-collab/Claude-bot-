# Solana Trading Bot

A TypeScript trading bot for Solana that routes swaps through the [Jupiter](https://jup.ag) aggregator. Ships with two strategies (DCA and SMA momentum), stop-loss / take-profit risk management, and a dry-run mode.

## Features

- **Jupiter v6 integration** — best-price routing across all major Solana DEXes
- **DCA strategy** — buy a fixed amount at a fixed interval
- **Momentum strategy** — buy dips below a simple moving average, sell pumps above it
- **Risk management** — stop-loss, take-profit, max-trade cap, price-impact guard
- **Dry-run mode** — full simulation with real quotes, no transactions sent
- **Structured logging** — console + `logs/bot.log` + `logs/trades.log`

## Setup

```bash
cd solana-bot
npm install
cp .env.example .env
```

Edit `.env`:

1. Set `WALLET_PRIVATE_KEY` to a base58 private key (Phantom export) or a JSON byte array. **Use a dedicated hot wallet with only the funds you're willing to risk.**
2. Set `SOLANA_RPC_URL` to a dedicated RPC provider (Helius, QuickNode, Triton). The public endpoint is heavily rate-limited and will fail under load.
3. Choose `INPUT_MINT` / `OUTPUT_MINT` and `TRADE_SIZE`.
4. Pick a `STRATEGY` and tune its parameters.
5. Leave `DRY_RUN=true` until you've watched it behave the way you expect.

## Run

```bash
npm run dev      # ts-node, no build step
# or
npm run build && npm start
```

Stop with `Ctrl+C` — the bot finishes its current tick and exits cleanly.

## Strategies

### DCA (`STRATEGY=dca`)

Buys `TRADE_SIZE` of the input token every `DCA_INTERVAL_SEC` seconds. Never sells on its own; only stop-loss / take-profit close the position.

### Momentum (`STRATEGY=momentum`)

Polls price every `PRICE_INTERVAL_SEC` seconds and keeps a rolling SMA over `SMA_PERIOD` samples.

- **Buy** when price is `BUY_DIP_PCT`% or more below the SMA and no position is open
- **Sell** when price is `SELL_PUMP_PCT`% or more above the SMA and a position is open

The bot holds until the SMA is fully populated (`SMA_PERIOD × PRICE_INTERVAL_SEC` seconds).

## Risk controls

| Setting | Behaviour |
|---|---|
| `STOP_LOSS_PCT` | Sells the whole position if price falls this far below entry |
| `TAKE_PROFIT_PCT` | Sells the whole position if price rises this far above entry |
| `SLIPPAGE_BPS` | Max slippage passed to Jupiter (50 = 0.5%) |
| `MAX_TRADES` | Stops the bot after this many buys (0 = unlimited) |
| Price impact guard | Any buy with >5% price impact is skipped |

Risk checks run before the strategy on every tick, so they override strategy signals.

## Project layout

```
src/
├── index.ts          entry point, signal handling
├── bot.ts            main loop, position tracking, risk checks
├── config.ts         env parsing + validation
├── jupiter.ts        quote / price / swap execution
├── priceMonitor.ts   rolling price history + SMA
├── wallet.ts         keypair loading, balance queries
└── strategies/
    ├── types.ts      Strategy / Signal / Position interfaces
    ├── dca.ts
    ├── momentum.ts
    └── index.ts      strategy factory
```

## Adding a strategy

Implement the `Strategy` interface in `src/strategies/`, register it in `createStrategy()`, and add the name to `StrategyName` in `config.ts`.

```ts
export class MyStrategy implements Strategy {
  readonly name = 'mine';
  readonly pollIntervalMs = 10_000;
  evaluate(state: MarketState): Signal {
    return { action: 'hold', reason: '...' };
  }
}
```

## Disclaimer

This software is provided for educational purposes. Trading cryptocurrencies carries substantial risk. Test thoroughly in dry-run mode and on small amounts before committing real capital. You are solely responsible for any losses.
