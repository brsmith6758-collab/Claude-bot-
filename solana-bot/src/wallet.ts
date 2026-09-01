import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export function loadKeypair(secret: string): Keypair {
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    const bytes = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

export async function getSolBalance(connection: Connection, owner: PublicKey): Promise<number> {
  const lamports = await connection.getBalance(owner);
  return lamports / LAMPORTS_PER_SOL;
}

export async function getTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<{ amount: bigint; decimals: number; uiAmount: number }> {
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
    mint,
    programId: TOKEN_PROGRAM_ID,
  });

  let amount = 0n;
  let decimals = 0;
  for (const { account } of accounts.value) {
    const info = account.data.parsed.info.tokenAmount;
    amount += BigInt(info.amount);
    decimals = info.decimals;
  }

  return { amount, decimals, uiAmount: Number(amount) / 10 ** decimals };
}

export async function getMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const info = await connection.getParsedAccountInfo(mint);
  const data = info.value?.data;
  if (!data || !('parsed' in data)) throw new Error(`Could not read mint ${mint.toBase58()}`);
  return data.parsed.info.decimals as number;
}
