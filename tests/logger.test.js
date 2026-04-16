const { logger } = require('../src/middleware/logger');

describe('logger.js 中间件', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      path: '/api/test'
    };
    mockRes = {
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          mockRes._finishCallback = callback;
        }
      })
    };
    mockNext = jest.fn();
  });

  test('应该调用 next', () => {
    logger(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('应该注册 finish 事件监听', () => {
    logger(mockReq, mockRes, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  test('应该跳过 /health 路径', () => {
    mockReq.path = '/health';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    logger(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('完成时应该记录请求', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1710496800000);

    logger(mockReq, mockRes, mockNext);

    mockRes._finishCallback();

    expect(console.log).toHaveBeenCalled();
    const logOutput = console.log.mock.calls[0][0];
    expect(logOutput).toContain('GET');
    expect(logOutput).toContain('/api/test');

    consoleSpy.mockRestore();
    nowSpy.mockRestore();
  });
});
