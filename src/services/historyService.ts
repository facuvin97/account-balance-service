import { accountRepository } from '../repositories/accountRepository';
import { ledgerEntryRepository } from '../repositories/ledgerEntryRepository';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { LedgerEntryType } from '../database/models/LedgerEntry';
import { Transfer } from '../database/models/Transfer';

export interface LedgerEntryDTO {
  id: string;
  amount: string;
  type: LedgerEntryType;
  memo: string | null;
  createdAt: Date;
}

export interface HistoryResult {
  entries: LedgerEntryDTO[];
  total: number;
  page: number;
  pageSize: number;
}

// Historial paginado con memo de la transfer asociada (sin datos de la contraparte)
export async function getHistory(
  userId: string,
  accountId: string,
  page: number,
  pageSize: number,
): Promise<HistoryResult> {
  const account = await accountRepository.findById(accountId);
  if (!account) throw new NotFoundError('Account not found');
  if (account.userId !== userId) throw new ForbiddenError('Account does not belong to user');

  const offset = (page - 1) * pageSize;
  const { rows, count } = await ledgerEntryRepository.findByAccountPaginated(
    accountId,
    pageSize,
    offset,
  );

  // Solo exponer memo de la transferencia, nunca el accountId de la contraparte
  const entries: LedgerEntryDTO[] = rows.map((entry) => {
    const relatedTransfer = entry.get('relatedTransfer') as Transfer | null;

    return {
      id: entry.id,
      amount: entry.amount,
      type: entry.type,
      memo: relatedTransfer?.memo ?? null,
      createdAt: entry.createdAt,
    };
  });

  return { entries, total: count, page, pageSize };
}
