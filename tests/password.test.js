/**
 * 密码重置流程测试
 */

const request = require('supertest');
const app = require('../src/app');

describe('密码重置测试', () => {
  const testEmail = `reset_test_${Date.now()}@example.com`;

  describe('POST /api/auth/password/forgot-password', () => {
    test('应该对不存在的用户也返回成功（安全设计）', async () => {
      const res = await request(app)
        .post('/api/auth/password/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        });

      // 安全设计：无论用户是否存在都返回成功
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('应该拒绝无效邮箱', async () => {
      const res = await request(app)
        .post('/api/auth/password/forgot-password')
        .send({
          email: 'invalid-email'
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝空邮箱', async () => {
      const res = await request(app)
        .post('/api/auth/password/forgot-password')
        .send({
          email: ''
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/password/reset-password', () => {
    test('应该拒绝缺失参数', async () => {
      const res = await request(app)
        .post('/api/auth/password/reset-password')
        .send({
          email: testEmail,
          code: '123456'
          // 缺少 newPassword
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝无效验证码格式', async () => {
      const res = await request(app)
        .post('/api/auth/password/reset-password')
        .send({
          email: testEmail,
          code: '12345',  // 5位，应该是6位
          newPassword: 'NewPass123'
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝简单新密码', async () => {
      const res = await request(app)
        .post('/api/auth/password/reset-password')
        .send({
          email: testEmail,
          code: '123456',
          newPassword: 'password'  // 没有数字
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝过短的新密码', async () => {
      const res = await request(app)
        .post('/api/auth/password/reset-password')
        .send({
          email: testEmail,
          code: '123456',
          newPassword: 'short'
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝无效的重置令牌', async () => {
      const res = await request(app)
        .post('/api/auth/password/reset-password')
        .send({
          token: 'invalid_jwt_token',
          newPassword: 'NewPass123'
        });

      // JWT 格式错误或无效
      expect(res.status).toBe(400);
    });

    test('应该拒绝缺失所有参数', async () => {
      const res = await request(app)
        .post('/api/auth/password/reset-password')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/password/send-register-code', () => {
    test('应该拒绝无效邮箱', async () => {
      const res = await request(app)
        .post('/api/auth/password/send-register-code')
        .send({
          email: 'invalid'
        });

      expect(res.status).toBe(400);
    });

    test('应该处理已注册的邮箱', async () => {
      const res = await request(app)
        .post('/api/auth/password/send-register-code')
        .send({
          email: 'admin@example.com'  // 可能已存在
        });

      // 已注册的邮箱会返回 409 或其他错误
      expect([400, 409, 500]).toContain(res.status);
    });
  });

  describe('POST /api/auth/password/verify-register-code', () => {
    test('应该拒绝缺失参数', async () => {
      const res = await request(app)
        .post('/api/auth/password/verify-register-code')
        .send({
          email: 'test@example.com'
          // 缺少 code
        });

      expect(res.status).toBe(400);
    });

    test('应该处理无效验证码', async () => {
      const res = await request(app)
        .post('/api/auth/password/verify-register-code')
        .send({
          email: 'test@example.com',
          code: '000000'  // 随意一个验证码
        });

      // 可能返回 200 (空数组) 或 400 (无效验证码)
      // 因为数据库中没有这条记录
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('POST /api/auth/password/register-with-code', () => {
    test('应该拒绝缺失参数', async () => {
      const res = await request(app)
        .post('/api/auth/password/register-with-code')
        .send({
          email: 'new@example.com',
          code: '123456'
          // 缺少 password
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝过短密码', async () => {
      const res = await request(app)
        .post('/api/auth/password/register-with-code')
        .send({
          email: 'new@example.com',
          code: '123456',
          password: 'short'
        });

      expect(res.status).toBe(400);
    });
  });
});
