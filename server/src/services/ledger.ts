import type { TxType } from "@prisma/client";
import type { Tx } from "../lib/db";
import { conflict } from "../lib/http";

/**
 * Moves coins on a user's balance and writes the matching history line.
 * Debits are conditional on the balance so concurrent wagers can never overdraw.
 */
export async function applyBalanceChange(
  tx: Tx,
  opts: { userId: string; amount: number; type: TxType; betId?: string; note?: string },
): Promise<number> {
  const { userId, amount } = opts;
  if (amount < 0) {
    const res = await tx.user.updateMany({
      where: { id: userId, balance: { gte: -amount } },
      data: { balance: { decrement: -amount } },
    });
    if (res.count === 0) throw conflict("Solde insuffisant.");
  } else if (amount > 0) {
    await tx.user.update({ where: { id: userId }, data: { balance: { increment: amount } } });
  }
  const { balance } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
  await tx.transaction.create({
    data: { userId, amount, type: opts.type, betId: opts.betId, note: opts.note, balanceAfter: balance },
  });
  return balance;
}
