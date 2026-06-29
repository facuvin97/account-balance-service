import { Options } from 'sequelize';
import { env } from '../../config/env';

const dbConfig: Options = {
  dialect: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  logging: env.NODE_ENV === 'development' ? console.log : false,
};

export default dbConfig;
