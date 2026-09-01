import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import { config } from './config';
import { logger } from './logger';

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
}

export interface SwapResult {
  signature: string;
  inAmount: bigint;
  outAmount: bigint;
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  slippageBps = config.slippageBps,
): Promise<JupiterQuote> {
  const { data } = await axios.get<JupiterQuote>(`${config.jupiterApi}/quote`, {
    params: {
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps,
      onlyDirectRoutes: false,
    },
    timeout: 10_000,
  });
  return data;
}

export async function getPrice(mint: string, vsToken?: string): Promise<number> {
  const { data } = await axios.get(config.jupiterPriceApi, {
    params: { ids: mint, ...(vsToken ? { vsToken } : {}) },
    timeout: 10_000,
  });
  const entry = data?.data?.[mint];
  if (!entry?.price) throw new Error(`No price returned for ${mint}`);
  return Number(entry.price);
}

export async function executeSwap(
  connection: Connection,
  wallet: Keypair,
  quote: JupiterQuote,
): Promise<SwapResult> {
  const { data } = await axios.post(
    `${config.jupiterApi}/swap`,
    {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    },
    { timeout: 15_000 },
  );

  const tx = VersionedTransaction.deserialize(Buffer.from(data.swapTransaction, 'base64'));
  tx.sign([wallet]);

  const latest = await connection.getLatestBlockhash('confirmed');
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  logger.info(`Sent swap tx ${signature}, awaiting confirmation...`);

  const result = await connection.confirmTransaction(
    { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    'confirmed',
  );

  if (result.value.err) {
    throw new Error(`Swap failed on-chain: ${JSON.stringify(result.value.err)}`);
  }

  return {
    signature,
    inAmount: BigInt(quote.inAmount),
    outAmount: BigInt(quote.outAmount),
  };
}
