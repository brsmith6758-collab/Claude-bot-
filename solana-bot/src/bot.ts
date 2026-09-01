import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Config } from './config';
import { executeSwap, getQuote } from './jupiter';
import { logger } from './logger';
import { PriceMonitor } from './priceMonitor';
import { createStrategy, Position, Signal, Strategy } from './strategies';
import { getMintDecimals, getSolBalance, getTokenBalance } from './wallet';

export class TradingBot {
  private readonly connection: Connection;
  private readonly monitor: PriceMonitor;
  private readonly strategy: Strategy;
  private position: Position | null = null;
  private tradeCount = 0;
  private running = false;
  private inputDecimals = 9;

  constructor(
    private readonly cfg: Config,
    private readonly wallet: Keypair,
  ) {
    this.connection = new Connection(cfg.rpcUrl, 'confirmed');
    this.monitor = new PriceMonitor(cfg.outputMint, cfg.inputMint, cfg.smaPeriod);
    this.strategy = createStrategy(cfg, this.monitor);
  }

  async start(): Promise<void> {
    this.running = true;
    await this.logStartup();

    const pollMs =
      this.cfg.strategy === 'momentum' ? this.cfg.priceIntervalSec * 1000 : Math.min(this.strategy.pollIntervalMs, 60_000);

    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        logger.error(`Tick failed: ${(err as Error).message}`);
      }
      await sleep(pollMs);
    }
  }

  stop(): void {
    logger.info('Stopping bot...');
    this.running = false;
  }

  private async logStartup(): Promise<void> {
    const owner = this.wallet.publicKey;
    this.inputDecimals = await getMintDecimals(this.connection, new PublicKey(this.cfg.inputMint));
    const sol = await getSolBalance(this.connection, owner);

    logger.info(`Wallet: ${owner.toBase58()}`);
    logger.info(`SOL balance: ${sol.toFixed(4)}`);
    logger.info(`Strategy: ${this.strategy.name} | Pair: ${this.cfg.inputMint.slice(0, 6)}… → ${this.cfg.outputMint.slice(0, 6)}…`);
    logger.info(`Trade size: ${this.cfg.tradeSize} | Slippage: ${this.cfg.slippageBps}bps`);
    logger.info(`Stop loss: ${this.cfg.stopLossPct}% | Take profit: ${this.cfg.takeProfitPct}%`);
    if (this.cfg.dryRun) logger.warn('DRY RUN mode: no transactions will be sent');
  }

  private async tick(): Promise<void> {
    const price = await this.monitor.update();
    const now = Date.now();

    const risk = this.checkRisk(price);
    const signal = risk ?? this.strategy.evaluate({ price, position: this.position, now });

    if (signal.action === 'hold') {
      logger.debug(`hold: ${signal.reason}`);
      return;
    }

    logger.info(`Signal: ${signal.action.toUpperCase()} — ${signal.reason}`);

    if (signal.action === 'buy') await this.buy(price);
    else await this.sell(price);
  }

  private checkRisk(price: number): Signal | null {
    if (!this.position) return null;
    const pnl = ((price - this.position.entryPrice) / this.position.entryPrice) * 100;

    if (pnl <= -this.cfg.stopLossPct) {
      return { action: 'sell', reason: `stop loss hit (${pnl.toFixed(2)}%)` };
    }
    if (pnl >= this.cfg.takeProfitPct) {
      return { action: 'sell', reason: `take profit hit (+${pnl.toFixed(2)}%)` };
    }
    return null;
  }

  private async buy(price: number): Promise<void> {
    if (this.cfg.maxTrades > 0 && this.tradeCount >= this.cfg.maxTrades) {
      logger.warn(`Max trades (${this.cfg.maxTrades}) reached; stopping.`);
      this.stop();
      return;
    }

    const amount = BigInt(Math.round(this.cfg.tradeSize * 10 ** this.inputDecimals));
    const quote = await getQuote(this.cfg.inputMint, this.cfg.outputMint, amount);
    const impact = Number(quote.priceImpactPct) * 100;

    logger.info(`Quote: ${quote.inAmount} → ${quote.outAmount} (impact ${impact.toFixed(3)}%)`);
    if (impact > 5) {
      logger.warn('Price impact > 5%, skipping buy');
      return;
    }

    let outAmount = BigInt(quote.outAmount);
    if (this.cfg.dryRun) {
      logger.info('[DRY RUN] would execute buy');
    } else {
      const result = await executeSwap(this.connection, this.wallet, quote);
      outAmount = result.outAmount;
      logger.info(`BUY confirmed: https://solscan.io/tx/${result.signature}`);
    }

    this.tradeCount++;
    if (this.position) {
      const oldTokens = Number(this.position.tokenAmount);
      const newTokens = Number(outAmount);
      const totalTokens = oldTokens + newTokens;
      this.position = {
        entryPrice: (this.position.entryPrice * oldTokens + price * newTokens) / totalTokens,
        tokenAmount: this.position.tokenAmount + outAmount,
        inputSpent: this.position.inputSpent + amount,
        openedAt: this.position.openedAt,
      };
    } else {
      this.position = { entryPrice: price, tokenAmount: outAmount, inputSpent: amount, openedAt: Date.now() };
    }
    logger.info(`Position: ${this.position.tokenAmount} tokens, entry ${this.position.entryPrice.toFixed(6)}`);
  }

  private async sell(price: number): Promise<void> {
    if (!this.position) return;

    let amount = this.position.tokenAmount;
    if (!this.cfg.dryRun) {
      const bal = await getTokenBalance(this.connection, this.wallet.publicKey, new PublicKey(this.cfg.outputMint));
      amount = bal.amount < amount ? bal.amount : amount;
    }
    if (amount === 0n) {
      logger.warn('No tokens to sell; clearing position');
      this.position = null;
      return;
    }

    const quote = await getQuote(this.cfg.outputMint, this.cfg.inputMint, amount);
    const pnl = ((price - this.position.entryPrice) / this.position.entryPrice) * 100;

    if (this.cfg.dryRun) {
      logger.info(`[DRY RUN] would sell ${amount} tokens for ${quote.outAmount} (PnL ${pnl.toFixed(2)}%)`);
    } else {
      const result = await executeSwap(this.connection, this.wallet, quote);
      logger.info(`SELL confirmed: https://solscan.io/tx/${result.signature} (PnL ${pnl.toFixed(2)}%)`);
    }

    this.position = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
