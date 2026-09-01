import { Config } from '../config';
import { PriceMonitor } from '../priceMonitor';
import { DcaStrategy } from './dca';
import { MomentumStrategy } from './momentum';
import { Strategy } from './types';

export * from './types';

export function createStrategy(cfg: Config, monitor: PriceMonitor): Strategy {
  switch (cfg.strategy) {
    case 'dca':
      return new DcaStrategy(cfg.dcaIntervalSec);
    case 'momentum':
      return new MomentumStrategy(monitor, cfg.priceIntervalSec, cfg.buyDipPct, cfg.sellPumpPct);
  }
}
