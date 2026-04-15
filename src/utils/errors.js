/**
 * 统一错误类
 * 提供一致的错误格式，便于前端统一处理
 */

/**
 * 应用错误基类
 * 所有业务错误都应使用此类或其子类
 */
class AppError extends Error {
  constructor(statusCode, message, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;           // 错误码，便于前端程序化处理
    this.details = details;     // 额外详情（如验证错误的具体字段）
    this.isOperational = true; // 操作型错误（非编程错误）

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    const response = {
      success: false,
      error: {
        message: this.message,
        code: this.code || this.constructor.name
      }
    };

    if (this.details) {
      response.error.details = this.details;
    }

    return response;
  }
}

/**
 * 400 Bad Request - 请求参数错误
 */
class BadRequestError extends AppError {
  constructor(message, code = 'BAD_REQUEST', details = null) {
    super(400, message, code, details);
  }
}

/**
 * 401 Unauthorized - 未认证
 */
class UnauthorizedError extends AppError {
  constructor(message = '认证失败', code = 'UNAUTHORIZED', details = null) {
    super(401, message, code, details);
  }
}

/**
 * 403 Forbidden - 无权限
 */
class ForbiddenError extends AppError {
  constructor(message = '权限不足', code = 'FORBIDDEN', details = null) {
    super(403, message, code, details);
  }
}

/**
 * 404 Not Found - 资源不存在
 */
class NotFoundError extends AppError {
  constructor(message = '资源不存在', code = 'NOT_FOUND', details = null) {
    super(404, message, code, details);
  }
}

/**
 * 409 Conflict - 资源冲突
 */
class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT', details = null) {
    super(409, message, code, details);
  }
}

/**
 * 429 Too Many Requests - 请求过于频繁
 */
class TooManyRequestsError extends AppError {
  constructor(message = '请求过于频繁', code = 'RATE_LIMITED', details = null) {
    super(429, message, code, details);
  }
}

/**
 * 500 Internal Server Error - 服务器内部错误
 */
class ServerError extends AppError {
  constructor(message = '服务器内部错误', code = 'SERVER_ERROR', details = null) {
    super(500, message, code, details);
    this.isOperational = false; // 非操作型错误
  }
}

/**
 * 便捷的错误创建函数（用于快速抛出错误）
 */
const errors = {
  badRequest: (msg, code, details) => new BadRequestError(msg, code, details),
  unauthorized: (msg, code, details) => new UnauthorizedError(msg, code, details),
  forbidden: (msg, code, details) => new ForbiddenError(msg, code, details),
  notFound: (msg, code, details) => new NotFoundError(msg, code, details),
  conflict: (msg, code, details) => new ConflictError(msg, code, details),
  tooManyRequests: (msg, code, details) => new TooManyRequestsError(msg, code, details),
  serverError: (msg, code, details) => new ServerError(msg, code, details)
};

/**
 * 验证相关错误
 */
class ValidationError extends BadRequestError {
  constructor(errors) {
    super('输入验证失败', 'VALIDATION_ERROR', errors);
    this.details = errors; // { field: message } 格式
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ServerError,
  ValidationError,
  errors
};
