export type Action = 'buy' | 'sell' | 'hold';

export interface Signal {
  action: Action;
  reason: string;
}

export interface Position {
  entryPrice: number;
  tokenAmount: bigint;
  inputSpent: bigint;
  openedAt: number;
}

export interface MarketState {
  price: number;
  position: Position | null;
  now: number;
}

export interface Strategy {
  readonly name: string;
  readonly pollIntervalMs: number;
  evaluate(state: MarketState): Signal;
}
