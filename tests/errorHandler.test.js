const { errorHandler, notFoundHandler } = require('../src/middleware/errorHandler');
const { AppError } = require('../src/utils/errors');

describe('errorHandler.js 中间件', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      originalUrl: '/test',
      method: 'GET',
      path: '/test'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false
    };
    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    test('处理 AppError', () => {
      const error = new AppError(400, '测试错误');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: '测试错误',
          code: 'AppError'
        }
      });
    });

    test('处理普通 Error (开发环境)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('普通错误');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalled();
      // 开发环境包含 stack
      const calledWith = mockRes.json.mock.calls[0][0];
      expect(calledWith.error.message).toBe('普通错误');
      expect(calledWith.error.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('生产环境隐藏普通错误详情', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('详细错误信息');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: '服务器内部错误',
          code: 'INTERNAL_ERROR'
        }
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('开发环境显示操作型错误详情', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new AppError(500, '操作错误');
      error.isOperational = true;

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalled();
      const calledWith = mockRes.json.mock.calls[0][0];
      expect(calledWith.error.message).toBe('操作错误');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    test('返回 404', () => {
      notFoundHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: '路由 GET /test 不存在',
          code: 'ROUTE_NOT_FOUND'
        }
      });
    });
  });
});
