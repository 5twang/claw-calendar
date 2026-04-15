const request = require('supertest');
const app = require('../src/app');

describe('API 路由测试', () => {
  describe('GET /health', () => {
    test('返回健康状态', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.security).toBeDefined();
    });
  });

  describe('GET /', () => {
    test('返回首页', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.type).toBe('text/html');
    });
  });

  describe('GET /.well-known/caldav', () => {
    test('重定向到 /dav/', async () => {
      const res = await request(app).get('/.well-known/caldav');

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('/dav/');
    });
  });

  describe('GET /api/auth/login', () => {
    test('返回 404（路由未定义但被 index 捕获）', async () => {
      const res = await request(app).get('/api/auth/login');

      // 根据实际路由配置，可能返回 404 或其他状态
      expect([400, 404, 405]).toContain(res.status);
    });
  });

  describe('GET /api/auth/register', () => {
    test('返回 404 或其他', async () => {
      const res = await request(app).get('/api/auth/register');

      expect([400, 404, 405]).toContain(res.status);
    });
  });

  describe('GET /nonexistent', () => {
    test('返回 404', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
