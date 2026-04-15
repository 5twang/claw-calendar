/**
 * 全局错误处理中间件
 * 统一处理所有路由抛出的错误，返回一致的 JSON 格式
 */

const { AppError, ValidationError } = require('../utils/errors');

/**
 * 开发环境格式化错误
 */
function formatErrorDev(err) {
  return {
    success: false,
    error: {
      message: err.message,
      code: err.code || err.constructor.name,
      statusCode: err.statusCode,
      stack: err.stack
    }
  };
}

/**
 * 生产环境格式化错误
 */
function formatErrorProd(err) {
  // 操作型错误：详细消息
  if (err.isOperational) {
    return err.toJSON();
  }

  // 编程错误：隐藏细节
  console.error('Unexpected error:', err);
  return {
    success: false,
    error: {
      message: '服务器内部错误',
      code: 'INTERNAL_ERROR'
    }
  };
}

/**
 * 处理验证错误（来自 express-validator 或自定义 ValidationError）
 */
function handleValidationError(err, res) {
  // ValidationError 有 details 属性
  if (err.details) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details
      }
    });
  }

  // express-validator 格式
  if (err.array && typeof err.array === 'function') {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: '输入验证失败',
        code: 'VALIDATION_ERROR',
        details: err.array()
      }
    });
  }

  // 普通对象格式的验证错误
  return res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.code
    }
  });
}

/**
 * 认证错误处理
 */
function handleAuthError(err, res) {
  // 区分不同类型的认证错误
  if (err.code === 'TOKEN_EXPIRED') {
    return res.status(401).json({
      success: false,
      error: {
        message: '令牌已过期，请重新登录',
        code: 'TOKEN_EXPIRED'
      }
    });
  }

  if (err.code === 'TOKEN_INVALID') {
    return res.status(403).json({
      success: false,
      error: {
        message: '无效的访问令牌',
        code: 'TOKEN_INVALID'
      }
    });
  }

  return res.status(err.statusCode).json(err.toJSON ? err.toJSON() : {
    success: false,
    error: {
      message: err.message,
      code: err.code
    }
  });
}

/**
 * 异步错误处理包装器
 * 用法：router.get('/', asyncWrapper(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 主错误处理中间件
 */
function errorHandler(err, req, res, next) {
  // 避免重复发送响应
  if (res.headersSent) {
    return next(err);
  }

  // 设置默认状态码
  err.statusCode = err.statusCode || 500;

  // 开发环境显示完整错误
  const isDev = process.env.NODE_ENV !== 'production';

  // 处理验证错误
  if (err instanceof ValidationError) {
    return handleValidationError(err, res);
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    err.statusCode = err.name === 'TokenExpiredError' ? 401 : 403;
    err.code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return handleAuthError(err, res);
  }

  // 处理 AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // 处理未知错误
  if (isDev) {
    return res.status(err.statusCode).json(formatErrorDev(err));
  } else {
    return res.status(err.statusCode).json(formatErrorProd(err));
  }
}

/**
 * 404 处理（路由未匹配）
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: `路由 ${req.method} ${req.path} 不存在`,
      code: 'ROUTE_NOT_FOUND'
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
