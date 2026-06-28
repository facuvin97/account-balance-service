import { Transaction } from 'sequelize';
import { Transfer, TransferCreationAttributes } from '../database/models/Transfer';

export const transferRepository = {
  async create(data: TransferCreationAttributes, transaction: Transaction): Promise<Transfer> {
    return Transfer.create(data, { transaction });
  },
};
