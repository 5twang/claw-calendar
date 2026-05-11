/**
 * Admin 认证中间件
 * 
 * 先通过 authenticate() 验证 JWT 令牌，
 * 再从数据库获取用户信息，检查是否为管理员。
 * 
 * 使用方式：
 * router.get('/admin/users', adminAuth, handler);
 * router.use('/admin', adminAuth, adminRouter);
 */

const pool = require('../config/database');
const { authenticate } = require('./auth');
const { errors } = require('../utils/errors');

/**
 * Admin 认证中间件
 * 先验证 JWT，再检查 is_admin 权限
 */
function adminAuth(req, res, next) {
  // 第一步：先通过 JWT 认证
  authenticate(req, res, (err) => {
    if (err) {
      return next(err);
    }

    // 第二步：从数据库获取完整用户信息，检查 is_admin
    pool.query(
      'SELECT id, email, name, is_active, is_admin FROM users WHERE id = $1',
      [req.userId]
    ).then(result => {
      if (result.rows.length === 0) {
        return next(errors.unauthorized('用户不存在'));
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return next(errors.forbidden('账户已被禁用'));
      }

      if (!user.is_admin) {
        return next(errors.forbidden('需要管理员权限', 'ADMIN_REQUIRED'));
      }

      // 设置完整用户信息到 req.user
      req.user = user;
      req.user.is_admin = true;
      next();
    }).catch(err => next(err));
  });
}

module.exports = {
  adminAuth
};
