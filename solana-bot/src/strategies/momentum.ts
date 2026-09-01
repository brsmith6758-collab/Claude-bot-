import { PriceMonitor } from '../priceMonitor';
import { MarketState, Signal, Strategy } from './types';

export class MomentumStrategy implements Strategy {
  readonly name = 'momentum';
  readonly pollIntervalMs: number;

  constructor(
    private readonly monitor: PriceMonitor,
    intervalSec: number,
    private readonly buyDipPct: number,
    private readonly sellPumpPct: number,
  ) {
    this.pollIntervalMs = intervalSec * 1000;
  }

  evaluate(state: MarketState): Signal {
    if (!this.monitor.isWarm) {
      return {
        action: 'hold',
        reason: `warming up SMA (${this.monitor.sampleCount} samples)`,
      };
    }

    const deviation = this.monitor.pctFromSma();
    if (deviation === undefined) return { action: 'hold', reason: 'no SMA available' };

    const sma = this.monitor.sma()!;
    const detail = `price ${state.price.toFixed(6)} vs SMA ${sma.toFixed(6)} (${deviation.toFixed(2)}%)`;

    if (!state.position && deviation <= -this.buyDipPct) {
      return { action: 'buy', reason: `dip below SMA: ${detail}` };
    }
    if (state.position && deviation >= this.sellPumpPct) {
      return { action: 'sell', reason: `pump above SMA: ${detail}` };
    }
    return { action: 'hold', reason: detail };
  }
}
