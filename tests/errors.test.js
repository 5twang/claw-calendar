const { AppError, errors } = require('../src/utils/errors');

describe('errors.js 错误工具', () => {
  describe('AppError', () => {
    test('创建基础错误', () => {
      const error = new AppError(400, '测试错误');

      expect(error.message).toBe('测试错误');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    test('继承 Error', () => {
      const error = new AppError(500, '测试');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    test('包含 code 和 details', () => {
      const error = new AppError(400, '参数错误', 'INVALID_PARAM', { field: 'email' });

      expect(error.code).toBe('INVALID_PARAM');
      expect(error.details).toEqual({ field: 'email' });
    });

    test('toJSON 返回正确格式', () => {
      const error = new AppError(400, '测试错误');
      const json = error.toJSON();

      expect(json.success).toBe(false);
      expect(json.error.message).toBe('测试错误');
    });
  });

  describe('预定义错误', () => {
    test('badRequest', () => {
      const error = errors.badRequest('参数错误');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('参数错误');
    });

    test('unauthorized', () => {
      const error = errors.unauthorized('未登录');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('未登录');
    });

    test('forbidden', () => {
      const error = errors.forbidden('无权访问');

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('无权访问');
    });

    test('notFound', () => {
      const error = errors.notFound('资源不存在');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('资源不存在');
    });

    test('conflict', () => {
      const error = errors.conflict('资源冲突');

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('资源冲突');
    });

    test('serverError', () => {
      const error = errors.serverError('服务器错误');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('服务器错误');
    });
  });
});
