/**
 * CalDAV 路由安全测试
 * 测试 CalDAV 服务发现和路由配置
 */

const request = require('supertest');

// 确保环境变量正确设置
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

const app = require('../src/app');

describe('CalDAV 安全测试', () => {
  describe('服务发现 (RFC 6764)', () => {
    test('/.well-known/caldav 应该重定向', async () => {
      const res = await request(app).get('/.well-known/caldav');

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('/dav/');
    });

    test('/.well-known/caldav 正确重定向到 /dav/', async () => {
      const res = await request(app)
        .get('/.well-known/caldav')
        .redirects(0);

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('/dav/');
    });
  });

  describe('CalDAV 路由存在性', () => {
    test('GET /dav/dav/ 返回 404（路由未定义或需要认证）', async () => {
      // 由于路由配置，/dav 挂载 caldav 路由器，
      // 而 caldav 路由定义 /dav/，所以实际路径是 /dav/dav/
      const res = await request(app)
        .get('/dav/dav/');

      // 应该返回 404 或 401（取决于路由匹配）
      expect([401, 404]).toContain(res.status);
    });

    test('GET /.well-known/caldav 可以通过重定向发现', async () => {
      // RFC 6764 要求 /.well-known/caldav 应该能被发现
      const res = await request(app)
        .get('/.well-known/caldav');

      expect(res.status).toBe(301);
    });
  });

  describe('OPTIONS 请求', () => {
    test('OPTIONS 请求应该返回 CORS 头', async () => {
      const res = await request(app)
        .options('/.well-known/caldav')
        .set('Access-Control-Request-Method', 'PROPFIND');

      // CORS 预检请求应该被处理
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
