import { Transaction } from 'sequelize';
import { Account } from '../database/models/Account';

export const accountRepository = {
  async findById(id: string): Promise<Account | null> {
    return Account.findByPk(id);
  },

  async findByIdForUpdate(id: string, transaction: Transaction): Promise<Account | null> {
    return Account.findByPk(id, { lock: true, transaction });
  },

  async updateCachedBalance(
    id: string,
    cachedBalance: string,
    transaction: Transaction,
  ): Promise<void> {
    await Account.update({ cachedBalance }, { where: { id }, transaction });
  },
};
