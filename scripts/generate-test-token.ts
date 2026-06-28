import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: tsx scripts/generate-test-token.ts <user_id>');
  process.exit(1);
}

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET not set in .env');
  process.exit(1);
}

const token = jwt.sign({ userId }, secret, { expiresIn: '7d' });

console.log(`Token for userId=${userId}:\n`);
console.log(token);
console.log(`\nCurl usage:\n  curl -b "token=${token}" http://localhost:${process.env.PORT ?? 3000}/...`);
