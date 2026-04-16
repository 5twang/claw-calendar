require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const pool = require('./config/database');
const { setupSecurity } = require('./config/security-middleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { logger } = require('./middleware/logger');
const { decryptCalendarData, verifyApiKey } = require('./config/security');
const caldavRouter = require('./routes/caldav');
const { getCurrentTimestamp, formatDateForICal } = require('./utils/ical');
const { DEFAULT_TIMEZONE } = require('./utils/constants');

// ============ Swagger/OpenAPI 文档（仅开发环境）===========
if (process.env.NODE_ENV !== 'production') {
  try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerJsdoc = require('swagger-jsdoc');
    
    const swaggerSpec = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Claw Calendar API',
          version: '1.0.0',
          description: '面向开发者的日历 API 服务'
        },
        servers: [{ url: 'http://localhost:3000' }]
      },
      apis: []
    };

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerSpec), {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Claw Calendar API'
    }));
    console.log('📚 API 文档已启用: http://localhost:3000/api-docs');
  } catch (err) {
    // Swagger 未安装时静默跳过
  }
}

// ============ 安全中间件 ============
setupSecurity(app);

// ============ 基础中间件 ============
app.use(cors());
app.use(bodyParser.json());
app.use(logger);

// 静态文件服务（前端界面）
app.use(express.static(path.join(__dirname, '../public')));

// 根路径显示首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============ CalDAV 服务 (RFC 4791) ============
app.use('/dav', caldavRouter);
app.use('/principals', caldavRouter);

// /.well-known/caldav -> /dav/
app.get('/.well-known/caldav', (req, res) => {
  res.redirect(301, '/dav/');
});

// ============ REST API 路由 ============
app.use('/api/auth', require('./routes/index'));
app.use('/api/auth/password', require('./routes/password'));
app.use('/api/user', require('./routes/user'));
app.use('/api/keys', require('./routes/apiKeys'));
app.use('/api/calendars', require('./routes/calendars'));
app.use('/api/calendars/:calendarId/events', require('./routes/events'));

// ============ ICS 订阅路由 ============
app.get('/calendars/:id.ics', async (req, res) => {
  try {
    const subscribeToken = req.query.token;
    if (!subscribeToken) {
      return res.status(401).send('缺少订阅令牌');
    }

    const result = await pool.query(
      `SELECT c.*, u.email as user_email
       FROM calendars c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('日历不存在');
    }

    const calendar = decryptCalendarData(result.rows[0]);

    if (!calendar.subscribe_token || !verifyApiKey(subscribeToken, calendar.subscribe_token)) {
      return res.status(403).send('无效的订阅令牌');
    }

    const eventsResult = await pool.query(
      `SELECT * FROM events WHERE calendar_id = $1 ORDER BY start_date ASC`,
      [req.params.id]
    );

    const { decryptEventList } = require('./config/security');
    const events = decryptEventList(eventsResult.rows);

    const now = getCurrentTimestamp();
    const icsContent = generateICS(calendar, events);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(icsContent);

  } catch (err) {
    console.error('生成ICS错误:', err);
    res.status(500).send('服务器错误');
  }
});

/**
 * 生成 ICS 格式内容
 */
function generateICS(calendar, events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Claw Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendar.name}`,
    `X-WR-CALDESC:${calendar.description || ''}`,
    `X-WR-TIMEZONE:${DEFAULT_TIMEZONE}`,
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@claw-calendar`);
    lines.push(`DTSTAMP:${getCurrentTimestamp()}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDateForICal(event.start_date)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateForICal(event.end_date)}`);
    lines.push(`SUMMARY:${event.title}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${event.location}`);
    }

    if (event.alarm_enabled) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Reminder');
      lines.push(`TRIGGER:-PT${event.alarm_minutes}M`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ============ 健康检查 ============
app.get('/health', (req, res) => {
  const { getSecurityStatus } = require('./config/security');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    security: getSecurityStatus()
  });
});

// ============ 错误处理 ============
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
