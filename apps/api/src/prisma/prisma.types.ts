/**
 * Type helpers for Prisma 6.x transaction clients
 *
 * In Prisma 6.x, when extending PrismaClient, the transaction callback type
 * loses model delegates. This file provides proper typing for transaction clients.
 */

import { PrismaClient } from '../generated/prisma/client';

/**
 * Type for the transaction client in interactive transactions.
 * This provides proper typing for all model delegates within $transaction callbacks.
 */
export type TransactionClient = Omit<
  PrismaClient<never, never>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
