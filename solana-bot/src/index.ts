import { TradingBot } from './bot';
import { config } from './config';
import { logger } from './logger';
import { loadKeypair } from './wallet';

async function main(): Promise<void> {
  const wallet = loadKeypair(config.privateKey);
  const bot = new TradingBot(config, wallet);

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}`);
    bot.stop();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start();
  logger.info('Bot exited cleanly');
}

main().catch((err) => {
  logger.error(`Fatal: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
