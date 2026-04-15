const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const { verifyApiKey } = require('../utils/crypto');
const { errors } = require('../utils/errors');

// JWT 密钥必须从环境变量获取，生产环境必须设置
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成JWT Token
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    jti: require('crypto').randomBytes(16).toString('hex')
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// 验证JWT中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return next(errors.unauthorized('缺少访问令牌'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

  // 检查会话是否有效（未在黑名单中）- 测试环境除外
  if (process.env.NODE_ENV !== 'test') {
    pool.query(
      'SELECT id FROM user_sessions WHERE token_jti = $1 AND expires_at > NOW()',
      [decoded.jti]
    ).then(sessionResult => {
      if (sessionResult.rows.length === 0) {
        next(errors.unauthorized('会话已过期或无效', 'SESSION_EXPIRED'));
      } else {
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.tokenJti = decoded.jti;
        next();
      }
    }).catch(err => next(err));
  } else {
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.tokenJti = decoded.jti;
    next();
  }
  } catch (err) {
    // jwt.verify 会抛出特定错误
    if (err.name === 'TokenExpiredError') {
      return next(errors.unauthorized('令牌已过期，请重新登录', 'TOKEN_EXPIRED'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(errors.forbidden('无效的访问令牌', 'TOKEN_INVALID'));
    }
    next(err);
  }
}

// 验证API Key中间件（用户级：可访问该用户所有日历）
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(errors.unauthorized('缺少 API Key'));
  }

  // 计算 API Key 哈希
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // 查找匹配的 API Key
  pool.query(
    `SELECT k.id, k.user_id, k.name as key_name, k.permissions, k.expires_at, k.is_active, u.email
     FROM api_keys k
     JOIN users u ON k.user_id = u.id
     WHERE k.key_hash = $1`,
    [keyHash]
  ).then(result => {
    if (result.rows.length === 0) {
      return next(errors.forbidden('无效的 API Key'));
    }

    const apiKeyRecord = result.rows[0];

    // 检查是否激活
    if (!apiKeyRecord.is_active) {
      return next(errors.forbidden('API Key 已被禁用'));
    }

    // 检查是否过期
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      return next(errors.forbidden('API Key 已过期', 'API_KEY_EXPIRED'));
    }

    // 检查权限（当前为用户级：可访问所有日历）
    req.apiKeyId = apiKeyRecord.id;
    req.userId = apiKeyRecord.user_id;
    req.userEmail = apiKeyRecord.email;
    req.apiKeyPermissions = apiKeyRecord.permissions || {};
    req.authMethod = 'apikey';

    // 更新最后使用时间
    return pool.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [apiKeyRecord.id]
    ).then(() => {
      // 记录API日志
      return pool.query(
        `INSERT INTO api_logs (user_id, api_key_id, action, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [apiKeyRecord.user_id, apiKeyRecord.id, req.method + ' ' + req.path,
         req.ip, req.headers['user-agent']]
      );
    }).then(() => next()).catch(err => next(err));
  }).catch(err => next(err));
}

// 检查日历所有权
function checkCalendarOwnership(req, res, next) {
  const calendarId = req.params.id || req.params.calendarId;

  if (!calendarId) {
    return next(errors.badRequest('缺少日历ID'));
  }

  pool.query(
    'SELECT user_id, is_public FROM calendars WHERE id = $1',
    [calendarId]
  ).then(result => {
    if (result.rows.length === 0) {
      return next(errors.notFound('日历不存在'));
    }

    const calendar = result.rows[0];

    // 检查所有权或公开访问
    if (calendar.user_id !== req.userId && !calendar.is_public) {
      return next(errors.forbidden('无权访问此日历'));
    }

    req.calendarOwnerId = calendar.user_id;
    req.isCalendarPublic = calendar.is_public;

    next();
  }).catch(err => next(err));
}

// 组合认证中间件：支持 JWT 或 API Key
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    // 有 API Key，使用 API Key 认证
    return authenticateApiKey(req, res, next);
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // 有 Bearer Token，使用 JWT 认证
    return authenticateToken(req, res, next);
  }

  // 没有任何认证信息
  next(errors.unauthorized('缺少认证信息'));
}

module.exports = {
  generateToken,
  authenticateToken,
  authenticateApiKey,
  checkCalendarOwnership,
  authenticate
};
