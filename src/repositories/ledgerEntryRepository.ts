import { Transaction } from 'sequelize';
import { LedgerEntry, LedgerEntryCreationAttributes } from '../database/models/LedgerEntry';

export const ledgerEntryRepository = {
  async create(
    data: LedgerEntryCreationAttributes,
    transaction: Transaction,
  ): Promise<LedgerEntry> {
    return LedgerEntry.create(data, { transaction });
  },

  async findByAccountPaginated(
    accountId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: LedgerEntry[]; count: number }> {
    return LedgerEntry.findAndCountAll({
      where: { accountId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  },
};
