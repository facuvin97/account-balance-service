import { z } from 'zod';

// Regex: dígitos, punto decimal opcional, máximo 2 decimales
const amountString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a positive number with up to 2 decimals')
  .refine((v) => parseFloat(v) > 0, 'Must be greater than zero');

const uuidParam = z.object({
  accountId: z.string().uuid(),
});

// POST /accounts/:accountId/deposits
export const depositSchema = {
  params: uuidParam,
  body: z.object({ amount: amountString }),
};

// POST /accounts/:accountId/withdrawals
export const withdrawalSchema = {
  params: uuidParam,
  body: z.object({ amount: amountString }),
};

// POST /transfers
export const transferSchema = {
  body: z.object({
    sourceAccountId: z.string().uuid(),
    destinationAccountId: z.string().uuid(),
    amount: amountString,
    memo: z
      .string()
      .max(500)
      .nullish()
      .transform((v) => v ?? null),
  }),
};

// GET /accounts/:accountId/balance
export const balanceSchema = {
  params: uuidParam,
};

// GET /accounts/:accountId/ledger-entries
export const ledgerEntriesSchema = {
  params: uuidParam,
  query: z.object({
    page: z.string().optional().default('1').transform(Number).pipe(z.number().int().min(1)),
    pageSize: z
      .string()
      .optional()
      .default('20')
      .transform(Number)
      .pipe(z.number().int().min(1))
      .transform((v) => Math.min(v, 100)),
  }),
};
