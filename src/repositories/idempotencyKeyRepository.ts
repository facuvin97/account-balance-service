import { Op, Transaction } from 'sequelize';
import {
  IdempotencyKey,
  IdempotencyKeyCreationAttributes,
} from '../database/models/IdempotencyKey';

export const idempotencyKeyRepository = {
  async findByUserAndKey(userId: string, key: string): Promise<IdempotencyKey | null> {
    return IdempotencyKey.findOne({ where: { userId, key } });
  },

  async create(
    data: IdempotencyKeyCreationAttributes,
    transaction: Transaction,
  ): Promise<IdempotencyKey> {
    return IdempotencyKey.create(data, { transaction });
  },

  async updateResult(
    id: string,
    status: string,
    responseSnapshot: Record<string, unknown>,
    transaction: Transaction,
  ): Promise<void> {
    await IdempotencyKey.update({ status, responseSnapshot }, { where: { id }, transaction });
  },

  async deleteById(id: string): Promise<void> {
    await IdempotencyKey.destroy({ where: { id } });
  },

  async reclaimStale(userId: string, key: string, staleThreshold: Date): Promise<number> {
    const [affectedCount] = await IdempotencyKey.update(
      { status: 'processing' },
      {
        where: {
          userId,
          key,
          status: 'processing',
          updatedAt: { [Op.lt]: staleThreshold },
        },
      },
    );
    return affectedCount;
  },
};
