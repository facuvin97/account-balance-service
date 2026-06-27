import { DataTypes, Model, ModelStatic, Optional, Sequelize } from 'sequelize';

export interface TransferAttributes {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  memo: string | null;
  createdAt: Date;
}

export type TransferCreationAttributes = Optional<TransferAttributes, 'id' | 'memo' | 'createdAt'>;

export class Transfer
  extends Model<TransferAttributes, TransferCreationAttributes>
  implements TransferAttributes
{
  declare id: string;
  declare sourceAccountId: string;
  declare destinationAccountId: string;
  declare amount: string;
  declare memo: string | null;
  declare createdAt: Date;

  static associate(models: Record<string, unknown>): void {
    const { Account, LedgerEntry } = models as {
      Account: ModelStatic<Model>;
      LedgerEntry: ModelStatic<Model>;
    };

    Transfer.belongsTo(Account, {
      foreignKey: 'sourceAccountId',
      as: 'sourceAccount',
    });
    Transfer.belongsTo(Account, {
      foreignKey: 'destinationAccountId',
      as: 'destinationAccount',
    });
    Transfer.hasMany(LedgerEntry, {
      foreignKey: 'relatedTransferId',
      as: 'ledgerEntries',
    });
  }
}

export function initTransferModel(sequelize: Sequelize): typeof Transfer {
  Transfer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sourceAccountId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'source_account_id',
      },
      destinationAccountId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'destination_account_id',
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      memo: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      sequelize,
      tableName: 'transfers',
      timestamps: true,
      updatedAt: false,
      underscored: true,
    },
  );

  return Transfer;
}
