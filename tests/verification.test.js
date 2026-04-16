/**
 * 邮箱验证测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

describe('邮箱验证测试', () => {
  let authToken;
  // 使用数据库中已存在的测试用户
  const testEmail = 'workbuddy@test.com';
  const userId = 'f6d6d24b-ea0a-46d9-97fc-16f811fc8a4d';

  beforeAll(() => {
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
      // workbuddy@test.com 是已验证用户
      const res = await request(app)
        .post('/api/auth/resend-verify')
        .set('Authorization', `Bearer ${authToken}`);

      // 已验证用户应该收到错误
      expect(res.status).toBe(400);
    });
  });
});
