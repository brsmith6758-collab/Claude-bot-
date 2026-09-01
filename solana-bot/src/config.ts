import * as dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${key} must be a number, got "${raw}"`);
  return parsed;
}

export type StrategyName = 'dca' | 'momentum';

const strategy = (process.env.STRATEGY ?? 'dca') as StrategyName;
if (strategy !== 'dca' && strategy !== 'momentum') {
  throw new Error(`STRATEGY must be "dca" or "momentum", got "${strategy}"`);
}

export const config = {
  rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  privateKey: required('WALLET_PRIVATE_KEY'),

  inputMint: process.env.INPUT_MINT ?? 'So11111111111111111111111111111111111111112',
  outputMint: process.env.OUTPUT_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  tradeSize: num('TRADE_SIZE', 0.01),

  strategy,
  dcaIntervalSec: num('DCA_INTERVAL_SEC', 300),
  priceIntervalSec: num('PRICE_INTERVAL_SEC', 10),
  smaPeriod: num('SMA_PERIOD', 20),
  buyDipPct: num('BUY_DIP_PCT', 2),
  sellPumpPct: num('SELL_PUMP_PCT', 3),

  slippageBps: num('SLIPPAGE_BPS', 50),
  stopLossPct: num('STOP_LOSS_PCT', 10),
  takeProfitPct: num('TAKE_PROFIT_PCT', 20),
  maxTrades: num('MAX_TRADES', 0),

  dryRun: (process.env.DRY_RUN ?? 'true').toLowerCase() === 'true',

  jupiterApi: 'https://quote-api.jup.ag/v6',
  jupiterPriceApi: 'https://api.jup.ag/price/v2',
};

export type Config = typeof config;
