import './helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../src/app';
import db from '../src/database';
import { generateToken } from './helpers/auth';

describe('Smoke test', () => {
  it('connects to the test database', async () => {
    const [results] = await db.sequelize.query('SELECT current_database() AS db');
    expect((results[0] as { db: string }).db).toBe('account_balance_db_test');
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get(`/accounts/${crypto.randomUUID()}/balance`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for nonexistent account with valid auth', async () => {
    const userId = crypto.randomUUID();
    const token = generateToken(userId);
    const res = await request(app)
      .get(`/accounts/${crypto.randomUUID()}/balance`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});
