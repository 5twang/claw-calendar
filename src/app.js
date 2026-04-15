require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { decryptEventList, decryptCalendarData } = require('./config/security');

const app = express();

// 安全中间件 - Helmet 设置安全 HTTP 头
// 注意：认证表单逻辑已提取到外部 JS 文件，无需 unsafe-inline
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // 允许内联脚本（表单验证等）
      scriptSrcAttr: ["'self'", "'unsafe-inline'"], // 允许内联事件处理器（onclick 等）
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 速率限制 - 防止暴力破解
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 限制 100 次请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// 认证接口更严格的速率限制（测试环境除外）
if (process.env.NODE_ENV !== 'test') {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 登录/注册限制 5 次
    message: { error: '登录尝试次数过多，请 15 分钟后重试' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 静态文件服务（前端界面）
app.use(express.static(path.join(__dirname, '../public')));

// 根路径显示首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
// 导入验证中间件（开发环境验证 API 响应）
if (process.env.NODE_ENV === 'development') {
  const { validateResponse } = require('./middleware/validation');
  // 全局响应验证中间件将在各路由中使用
}
const pool = require('./config/database');

// ============================================================
// CalDAV 服务 (RFC 4791 + RFC 3744)
// 开发环境完全禁用认证（macOS 在 localhost HTTP 上不发送 Basic Auth）
// ============================================================

let caldavUser = null;

/**
 * 初始化 CalDAV 用户（开发环境）
 */
async function initCalDavUser() {
  if (process.env.NODE_ENV !== 'production') {
    const result = await pool.query(
      "SELECT id, email FROM users WHERE email = '2431992@qq.com' AND is_active = true LIMIT 1"
    );
    if (result.rows.length > 0) {
      caldavUser = result.rows[0];
      console.log('[CalDAV] 开发模式：使用用户', caldavUser.email);
    }
  }
}
initCalDavUser();

// /.well-known/caldav -> /dav/
app.get('/.well-known/caldav', (req, res) => {
  res.redirect(301, '/dav/');
});

// CalDAV PROPFIND / OPTIONS
app.all('/dav/', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'OPTIONS, PROPFIND, REPORT');
    res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
    return res.sendStatus(200);
  }

  if (req.method !== 'PROPFIND') {
    return res.status(405).send('Method Not Allowed');
  }

  // 开发环境：直接使用预加载的用户
  if (!caldavUser) {
    return res.status(503).send('CalDAV service unavailable');
  }

  // 获取日历列表
  const calResult = await pool.query(
    "SELECT id, name, color FROM calendars WHERE user_id = $1",
    [caldavUser.id]
  );

  let calendarResponses = '';
  for (const cal of calResult.rows) {
    calendarResponses += `
  <d:response>
    <d:href>/dav/${caldavUser.id}/${encodeURIComponent(cal.name)}/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>
        <d:displayname>${cal.name}</d:displayname>
        <cal:supported-calendar-component-set><cal:comp name="VEVENT"/></cal:supported-calendar-component-set>
        <d:owner><d:href>/principals/${caldavUser.id}/</d:href></d:owner>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;
  }

  const davXml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/dav/</d:href>
    <d:propstat>
      <d:prop>
        <d:principal-URL><d:href>/principals/${caldavUser.id}/</d:href></d:principal-URL>
        <d:current-user-principal><d:href>/principals/${caldavUser.id}/</d:href></d:current-user-principal>
        <cal:calendar-home-set><d:href>/dav/</d:href></cal:calendar-home-set>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>${calendarResponses}
</d:multistatus>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.status(207).send(davXml);
});

// CalDAV 日历 REPORT / PROPPATCH
app.all('/dav/:userId/:calendarName/', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'OPTIONS, PROPFIND, REPORT, PROPPATCH');
    res.setHeader('DAV', '1, 3, calendar-access');
    return res.sendStatus(200);
  }

  if (!caldavUser) {
    return res.status(503).send('CalDAV service unavailable');
  }

  const { userId, calendarName } = req.params;

  if (req.method === 'REPORT') {
    // 查找日历
    const calResult = await pool.query(
      'SELECT id, name FROM calendars WHERE user_id = $1 AND name = $2',
      [caldavUser.id, decodeURIComponent(calendarName)]
    );

    if (calResult.rows.length === 0) {
      return res.status(404).send('Calendar not found');
    }

    const calendarId = calResult.rows[0].id;

    // 获取事件
    const eventsResult = await pool.query(
      'SELECT * FROM events WHERE calendar_id = $1 ORDER BY start_date ASC, start_time ASC',
      [calendarId]
    );

    const events = decryptEventList(eventsResult.rows);
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    let vevents = '';

    for (const event of events) {
      const uid = event.id;
      const calName = calResult.rows[0].name;

      let dtstart, dtend;
      if (event.is_all_day || event.isAllDay) {
        const sd = event.start_date.replace(/-/g, '');
        const ed = event.end_date ? event.end_date.replace(/-/g, '') : sd;
        dtstart = `DTSTART;VALUE=DATE:${sd}`;
        dtend = `DTEND;VALUE=DATE:${ed}`;
      } else {
        const sd = event.start_date.replace(/-/g, '');
        const st = event.start_time ? event.start_time.replace(/:/g, '') : '000000';
        const ed = event.end_date ? event.end_date.replace(/-/g, '') : sd;
        const et = event.end_time ? event.end_time.replace(/:/g, '') : st;
        dtstart = `DTSTART;TZID=Asia/Shanghai:${sd}T${st}`;
        dtend = `DTEND;TZID=Asia/Shanghai:${ed}T${et}`;
      }

      vevents += `
  <d:response>
    <d:href>/dav/${caldavUser.id}/${encodeURIComponent(calName)}/${uid}.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"${uid}"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Claw Calendar//EN\nCALSCALE:GREGORIAN\nX-WR-CALNAME:${calName}\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${now}\n${dtstart}\n${dtend}\nSUMMARY:${event.title || ''}\nDESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}\nLOCATION:${event.location || ''}\nEND:VEVENT\nEND:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(207).send(`<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">${vevents}</d:multistatus>`);
  } else if (req.method === 'PROPPATCH') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(207).send(`<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${req.originalUrl}</d:href><d:propstat><d:prop/><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`);
  } else {
    res.status(405).send('Method Not Allowed');
  }
});

// CalDAV 事件 PUT / DELETE / GET
app.all('/dav/:userId/:calendarName/:eventId.ics', async (req, res) => {
  if (!caldavUser) {
    return res.status(503).send('CalDAV service unavailable');
  }

  const { userId, calendarName, eventId } = req.params;
  const calName = decodeURIComponent(calendarName);

  if (req.method === 'GET') {
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).send('Event not found');
    }
    const event = decryptEventData(eventResult.rows[0]);
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let dtstart, dtend;
    if (event.is_all_day || event.isAllDay) {
      const sd = event.start_date.replace(/-/g, '');
      const ed = event.end_date ? event.end_date.replace(/-/g, '') : sd;
      dtstart = `DTSTART;VALUE=DATE:${sd}`;
      dtend = `DTEND;VALUE=DATE:${ed}`;
    } else {
      const sd = event.start_date.replace(/-/g, '');
      const st = event.start_time ? event.start_time.replace(/:/g, '') : '000000';
      const ed = event.end_date ? event.end_date.replace(/-/g, '') : sd;
      const et = event.end_time ? event.end_time.replace(/:/g, '') : st;
      dtstart = `DTSTART;TZID=Asia/Shanghai:${sd}T${st}`;
      dtend = `DTEND;TZID=Asia/Shanghai:${ed}T${et}`;
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('ETag', `"${eventId}"`);
    res.send(`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Claw Calendar//EN\nCALSCALE:GREGORIAN\nBEGIN:VEVENT\nUID:${eventId}\nDTSTAMP:${now}\n${dtstart}\n${dtend}\nSUMMARY:${event.title || ''}\nDESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}\nLOCATION:${event.location || ''}\nEND:VEVENT\nEND:VCALENDAR`);
  } else if (req.method === 'PUT') {
    // 查找日历
    const calResult = await pool.query(
      'SELECT id FROM calendars WHERE user_id = $1 AND name = $2',
      [caldavUser.id, calName]
    );

    if (calResult.rows.length === 0) {
      return res.status(404).send('Calendar not found');
    }

    const calendarId = calResult.rows[0].id;

    // 解析 iCal
    const icalData = req.body.toString();
    const parsed = parseICalEvent(icalData, eventId);

    if (!parsed) {
      return res.status(400).send('Invalid iCal data');
    }

    // 检查是否已存在
    const existing = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE events SET calendar_id=$1, title=$2, description=$3, location=$4, start_date=$5, end_date=$6, start_time=$7, end_time=$8, is_all_day=$9, updated_at=NOW() WHERE id=$10`,
        [calendarId, parsed.title, parsed.description, parsed.location, parsed.startDate, parsed.endDate, parsed.startTime, parsed.endTime, parsed.isAllDay, eventId]
      );
    } else {
      await pool.query(
        `INSERT INTO events (id, calendar_id, title, description, location, start_date, end_date, start_time, end_time, is_all_day, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [eventId, calendarId, parsed.title, parsed.description, parsed.location, parsed.startDate, parsed.endDate, parsed.startTime, parsed.endTime, parsed.isAllDay]
      );
    }

    res.setHeader('ETag', `"${eventId}"`);
    res.status(201).send(`<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/${caldavUser.id}/${encodeURIComponent(calName)}/${eventId}.ics</d:href><d:status>HTTP/1.1 201 Created</d:status></d:response></d:multistatus>`);
  } else if (req.method === 'DELETE') {
    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    res.status(204).send('');
  } else {
    res.status(405).send('Method Not Allowed');
  }
});

// Principal PROPFIND / OPTIONS
app.all('/principals/', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'OPTIONS, PROPFIND');
    res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
    return res.sendStatus(200);
  }

  if (!caldavUser) {
    return res.status(503).send('CalDAV service unavailable');
  }

  const principalXml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/principals/${caldavUser.id}/</d:href>
    <d:propstat>
      <d:prop>
        <d:principal-collection-set><d:href>/principals/</d:href></d:principal-collection-set>
        <d:current-user-principal><d:href>/principals/${caldavUser.id}/</d:href></d:current-user-principal>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(207).send(principalXml);
});

// Principal PROPFIND
app.all('/principals/:userId/', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'OPTIONS, PROPFIND');
    res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
    return res.sendStatus(200);
  }

  if (!caldavUser) {
    return res.status(503).send('CalDAV service unavailable');
  }

  const { userId } = req.params;
  if (userId !== caldavUser.id) {
    return res.status(403).send('Forbidden');
  }

  const principalXml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/principals/${caldavUser.id}/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>${caldavUser.email}</d:displayname>
        <d:principal-URL><d:href>/principals/${caldavUser.id}/</d:href></d:principal-URL>
        <d:current-user-principal><d:href>/principals/${caldavUser.id}/</d:href></d:current-user-principal>
        <cal:calendar-user-address-set><d:href>mailto:${caldavUser.email}</d:href></cal:calendar-user-address-set>
        <d:supported-report-set>
          <d:supported-report><d:report><cal:calendar-query/></d:report></d:supported-report>
          <d:supported-report><d:report><cal:calendar-multiget/></d:report></d:supported-report>
        </d:supported-report-set>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(207).send(principalXml);
});

// iCal 解析辅助函数
function parseICalEvent(icalData, providedUid) {
  const lines = icalData.split(/\r?\n/);
  const event = {};

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const rawKey = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);
    const key = rawKey.split(';')[0];

    if (key === 'DTSTART') {
      if (rawKey.includes('VALUE=DATE')) {
        event.startDate = value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        event.isAllDay = true;
      } else {
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.startDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.startTime = `${match[4]}:${match[5]}:${match[6]}`;
          event.isAllDay = false;
        }
      }
    } else if (key === 'DTEND') {
      if (rawKey.includes('VALUE=DATE')) {
        event.endDate = value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      } else {
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.endDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.endTime = `${match[4]}:${match[5]}:${match[6]}`;
        }
      }
    } else if (key === 'SUMMARY') {
      event.title = value;
    } else if (key === 'DESCRIPTION') {
      event.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
    } else if (key === 'LOCATION') {
      event.location = value;
    } else if (key === 'UID') {
      event.uid = value;
    }
  }

  if (!event.uid && providedUid) event.uid = providedUid;
  if (!event.endDate) event.endDate = event.startDate;
  if (event.isAllDay && !event.endTime) event.endTime = '23:59:59';

  return event.uid ? event : null;
}

// 路由
app.use('/api/auth', require('./routes/index'));
app.use('/api/auth/password', require('./routes/password'));
app.use('/api/user', require('./routes/user'));
app.use('/api/keys', require('./routes/apiKeys'));
app.use('/api/calendars', require('./routes/calendars'));
app.use('/api/calendars/:calendarId/events', require('./routes/events'));

// ICS订阅路由（需要验证）
app.get('/calendars/:id.ics', async (req, res) => {
  const pool = require('./config/database');
  const { verifyApiKey } = require('./utils/crypto');

  try {
    // 验证订阅 Token
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

    // 解密日历数据
    const calendar = decryptCalendarData(result.rows[0]);

    // 验证订阅 Token
    if (!calendar.subscribe_token || !verifyApiKey(subscribeToken, calendar.subscribe_token)) {
      return res.status(403).send('无效的订阅令牌');
    }

    // 获取事件
    const eventsResult = await pool.query(
      `SELECT * FROM events
       WHERE calendar_id = $1
       ORDER BY start_date ASC`,
      [req.params.id]
    );

    // 解密事件数据
    const events = decryptEventList(eventsResult.rows);

    // 生成ICS内容
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Claw Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendar.name}`,
      `X-WR-CALDESC:${calendar.description || ''}`,
      'X-WR-TIMEZONE:Asia/Shanghai',
    ];

    events.forEach(event => {
      const startDate = event.start_date.replace(/-/g, '');
      const endDate = event.end_date.replace(/-/g, '');

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${event.id}@claw-calendar`);
      icsContent.push(`DTSTAMP:${now}`);
      icsContent.push(`DTSTART;VALUE=DATE:${startDate}`);
      icsContent.push(`DTEND;VALUE=DATE:${endDate}`);
      icsContent.push(`SUMMARY:${event.title}`);

      if (event.description) {
        icsContent.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
      }
      if (event.location) {
        icsContent.push(`LOCATION:${event.location}`);
      }

      if (event.alarm_enabled) {
        icsContent.push('BEGIN:VALARM');
        icsContent.push('ACTION:DISPLAY');
        icsContent.push('DESCRIPTION:Reminder');
        icsContent.push(`TRIGGER:-PT${event.alarm_minutes}M`);
        icsContent.push('END:VALARM');
      }

      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    // 使用固定 ASCII 文件名避免 HTTP 头非法字符问题
    res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(icsContent.join('\r\n'));

  } catch (err) {
    console.error('生成ICS错误:', err);
    res.status(500).send('服务器错误');
  }
});

// 健康检查
app.get('/health', (req, res) => {
  const { getSecurityStatus } = require('./config/security');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    security: getSecurityStatus()
  });
});

// 404处理
app.use(notFoundHandler);

// 错误处理（必须是最后一个中间件）
app.use(errorHandler);

module.exports = app;
