import db from './models';

export const connectDatabase = async (): Promise<void> => {
  await db.sequelize.authenticate();
  console.log('Database connection established.');
};

export { db };
export default db;
