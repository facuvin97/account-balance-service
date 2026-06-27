import { DataTypes, Model, ModelStatic, Optional, Sequelize } from 'sequelize';

export const LEDGER_ENTRY_TYPES = ['deposit', 'withdrawal', 'transfer_in', 'transfer_out'] as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export interface LedgerEntryAttributes {
  id: string;
  accountId: string;
  amount: string;
  type: LedgerEntryType;
  relatedTransferId: string | null;
  idempotencyKey: string;
  createdAt: Date;
}

export type LedgerEntryCreationAttributes = Optional<
  LedgerEntryAttributes,
  'id' | 'relatedTransferId' | 'createdAt'
>;

export class LedgerEntry
  extends Model<LedgerEntryAttributes, LedgerEntryCreationAttributes>
  implements LedgerEntryAttributes
{
  declare id: string;
  declare accountId: string;
  declare amount: string;
  declare type: LedgerEntryType;
  declare relatedTransferId: string | null;
  declare idempotencyKey: string;
  declare createdAt: Date;

  static associate(models: Record<string, unknown>): void {
    const { Account, Transfer } = models as {
      Account: ModelStatic<Model>;
      Transfer: ModelStatic<Model>;
    };

    LedgerEntry.belongsTo(Account, {
      foreignKey: 'accountId',
      as: 'account',
    });
    LedgerEntry.belongsTo(Transfer, {
      foreignKey: 'relatedTransferId',
      as: 'relatedTransfer',
    });
  }
}

export function initLedgerEntryModel(sequelize: Sequelize): typeof LedgerEntry {
  LedgerEntry.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      accountId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'account_id',
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...LEDGER_ENTRY_TYPES),
        allowNull: false,
      },
      relatedTransferId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'related_transfer_id',
      },
      idempotencyKey: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'idempotency_key',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      sequelize,
      tableName: 'ledger_entries',
      timestamps: true,
      updatedAt: false,
      underscored: true,
    },
  );

  return LedgerEntry;
}
