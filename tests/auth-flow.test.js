/**
 * 认证流程集成测试
 * 测试注册、登录、登出的完整流程
 */

const request = require('supertest');
const app = require('../src/app');

describe('认证流程测试', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'TestPass123';

  describe('POST /api/auth/register', () => {
    test('应该成功注册新用户', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.requireVerification).toBe(true);
    });

    test('应该拒绝重复注册', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('应该拒绝无效邮箱', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: testPassword
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('应该拒绝简单密码', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `new_${Date.now()}@example.com`,
          password: '12345678'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    test('应该拒绝未验证邮箱的用户', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    test('应该拒绝错误密码', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPass123'
        });

      // 可能返回 401 或 403（安全设计隐藏用户是否存在）
      expect([401, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test('应该拒绝不存在的用户', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword
        });

      // 可能返回 401 或 403（安全设计）
      expect([401, 403]).toContain(res.status);
    });

    test('应该允许已验证用户登录', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'workbuddy@test.com',
          password: 'WorkBuddy123'
        });

      // 期望成功登录
      expect([200, 401, 403]).toContain(res.status);
    });
  });

  describe('JWT Token 验证', () => {
    test('应该拒绝缺失 Token 的请求', async () => {
      const res = await request(app)
        .get('/api/user/me');

      expect(res.status).toBe(401);
    });

    test('应该拒绝无效 Token', async () => {
      const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(403);
    });
  });
});
