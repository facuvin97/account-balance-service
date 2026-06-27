import { Sequelize, Options } from 'sequelize';

const env = process.env.NODE_ENV || 'development';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../config/config.js')[env] as Options;

const sequelize = new Sequelize(config);

// Model registry — import and register each model here as you create them.
// Example:
//   import { initAccountModel, Account } from './Account';
//   initAccountModel(sequelize);

interface DB {
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
  // Add model types here as you create them:
  // Account: typeof Account;
}

const db: DB = {
  sequelize,
  Sequelize,
};

// Call associate() on every model that defines it.
// When you add a model, give it a static `associate(db: DB)` method
// and invoke it here:
//   Account.associate?.(db);

export default db;
