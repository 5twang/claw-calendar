/**
 * Claw Calendar - 验证中间件
 * 使用 Zod 进行请求验证
 * 
 * 使用方式：
 * const { validateBody, schemas } = require('./middleware/validation');
 * router.post('/events', validateBody(schemas.createEvent), handler);
 */

const { z } = require('zod');
const { ErrorCode } = require('../types/api');
const schemas = require('../types/schemas');

// 重新导出所有 schemas
Object.assign(module.exports, schemas);

/**
 * 创建请求体验证中间件
 * @param {z.ZodSchema} schema - Zod 验证 schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return res.status(422).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: '请求参数验证失败',
          details: errors
        }
      });
    }
    
    // 用验证后的数据替换原数据（添加默认值等）
    req.body = result.data;
    next();
  };
}

/**
 * 创建查询参数验证中间件
 * @param {z.ZodSchema} schema - Zod 验证 schema
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return res.status(422).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: '查询参数验证失败',
          details: errors
        }
      });
    }
    
    req.query = result.data;
    next();
  };
}

/**
 * 验证响应格式（仅开发环境）
 * @param {z.ZodSchema} schema - Zod 验证 schema
 * @param {string} name - 响应名称（用于日志）
 */
function validateResponse(schema, name = 'response') {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = (data) => {
      // 仅在开发环境验证
      if (process.env.NODE_ENV === 'development') {
        const result = schema.safeParse(data);
        if (!result.success) {
          console.warn(`[API Validation Warning] ${name}:`, {
            errors: result.error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            })),
            actualData: JSON.stringify(data).substring(0, 200)
          });
        }
      }
      return originalJson(data);
    };
    
    next();
  };
}

module.exports.validateBody = validateBody;
module.exports.validateQuery = validateQuery;
module.exports.validateResponse = validateResponse;
module.exports.z = z;
