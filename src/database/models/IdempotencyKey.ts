import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface IdempotencyKeyAttributes {
  id: string;
  userId: string;
  key: string;
  requestFingerprint: string;
  status: string;
  responseSnapshot: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IdempotencyKeyCreationAttributes = Optional<
  IdempotencyKeyAttributes,
  'id' | 'responseSnapshot' | 'createdAt' | 'updatedAt'
>;

export class IdempotencyKey
  extends Model<IdempotencyKeyAttributes, IdempotencyKeyCreationAttributes>
  implements IdempotencyKeyAttributes
{
  declare id: string;
  declare userId: string;
  declare key: string;
  declare requestFingerprint: string;
  declare status: string;
  declare responseSnapshot: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initIdempotencyKeyModel(sequelize: Sequelize): typeof IdempotencyKey {
  IdempotencyKey.init(
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
      key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      requestFingerprint: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'request_fingerprint',
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      responseSnapshot: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'response_snapshot',
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
      tableName: 'idempotency_keys',
      timestamps: true,
      underscored: true,
    },
  );

  return IdempotencyKey;
}
