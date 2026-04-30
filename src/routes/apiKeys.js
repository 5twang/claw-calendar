const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateApiKey } = require('../utils/crypto');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');
const { formatDateTime } = require('../utils/constants');

// 获取 API Key 前缀（用于展示）
function getKeyPrefix(apiKey) {
  // claw-calendar-xxxxxxxx... 前缀长度为 14
  return apiKey.substring(0, 14);
}

// 格式化 API Key 响应
function formatApiKey(key) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    lastUsedAt: formatDateTime(key.last_used_at),
    expiresAt: formatDateTime(key.expires_at),
    isActive: key.is_active,
    createdAt: formatDateTime(key.created_at)
  };
}

// 获取用户的所有 API Keys
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, prefix, last_used_at, expires_at, is_active, created_at
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.userId]
  );

  res.json({
    success: true,
    keys: result.rows.map(key => formatApiKey(key))
  });
}));

// 创建新的 API Key
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { name, expiresDays } = req.body;

  // 生成新的 API Key（明文只返回这一次）
  const { key: apiKey, hash: keyHash } = generateApiKey();
  const keyPrefix = getKeyPrefix(apiKey);

  // 计算过期时间（可选）
  let expiresAt = null;
  if (expiresDays && expiresDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresDays));
  }

  // 保存到数据库
  const result = await pool.query(
    `INSERT INTO api_keys (user_id, name, key_hash, prefix, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, prefix, expires_at, is_active, created_at`,
    [req.userId, name || null, keyHash, keyPrefix, expiresAt]
  );

  const key = result.rows[0];

  res.status(201).json({
    success: true,
    message: 'API Key 创建成功',
    apiKey: apiKey,
    key: formatApiKey(key)
  });
}));

// 删除 API Key
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 验证所有权
  const checkResult = await pool.query(
    'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
    [id, req.userId]
  );

  if (checkResult.rows.length === 0) {
    throw errors.notFound('API Key 不存在');
  }

  // 先删除关联的 api_logs 记录（避免 PostgreSQL FK 约束冲突）
  // api_logs.api_key_id 有 REFERENCES api_keys(id) 外键约束但无 ON DELETE CASCADE
  await pool.query(
    'DELETE FROM api_logs WHERE api_key_id = $1',
    [id]
  );

  // 删除 API Key
  await pool.query(
    'DELETE FROM api_keys WHERE id = $1',
    [id]
  );

  res.json({
    success: true,
    message: 'API Key 已删除'
  });
}));

// 更新 API Key（修改名称、禁用/启用）
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, isActive } = req.body;

  // 验证所有权
  const checkResult = await pool.query(
    'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
    [id, req.userId]
  );

  if (checkResult.rows.length === 0) {
    throw errors.notFound('API Key 不存在');
  }

  // 构建更新语句
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name);
  }

  if (isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(isActive);
  }

  if (updates.length === 0) {
    throw errors.badRequest('没有要更新的字段');
  }

  values.push(id);

  const result = await pool.query(
    `UPDATE api_keys
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, prefix, last_used_at, expires_at, is_active, created_at`,
    values
  );

  res.json({
    success: true,
    message: 'API Key 已更新',
    key: formatApiKey(result.rows[0])
  });
}));

module.exports = router;
