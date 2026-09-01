import { getPrice } from './jupiter';

export class PriceMonitor {
  private history: number[] = [];

  constructor(
    private readonly mint: string,
    private readonly vsMint: string,
    private readonly maxSamples: number,
  ) {}

  async update(): Promise<number> {
    const price = await getPrice(this.mint, this.vsMint);
    this.history.push(price);
    if (this.history.length > this.maxSamples) this.history.shift();
    return price;
  }

  get latest(): number | undefined {
    return this.history[this.history.length - 1];
  }

  get sampleCount(): number {
    return this.history.length;
  }

  get isWarm(): boolean {
    return this.history.length >= this.maxSamples;
  }

  sma(): number | undefined {
    if (this.history.length === 0) return undefined;
    const sum = this.history.reduce((a, b) => a + b, 0);
    return sum / this.history.length;
  }

  pctFromSma(): number | undefined {
    const avg = this.sma();
    const current = this.latest;
    if (avg === undefined || current === undefined || avg === 0) return undefined;
    return ((current - avg) / avg) * 100;
  }
}
