const express = require('express');
const { setupSecurity } = require('../src/config/security-middleware');

describe('security-middleware.js', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('setupSecurity', () => {
    test('应该添加 helmet 安全中间件', () => {
      setupSecurity(app);

      const hasHelmet = app._router.stack.some(
        layer => layer.name === 'helmetMiddleware'
      );
      expect(hasHelmet).toBe(true);
    });

    test('应该添加速率限制中间件', () => {
      setupSecurity(app);

      // rateLimit 中间件在 api 路由上
      const hasApiLimit = app._router.stack.some(
        layer => layer.regexp && layer.regexp.toString().includes('/api')
      );
      expect(hasApiLimit).toBe(true);
    });
  });
});
