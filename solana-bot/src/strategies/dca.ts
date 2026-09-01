import { MarketState, Signal, Strategy } from './types';

export class DcaStrategy implements Strategy {
  readonly name = 'dca';
  readonly pollIntervalMs: number;
  private lastBuyAt = 0;

  constructor(intervalSec: number) {
    this.pollIntervalMs = intervalSec * 1000;
  }

  evaluate(state: MarketState): Signal {
    if (state.now - this.lastBuyAt < this.pollIntervalMs) {
      return { action: 'hold', reason: 'waiting for next DCA interval' };
    }
    this.lastBuyAt = state.now;
    return { action: 'buy', reason: `scheduled DCA buy at ${state.price.toFixed(6)}` };
  }
}
