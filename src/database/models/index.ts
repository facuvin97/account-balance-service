import { Sequelize, Options } from 'sequelize';
import { initAccountModel, Account } from './Account';
import { initTransferModel, Transfer } from './Transfer';
import { initLedgerEntryModel, LedgerEntry } from './LedgerEntry';
import { initIdempotencyKeyModel, IdempotencyKey } from './IdempotencyKey';

const env = process.env.NODE_ENV || 'development';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../config/config.js')[env] as Options;

const sequelize = new Sequelize(config);

// Initialize models
initAccountModel(sequelize);
initTransferModel(sequelize);
initLedgerEntryModel(sequelize);
initIdempotencyKeyModel(sequelize);

// Register associations
const models = { Account, Transfer, LedgerEntry, IdempotencyKey };
Account.associate(models);
Transfer.associate(models);
LedgerEntry.associate(models);

interface DB {
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
  Account: typeof Account;
  Transfer: typeof Transfer;
  LedgerEntry: typeof LedgerEntry;
  IdempotencyKey: typeof IdempotencyKey;
}

const db: DB = {
  sequelize,
  Sequelize,
  Account,
  Transfer,
  LedgerEntry,
  IdempotencyKey,
};

export default db;
