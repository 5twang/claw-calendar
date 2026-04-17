/**
 * 邮箱验证测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');
const pool = require('../src/config/database');

describe('邮箱验证测试', () => {
  let authToken;
  const testEmail = 'verifytest@test.com';
  let userId;

  beforeAll(async () => {
    // 创建测试用户（未激活状态）
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, is_active, created_at)
       VALUES ($1, $2, false, NOW())
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [testEmail, passwordHash]
    );
    userId = userResult.rows[0].id;

    authToken = generateToken({
      id: userId,
      email: testEmail
    });
  });

  describe('GET /api/auth/verify-email', () => {
    test('应该拒绝缺失 token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-email');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('应该拒绝无效 token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: 'invalid_token' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/resend-verify', () => {
    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verify');

      expect(res.status).toBe(401);
    });

    test('应该拒绝无效 Token', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verify')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(403);
    });

    test('应该拒绝已验证的用户重新验证', async () => {
      // 将测试用户设置为已激活
      await pool.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);

      const res = await request(app)
        .post('/api/auth/resend-verify')
        .set('Authorization', `Bearer ${authToken}`);

      // 已验证用户应该收到错误
      expect(res.status).toBe(400);
    });
  });
});
