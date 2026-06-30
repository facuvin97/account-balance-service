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
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 15000,
  },
  ...(env.NODE_ENV === 'production' && {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true,
        ca: env.DB_SSL_CA,
      },
    },
  }),
};

export default dbConfig;
