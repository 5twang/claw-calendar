const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../config/database');
const { authenticate, authenticateToken, checkCalendarOwnership } = require('../middleware/auth');
const { encryptEventData, decryptEventData, decryptEventList } = require('../config/security');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');

// 日期格式化辅助函数：确保返回 YYYY-MM-DD 格式
function formatDateForApi(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') {
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
    // 否则提取日期部分
    return dateValue.split('T')[0];
  }
  // Date 对象或其他情况
  return dateValue.toISOString().split('T')[0];
}

// 格式化完整时间戳为 ISO 字符串
function formatDateTime(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue.toISOString();
  return new Date(dateValue).toISOString();
}

// 创建事件
router.post('/', authenticate, checkCalendarOwnership, asyncHandler(async (req, res) => {
  const calendarId = req.params.calendarId;

  // 检查权限（API Key已验证，Token需要检查所有权）
  if (req.authMethod !== 'apikey' && req.calendarOwnerId !== req.userId) {
    throw errors.forbidden('无权向此日历添加事件');
  }

  const { title, startDate, endDate, startTime, endTime, description, location, alarm, alarmMinutes } = req.body;

  if (!title || !startDate) {
    throw errors.badRequest('标题和开始日期不能为空');
  }

  // 日期格式验证
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw errors.badRequest('日期格式应为 YYYY-MM-DD');
  }

  // 加密敏感字段
  const encryptedData = encryptEventData({
    title,
    description: description || '',
    location: location || ''
  });

  const result = await pool.query(
    `INSERT INTO events (calendar_id, title, description, location, start_date, end_date, start_time, end_time, alarm_enabled, alarm_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      calendarId,
      encryptedData.title,
      encryptedData.description,
      encryptedData.location,
      startDate,
      endDate || startDate,
      startTime || null,
      endTime || null,
      alarm !== false,
      alarmMinutes || 15
    ]
  );

  const event = result.rows[0];

  // 解密后返回给客户端
  const decryptedEvent = decryptEventData(event);

  res.status(201).json({
    success: true,
    event: {
      id: decryptedEvent.id,
      calendarId: calendarId,
      title: decryptedEvent.title,
      description: decryptedEvent.description,
      location: decryptedEvent.location,
      startDate: formatDateForApi(decryptedEvent.start_date),
      endDate: formatDateForApi(decryptedEvent.end_date),
      startTime: decryptedEvent.start_time,
      endTime: decryptedEvent.end_time,
      isAllDay: decryptedEvent.is_all_day,
      alarmEnabled: decryptedEvent.alarm_enabled,
      alarmMinutes: decryptedEvent.alarm_minutes,
      createdAt: formatDateTime(decryptedEvent.created_at)
    }
  });
}));

// 获取日历的所有事件
router.get('/', authenticate, checkCalendarOwnership, asyncHandler(async (req, res) => {
  const calendarId = req.params.calendarId;
  const { start, end } = req.query;

  let query = `
    SELECT id, title, description, location, start_date, end_date,
           alarm_enabled, alarm_minutes, created_at
    FROM events
    WHERE calendar_id = $1
  `;
  const params = [calendarId];

  if (start) {
    query += ` AND end_date >= $${params.length + 1}`;
    params.push(start);
  }

  if (end) {
    query += ` AND start_date <= $${params.length + 1}`;
    params.push(end);
  }

  query += ` ORDER BY start_date ASC`;

  const result = await pool.query(query, params);

  // 解密事件列表
  const decryptedEvents = decryptEventList(result.rows);

  const events = decryptedEvents.map(event => ({
    id: event.id,
    calendarId: calendarId,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: formatDateForApi(event.start_date),
    endDate: formatDateForApi(event.end_date),
    startTime: event.start_time,
    endTime: event.end_time,
    isAllDay: event.is_all_day,
    alarmEnabled: event.alarm_enabled,
    alarmMinutes: event.alarm_minutes,
    createdAt: formatDateTime(event.created_at)
  }));

  res.json({
    success: true,
    events
  });
}));

// 获取单个事件
router.get('/:eventId', authenticate, checkCalendarOwnership, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, description, location, start_date, end_date, start_time, end_time, is_all_day,
            alarm_enabled, alarm_minutes, created_at
     FROM events
     WHERE id = $1 AND calendar_id = $2`,
    [req.params.eventId, req.params.calendarId]
  );

  if (result.rows.length === 0) {
    throw errors.notFound('事件不存在');
  }

  // 解密事件数据
  const event = decryptEventData(result.rows[0]);

  res.json({
    success: true,
    event: {
      id: event.id,
      calendarId: req.params.calendarId,
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: formatDateForApi(event.start_date),
      endDate: formatDateForApi(event.end_date),
      startTime: event.start_time,
      endTime: event.end_time,
      isAllDay: event.is_all_day,
      alarmEnabled: event.alarm_enabled,
      alarmMinutes: event.alarm_minutes,
      createdAt: formatDateTime(event.created_at)
    }
  });
}));

// 更新事件
router.put('/:eventId', authenticate, checkCalendarOwnership, asyncHandler(async (req, res) => {
  // 检查权限
  if (req.authMethod !== 'apikey' && req.calendarOwnerId !== req.userId) {
    throw errors.forbidden('无权修改此事件');
  }

  const { title, startDate, endDate, startTime, endTime, description, location, alarm, alarmMinutes } = req.body;

  const updates = [];
  const values = [];
  let paramIndex = 1;

  // 加密需要更新的字段
  const fieldsToEncrypt = {};
  if (title !== undefined) fieldsToEncrypt.title = title;
  if (description !== undefined) fieldsToEncrypt.description = description;
  if (location !== undefined) fieldsToEncrypt.location = location;

  const encryptedFields = encryptEventData(fieldsToEncrypt);

  if (title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(encryptedFields.title);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(encryptedFields.description);
  }
  if (location !== undefined) {
    updates.push(`location = $${paramIndex++}`);
    values.push(encryptedFields.location);
  }
  if (startDate !== undefined) {
    updates.push(`start_date = $${paramIndex++}`);
    values.push(startDate);
  }
  if (endDate !== undefined) {
    updates.push(`end_date = $${paramIndex++}`);
    values.push(endDate);
  }
  if (startTime !== undefined) {
    updates.push(`start_time = $${paramIndex++}`);
    values.push(startTime);
  }
  if (endTime !== undefined) {
    updates.push(`end_time = $${paramIndex++}`);
    values.push(endTime);
  }
  if (alarm !== undefined) {
    updates.push(`alarm_enabled = $${paramIndex++}`);
    values.push(alarm);
  }
  if (alarmMinutes !== undefined) {
    updates.push(`alarm_minutes = $${paramIndex++}`);
    values.push(alarmMinutes);
  }

  if (updates.length === 0) {
    throw errors.badRequest('没有要更新的字段');
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.eventId);
  values.push(req.params.calendarId);

  const result = await pool.query(
    `UPDATE events SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND calendar_id = $${paramIndex + 1}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw errors.notFound('事件不存在');
  }

  // 解密后返回
  const event = decryptEventData(result.rows[0]);

  res.json({
    success: true,
    event: {
      id: event.id,
      calendarId: req.params.calendarId,
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: formatDateForApi(event.start_date),
      endDate: formatDateForApi(event.end_date),
      startTime: event.start_time,
      endTime: event.end_time,
      isAllDay: event.is_all_day,
      alarmEnabled: event.alarm_enabled,
      alarmMinutes: event.alarm_minutes,
      updatedAt: formatDateTime(event.updated_at)
    }
  });
}));

// 删除事件
router.delete('/:eventId', authenticate, checkCalendarOwnership, asyncHandler(async (req, res) => {
  // 检查权限
  if (req.authMethod !== 'apikey' && req.calendarOwnerId !== req.userId) {
    throw errors.forbidden('无权删除此事件');
  }

  const result = await pool.query(
    'DELETE FROM events WHERE id = $1 AND calendar_id = $2 RETURNING id',
    [req.params.eventId, req.params.calendarId]
  );

  if (result.rows.length === 0) {
    throw errors.notFound('事件不存在');
  }

  res.json({
    success: true,
    message: '事件已删除'
  });
}));

module.exports = router;
