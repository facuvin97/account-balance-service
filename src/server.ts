import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDatabase } from './database';

const PORT = process.env.PORT ?? 3000;

const start = async (): Promise<void> => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

void start();
