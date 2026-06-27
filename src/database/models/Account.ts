import { DataTypes, Model, ModelStatic, Optional, Sequelize } from 'sequelize';

export interface AccountAttributes {
  id: string;
  userId: string;
  currency: string;
  cachedBalance: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountCreationAttributes = Optional<
  AccountAttributes,
  'id' | 'cachedBalance' | 'createdAt' | 'updatedAt'
>;

export class Account
  extends Model<AccountAttributes, AccountCreationAttributes>
  implements AccountAttributes
{
  declare id: string;
  declare userId: string;
  declare currency: string;
  declare cachedBalance: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static associate(models: Record<string, unknown>): void {
    const { Transfer, LedgerEntry } = models as {
      Transfer: ModelStatic<Model>;
      LedgerEntry: ModelStatic<Model>;
    };

    Account.hasMany(Transfer, {
      foreignKey: 'sourceAccountId',
      as: 'outgoingTransfers',
    });
    Account.hasMany(Transfer, {
      foreignKey: 'destinationAccountId',
      as: 'incomingTransfers',
    });
    Account.hasMany(LedgerEntry, {
      foreignKey: 'accountId',
      as: 'ledgerEntries',
    });
  }
}

export function initAccountModel(sequelize: Sequelize): typeof Account {
  Account.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      cachedBalance: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'cached_balance',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      tableName: 'accounts',
      timestamps: true,
      underscored: true,
    },
  );

  return Account;
}
