const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authenticateToken, checkCalendarOwnership } = require('../middleware/auth');
const { encryptCalendarData, decryptCalendarData, decryptCalendarList, decryptEventData } = require('../config/security');
const { generateApiKey } = require('../utils/crypto');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');

// 日期格式化辅助函数：确保返回 YYYY-MM-DD 格式
function formatDateForApi(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
    return dateValue.split('T')[0];
  }
  return dateValue.toISOString().split('T')[0];
}

// 格式化完整时间戳为 ISO 字符串
function formatDateTime(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue.toISOString();
  return new Date(dateValue).toISOString();
}

// 创建日历
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, description, isPublic, color } = req.body;

  if (!name) {
    throw errors.badRequest('日历名称不能为空');
  }

  // 生成订阅令牌
  const { key: subscribeToken, hash: subscribeTokenHash } = generateApiKey();

  // 加密敏感字段
  const encryptedData = encryptCalendarData({
    name,
    description: description || ''
  });

  // 验证颜色格式，默认紫色
  const validColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#4f46e5';

  const result = await pool.query(
    `INSERT INTO calendars (user_id, name, description, color, is_public, subscribe_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, description, color, is_public, subscribe_token, created_at`,
    [req.userId, encryptedData.name, encryptedData.description, validColor, isPublic || false, subscribeTokenHash]
  );

  const calendar = result.rows[0];

  // 解密后返回给客户端
  const decryptedCalendar = decryptCalendarData(calendar);

  res.status(201).json({
    success: true,
    calendar: {
      id: decryptedCalendar.id,
      name: decryptedCalendar.name,
      description: decryptedCalendar.description,
      color: calendar.color,
      isPublic: decryptedCalendar.is_public,
      subscriptionUrl: `${req.protocol}://${req.get('host')}/calendars/${calendar.id}.ics?token=${subscribeToken}`,
      subscribeToken: subscribeToken,
      createdAt: decryptedCalendar.created_at
    }
  });
}));

// 获取用户的所有日历
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.color, c.is_public, c.subscribe_token, c.created_at,
            COUNT(e.id) as event_count
     FROM calendars c
     LEFT JOIN events e ON c.id = e.calendar_id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [req.userId]
  );

  // 解密日历列表
  const decryptedCalendars = decryptCalendarList(result.rows);

  const calendars = decryptedCalendars.map(cal => ({
    id: cal.id,
    name: cal.name,
    description: cal.description,
    color: result.rows.find(r => r.id === cal.id)?.color || '#4f46e5',
    isPublic: cal.is_public,
    subscribeToken: cal.subscribe_token,
    eventCount: parseInt(cal.event_count),
    subscriptionUrl: `${req.protocol}://${req.get('host')}/calendars/${cal.id}.ics`,
    createdAt: formatDateTime(cal.created_at)
  }));

  res.json({
    success: true,
    calendars
  });
}));

// 获取单个日历详情
router.get('/:id', authenticateToken, checkCalendarOwnership, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.color, c.is_public, c.subscribe_token, c.created_at,
            COUNT(e.id) as event_count
     FROM calendars c
     LEFT JOIN events e ON c.id = e.calendar_id
     WHERE c.id = $1
     GROUP BY c.id`,
    [req.params.id]
  );

  // 中间件已验证日历存在性，result 必然非空
  const rawCal = result.rows[0];
  const cal = decryptCalendarData(rawCal);

  res.json({
    success: true,
    calendar: {
      id: cal.id,
      name: cal.name,
      description: cal.description,
      color: rawCal.color,
      isPublic: cal.is_public,
      subscribeToken: cal.subscribe_token,
      eventCount: parseInt(cal.event_count),
      subscriptionUrl: `${req.protocol}://${req.get('host')}/calendars/${cal.id}.ics`,
      createdAt: formatDateTime(cal.created_at)
    }
  });
}));

// 获取用户所有日历的所有事件（聚合）
router.get('/events/all', authenticate, asyncHandler(async (req, res) => {
  // 先获取用户的所有日历 ID
  const calResult = await pool.query(
    'SELECT id, name, color FROM calendars WHERE user_id = $1',
    [req.userId]
  );

  // 解密日历数据获取日历信息
  const decryptedCals = decryptCalendarList(calResult.rows);
  const calendarIds = decryptedCals.map(c => c.id);
  const calendarMap = {};
  decryptedCals.forEach(c => {
    calendarMap[c.id] = {
      name: c.name,
      color: calResult.rows.find(r => r.id === c.id)?.color || '#4f46e5'
    };
  });

  // 获取所有事件（内存过滤）
  const allEventsResult = await pool.query(
    'SELECT * FROM events ORDER BY start_date ASC, start_time ASC'
  );

  const events = allEventsResult.rows
    .filter(e => calendarIds.includes(e.calendar_id))
    .map(e => {
      // 解密事件数据
      const decrypted = decryptEventData(e);
      const cal = calendarMap[decrypted.calendar_id];
      return {
        id: decrypted.id,
        calendarId: decrypted.calendar_id,
        calendarName: cal ? cal.name : '',
        calendarColor: cal ? cal.color : '#4f46e5',
        title: decrypted.title,
        description: decrypted.description,
        location: decrypted.location,
        startDate: formatDateForApi(decrypted.start_date),
        endDate: formatDateForApi(decrypted.end_date),
        startTime: decrypted.start_time,
        endTime: decrypted.end_time,
        isAllDay: decrypted.is_all_day,
        alarmEnabled: decrypted.alarm_enabled,
        alarmMinutes: decrypted.alarm_minutes,
        createdAt: formatDateTime(decrypted.created_at)
      };
    });

  res.json({ success: true, events });
}));

// 更新日历
router.put('/:id', authenticateToken, checkCalendarOwnership, asyncHandler(async (req, res) => {
  // 检查所有权
  if (req.calendarOwnerId !== req.userId) {
    throw errors.forbidden('无权修改此日历');
  }

  const { name, description, isPublic, color } = req.body;

  const updates = [];
  const values = [];
  let paramIndex = 1;

  // 加密需要更新的字段
  const fieldsToEncrypt = {};
  if (name !== undefined) fieldsToEncrypt.name = name;
  if (description !== undefined) fieldsToEncrypt.description = description;

  const encryptedFields = encryptCalendarData(fieldsToEncrypt);

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(encryptedFields.name);
  }

  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(encryptedFields.description);
  }

  if (isPublic !== undefined) {
    updates.push(`is_public = $${paramIndex++}`);
    values.push(isPublic);
  }

  // 颜色验证
  if (color !== undefined) {
    const validColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#4f46e5';
    updates.push(`color = $${paramIndex++}`);
    values.push(validColor);
  }

  if (updates.length === 0) {
    throw errors.badRequest('没有要更新的字段');
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  const result = await pool.query(
    `UPDATE calendars SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  // 解密后返回
  const rawCal = result.rows[0];
  const cal = decryptCalendarData(rawCal);

  res.json({
    success: true,
    calendar: {
      id: cal.id,
      name: cal.name,
      description: cal.description,
      color: rawCal.color,
      isPublic: cal.is_public,
      updatedAt: formatDateTime(cal.updated_at)
    }
  });
}));

// 删除日历
router.delete('/:id', authenticateToken, checkCalendarOwnership, asyncHandler(async (req, res) => {
  // 检查所有权
  if (req.calendarOwnerId !== req.userId) {
    throw errors.forbidden('无权删除此日历');
  }

  await pool.query('DELETE FROM calendars WHERE id = $1', [req.params.id]);

  res.json({
    success: true,
    message: '日历已删除'
  });
}));

module.exports = router;
