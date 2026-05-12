/**
 * Admin 用户管理 API
 * 
 * 所有路由都需要 adminAuth 中间件
 * 
 * GET    /api/admin/users          — 用户列表（支持搜索、分页、排序）
 * GET    /api/admin/users/:id      — 用户详情（含统计）
 * PATCH  /api/admin/users/:id      — 更新用户（is_active / is_admin）
 */

const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { adminAuth } = require('../../middleware/adminAuth');
const { errors } = require('../../utils/errors');
const { asyncHandler } = require('../../middleware/errorHandler');

// 所有路由需要 admin 认证
router.use(adminAuth);

// ==================== 用户列表 ====================
router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status || 'all';
  const isAdminFilter = req.query.is_admin;
  const sort = req.query.sort || 'created_at:desc';

  const adapterType = pool.getType ? pool.getType() : 'file';

  if (adapterType === 'postgres') {
    // PostgreSQL 适配器：使用原生 SQL 查询
    await handlePostgresUserList(req, res, { page, limit, offset, search, status, isAdminFilter, sort });
  } else {
    // 文件适配器：在 JS 中处理过滤和分页
    await handleFileUserList(req, res, { page, limit, offset, search, status, isAdminFilter, sort });
  }
}));

// PostgreSQL 用户列表查询
async function handlePostgresUserList(req, res, { page, limit, offset, search, status, isAdminFilter, sort }) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // 搜索条件
  if (search) {
    conditions.push(`(u.email ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // 状态过滤
  if (status === 'active') {
    conditions.push('u.is_active = true');
  } else if (status === 'inactive') {
    conditions.push('u.is_active = false');
  }

  // 管理员过滤
  if (isAdminFilter === 'true') {
    conditions.push('u.is_admin = true');
  } else if (isAdminFilter === 'false') {
    conditions.push('u.is_admin = false');
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // 排序处理
  const sortMap = {
    'created_at:desc': 'u.created_at DESC',
    'created_at:asc': 'u.created_at ASC',
    'email:asc': 'u.email ASC',
    'email:desc': 'u.email DESC',
    'name:asc': 'u.name ASC NULLS LAST',
    'name:desc': 'u.name DESC NULLS LAST',
    'is_active:asc': 'u.is_active ASC',
    'is_active:desc': 'u.is_active DESC'
  };
  const orderClause = sortMap[sort] || 'u.created_at DESC';

  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
  const countResult = await pool.query(countSql, params);
  const total = parseInt(countResult.rows[0].total) || 0;

  // 查询用户列表（含日历数和事件数统计）
  const dataSql = `
    SELECT
      u.id, u.email, u.name, u.is_active, u.is_admin, u.created_at, u.updated_at,
      COALESCE(c.calendar_count, 0) AS calendar_count,
      COALESCE(e.event_count, 0) AS event_count
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS calendar_count
      FROM calendars
      GROUP BY user_id
    ) c ON u.id = c.user_id
    LEFT JOIN (
      SELECT cal.user_id, COUNT(*) AS event_count
      FROM events e
      JOIN calendars cal ON e.calendar_id = cal.id
      GROUP BY cal.user_id
    ) e ON u.id = e.user_id
    ${whereClause}
    ORDER BY ${orderClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  const dataResult = await pool.query(dataSql, params);

  res.json({
    success: true,
    users: dataResult.rows,
    total,
    page,
    limit
  });
}

// 文件适配器用户列表查询（JS 端过滤和分页）
async function handleFileUserList(req, res, { page, limit, offset, search, status, isAdminFilter, sort }) {
  // 获取所有用户
  const usersResult = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
  let users = usersResult.rows;

  // 获取所有日历
  const calendarsResult = await pool.query('SELECT * FROM calendars');
  const calendars = calendarsResult.rows;

  // 获取所有事件
  const eventsResult = await pool.query('SELECT * FROM events');
  const events = eventsResult.rows;

  // 计算每个用户的日历数和事件数
  const calendarCountMap = {};
  const eventCountMap = {};

  calendars.forEach(cal => {
    calendarCountMap[cal.user_id] = (calendarCountMap[cal.user_id] || 0) + 1;
  });

  events.forEach(evt => {
    const cal = calendars.find(c => c.id === evt.calendar_id);
    if (cal) {
      eventCountMap[cal.user_id] = (eventCountMap[cal.user_id] || 0) + 1;
    }
  });

  // 过滤
  if (search) {
    const lowerSearch = search.toLowerCase();
    users = users.filter(u =>
      (u.email && u.email.toLowerCase().includes(lowerSearch)) ||
      (u.name && u.name.toLowerCase().includes(lowerSearch))
    );
  }

  if (status === 'active') {
    users = users.filter(u => u.is_active === true);
  } else if (status === 'inactive') {
    users = users.filter(u => u.is_active === false);
  }

  if (isAdminFilter === 'true') {
    users = users.filter(u => u.is_admin === true);
  } else if (isAdminFilter === 'false') {
    users = users.filter(u => !u.is_admin);
  }

  const total = users.length;

  // 排序
  const [sortField, sortDir] = sort.split(':');
  const dir = sortDir === 'desc' ? -1 : 1;

  users.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (sortField === 'name') {
      valA = (valA || '').toLowerCase();
      valB = (valB || '').toLowerCase();
    }
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;
    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  // 分页
  const paginatedUsers = users.slice(offset, offset + limit);

  // 添加统计字段，移除密码哈希
  const resultUsers = paginatedUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    is_active: u.is_active,
    is_admin: u.is_admin || false,
    created_at: u.created_at,
    updated_at: u.updated_at,
    calendar_count: calendarCountMap[u.id] || 0,
    event_count: eventCountMap[u.id] || 0
  }));

  res.json({
    success: true,
    users: resultUsers,
    total,
    page,
    limit
  });
}

// ==================== 用户详情 ====================
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adapterType = pool.getType ? pool.getType() : 'file';

  let user;

  if (adapterType === 'postgres') {
    const sql = `
      SELECT
        u.id, u.email, u.name, u.is_active, u.is_admin, u.created_at, u.updated_at,
        COALESCE(c.calendar_count, 0) AS calendar_count,
        COALESCE(e.event_count, 0) AS event_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS calendar_count
        FROM calendars
        GROUP BY user_id
      ) c ON u.id = c.user_id
      LEFT JOIN (
        SELECT cal.user_id, COUNT(*) AS event_count
        FROM events e
        JOIN calendars cal ON e.calendar_id = cal.id
        GROUP BY cal.user_id
      ) e ON u.id = e.user_id
      WHERE u.id = $1
    `;
    const result = await pool.query(sql, [id]);
    if (result.rows.length === 0) {
      throw errors.notFound('用户不存在');
    }
    user = result.rows[0];
  } else {
    // 文件适配器
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      throw errors.notFound('用户不存在');
    }
    const rawUser = userResult.rows[0];

    // 统计日历数和事件数
    const calendarsResult = await pool.query('SELECT * FROM calendars WHERE user_id = $1', [id]);
    const calendars = calendarsResult.rows;
    const calendarIds = calendars.map(c => c.id);

    let eventCount = 0;
    for (const calId of calendarIds) {
      const eventsResult = await pool.query('SELECT COUNT(*) as cnt FROM events WHERE calendar_id = $1', [calId]);
      eventCount += parseInt(eventsResult.rows[0]?.cnt || eventsResult.rows.length || 0);
    }

    user = {
      id: rawUser.id,
      email: rawUser.email,
      name: rawUser.name,
      is_active: rawUser.is_active,
      is_admin: rawUser.is_admin || false,
      created_at: rawUser.created_at,
      updated_at: rawUser.updated_at,
      calendar_count: calendars.length,
      event_count: eventCount
    };
  }

  res.json({
    success: true,
    user
  });
}));

// ==================== 更新用户 ====================
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_active, is_admin } = req.body;

  // 只允许修改 is_active 和 is_admin
  if (is_active === undefined && is_admin === undefined) {
    throw errors.badRequest('请提供要更新的字段（is_active 或 is_admin）');
  }

  // 验证字段类型
  if (is_active !== undefined && typeof is_active !== 'boolean') {
    throw errors.badRequest('is_active 必须是布尔值');
  }
  if (is_admin !== undefined && typeof is_admin !== 'boolean') {
    throw errors.badRequest('is_admin 必须是布尔值');
  }

  // 防止管理员取消自己的管理员权限
  if (is_admin === false && req.user && req.user.id === id) {
    throw errors.badRequest('不能取消自己的管理员权限');
  }

  // 防止管理员禁用自己
  if (is_active === false && req.user && req.user.id === id) {
    throw errors.badRequest('不能禁用自己的账户');
  }

  const adapterType = pool.getType ? pool.getType() : 'file';

  if (adapterType === 'postgres') {
    // 构建动态 UPDATE
    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    if (is_active !== undefined) {
      setClauses.push(`is_active = $${paramIdx++}`);
      params.push(is_active);
    }
    if (is_admin !== undefined) {
      setClauses.push(`is_admin = $${paramIdx++}`);
      params.push(is_admin);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING id, email, name, is_active, is_admin, created_at, updated_at
    `;

    const result = await pool.query(sql, params);

    if (result.rows.length === 0) {
      throw errors.notFound('用户不存在');
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });
  } else {
    // 文件适配器
    // 先检查用户是否存在
    const checkResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      throw errors.notFound('用户不存在');
    }

    // 构建 SET 子句
    const setParts = [];
    if (is_active !== undefined) {
      setParts.push(`is_active = ${is_active}`);
    }
    if (is_admin !== undefined) {
      setParts.push(`is_admin = ${is_admin}`);
    }
    setParts.push("updated_at = NOW()");

    const updateResult = await pool.query(
      `UPDATE users SET ${setParts.join(', ')} WHERE id = $1 RETURNING id, email, name, is_active, is_admin, created_at, updated_at`,
      [id]
    );

    return res.json({
      success: true,
      user: updateResult.rows[0]
    });
  }
}));

// ==================== 删除用户 ====================
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 防止管理员删除自己
  if (req.user && req.user.id === id) {
    throw errors.badRequest('不能删除自己的账户');
  }

  const adapterType = pool.getType ? pool.getType() : 'file';

  if (adapterType === 'postgres') {
    const checkResult = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      throw errors.notFound('用户不存在');
    }

    const user = checkResult.rows[0];

    // 手动删除 api_logs（无 CASCADE）后再删除用户
    await pool.query('DELETE FROM api_logs WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    return res.json({
      success: true,
      message: '用户已删除',
      deletedUser: { id: user.id, email: user.email, name: user.name }
    });
  } else {
    // 文件适配器
    const checkResult = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      throw errors.notFound('用户不存在');
    }

    const user = checkResult.rows[0];

    await pool.query('DELETE FROM api_logs WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM api_keys WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM calendars WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM email_verifications WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    return res.json({
      success: true,
      message: '用户已删除',
      deletedUser: { id: user.id, email: user.email, name: user.name }
    });
  }
}));

module.exports = router;
