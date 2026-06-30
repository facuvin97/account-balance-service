import dotenv from 'dotenv';
dotenv.config();

import { env } from './config/env';
import app from './app';
import { connectDatabase } from './database';

const PORT = env.PORT;

const start = async (): Promise<void> => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

void start();
