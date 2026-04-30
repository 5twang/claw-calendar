/**
 * CalDAV 服务器实现 (RFC 4791 + RFC 3744)
 *
 * 支持：
 * - RFC 6764 服务发现：/.well-known/caldav -> /dav/
 * - RFC 3744 Principal 端点：/principals/
 * - 日历集合操作：PROPFIND, PUT, DELETE, REPORT
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const pool = require('../config/database');
const { decryptCalendarData, decryptEventList, decryptEventData, encryptEventData } = require('../config/security');
const { DEFAULT_TIMEZONE } = require('../utils/constants');
const { verifyPassword } = require('../utils/crypto');

// ============================================================
// 辅助函数
// ============================================================

/**
 * XML 特殊字符转义
 * 防止 XML 注入攻击
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 开发环境默认用户（仅测试环境可用）
const DEV_CALDAV_USER = process.env.NODE_ENV === 'test' ? process.env.DEV_CALDAV_USER : null;

/**
 * CalDAV Basic Auth 验证
 * 仅在测试环境下允许使用 DEV_CALDAV_USER 环境变量
 */
async function caldavAuthenticate(req) {
  // 详细日志
  const requestId = Date.now();
  console.log(`[CalDAV-Auth-${requestId}] ====================`);
  console.log(`[CalDAV-Auth-${requestId}] URL: ${req.method} ${req.originalUrl}`);
  console.log(`[CalDAV-Auth-${requestId}] Headers:`, JSON.stringify({
    authorization: req.headers.authorization ? '(present)' : '(missing)',
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent']
  }));

  // 测试环境：使用环境变量指定的默认用户
  if (DEV_CALDAV_USER) {
    console.log(`[CalDAV-Auth-${requestId}] DEV mode, using: ${DEV_CALDAV_USER}`);
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
      [DEV_CALDAV_USER]
    );
    if (userResult.rows.length > 0) {
      return userResult.rows[0];
    }
  }

  // 生产环境：正常 Basic Auth
  const authHeader = req.headers.authorization;
  console.log(`[CalDAV-Auth-${requestId}] authHeader: ${authHeader ? authHeader.substring(0, 50) + '...' : 'null'}`);
  
  if (!authHeader) {
    console.log(`[CalDAV-Auth-${requestId}] FAIL: No authorization header`);
    return null;
  }
  
  if (!authHeader.startsWith('Basic ')) {
    console.log(`[CalDAV-Auth-${requestId}] FAIL: Not Basic auth (starts with: ${authHeader.substring(0, 20)})`);
    return null;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    console.log(`[CalDAV-Auth-${requestId}] base64Credentials length: ${base64Credentials ? base64Credentials.length : 0}`);
    
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    console.log(`[CalDAV-Auth-${requestId}] decoded credentials length: ${credentials.length}`);
    console.log(`[CalDAV-Auth-${requestId}] decoded credentials: ${credentials.substring(0, 50)}...`);
    
    // 正确处理密码中可能包含冒号的情况
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) {
      console.log(`[CalDAV-Auth-${requestId}] FAIL: Invalid credentials format (no colon separator)`);
      return null;
    }
    
    const email = credentials.substring(0, colonIndex);
    const password = credentials.substring(colonIndex + 1);
    console.log(`[CalDAV-Auth-${requestId}] email: ${email}, password length: ${password ? password.length : 0}`);

    const userResult = await pool.query(
      'SELECT id, email, password_hash, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    console.log(`[CalDAV-Auth-${requestId}] DB query result: found ${userResult.rows.length} user(s)`);

    if (userResult.rows.length === 0) {
      console.log(`[CalDAV-Auth-${requestId}] FAIL: User not found`);
      return null;
    }

    const user = userResult.rows[0];
    console.log(`[CalDAV-Auth-${requestId}] User found: id=${user.id}, email=${user.email}, is_active=${user.is_active}`);
    console.log(`[CalDAV-Auth-${requestId}] password_hash length: ${(user.password_hash || '').length}`);
    
    // 检查 is_active
    if (!user.is_active) {
      console.log(`[CalDAV-Auth-${requestId}] FAIL: User not active`);
      return null;
    }

    // 验证密码
    const passwordValid = await verifyPassword(password, user.password_hash || '');
    console.log(`[CalDAV-Auth-${requestId}] Password verification: ${passwordValid ? 'SUCCESS' : 'FAILED'}`);
    
    if (!passwordValid) {
      console.log(`[CalDAV-Auth-${requestId}] FAIL: Wrong password`);
    }

    return passwordValid ? user : null;
  } catch (err) {
    console.error(`[CalDAV-Auth-${requestId}] ERROR:`, err);
    return null;
  }
}

// 检查认证中间件（必须在路由定义之前注册）
async function requireAuth(req, res, next) {
  // OPTIONS 请求不需要认证，直接放行
  if (req.method === 'OPTIONS') {
    return next();
  }

  const user = await caldavAuthenticate(req);
  if (!user) {
    // macOS/iOS 要求 WWW-Authenticate 包含 realm 才能显示密码提示框
    res.setHeader('WWW-Authenticate', 'Basic realm="Claw Calendar", charset="UTF-8"');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
    // CalDAV RFC 要求 401 响应
    return res.status(401).send(`<?xml version="1.0" encoding="UTF-8"?>
<d:error xmlns:d="DAV:">
  <d:valid-nonce/>
</d:error>`);
  }
  req.caldavUser = user;
  next();
}

// 应用认证到所有 CalDAV 路由（必须在路由定义之前）
router.use(requireAuth);

// ============================================================
// 服务发现 (RFC 6764)
// ============================================================

// /.well-known/caldav -> /dav/
router.get('/.well-known/caldav', (req, res) => {
  res.redirect(301, '/dav/');
});

// ============================================================
// 动态路由处理（支持 /dav 和 /principals 两个挂载点）
// ============================================================

// 检测挂载点：/dav 或 /principals
function getMountPoint(req) {
  const baseUrl = req.baseUrl;
  if (baseUrl.endsWith('/dav')) return '/dav';
  if (baseUrl.endsWith('/principals')) return '/principals';
  return baseUrl || '/dav';
}

// /dav/ 或 /principals/ 根路径处理
router.all('/', async (req, res, next) => {
  const mountPoint = getMountPoint(req);

  if (mountPoint === '/principals') {
    // /principals/ 作为 principals 列表处理
    if (req.method === 'PROPFIND') {
      return handlePrincipals(req, res);
    }
    if (req.method === 'OPTIONS') {
      return handlePrincipalsOptions(req, res);
    }
  }

  // /dav/ 作为日历主页处理
  if (mountPoint === '/dav') {
    if (req.method === 'PROPFIND') {
      return handleDavRoot(req, res);
    }
    if (req.method === 'OPTIONS') {
      return handleDavRootOptions(req, res);
    }
  }

  next();
});

// /dav/principals/ 或 /principals/principals/ - principals 列表（备用）
router.all('/principals/', async (req, res, next) => {
  if (req.method === 'PROPFIND') {
    return handlePrincipals(req, res);
  }
  if (req.method === 'OPTIONS') {
    return handlePrincipalsOptions(req, res);
  }
  next();
});

// /dav/principals/:userId/ 或 /principals/:userId/ - 用户 principal
router.all('/principals/:userId/', async (req, res, next) => {
  if (req.method === 'PROPFIND') {
    return handlePrincipal(req, res);
  }
  if (req.method === 'OPTIONS') {
    return handlePrincipalOptions(req, res);
  }
  next();
});

// /dav/:userId/:calendarName/ - 日历集合
router.all('/:userId/:calendarName/', async (req, res, next) => {
  if (req.method === 'REPORT') {
    return handleReportEvents(req, res);
  }
  if (req.method === 'PROPPATCH') {
    return handleProppatch(req, res);
  }
  if (req.method === 'OPTIONS') {
    return handleCalendarOptions(req, res);
  }
  next();
});

// /dav/:userId/:calendarName/:eventId.ics - 事件操作
router.all('/:userId/:calendarName/:eventId.ics', async (req, res, next) => {
  if (req.method === 'PUT') {
    return handlePutEvent(req, res);
  }
  if (req.method === 'DELETE') {
    return handleDeleteEvent(req, res);
  }
  if (req.method === 'GET') {
    return handleGetEvent(req, res);
  }
  next();
});

// ============================================================
// CalDAV 处理函数
// ============================================================

// ============================================================
// Principal 处理
// ============================================================

async function handlePrincipals(req, res) {
  const user = req.caldavUser;

  const userPrincipal = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:response>
    <d:href>/principals/${user.id}/</d:href>
    <d:propstat>
      <d:prop>
        <d:principal-collection-set>
          <d:href>/principals/</d:href>
        </d:principal-collection-set>
        <d:current-user-principal>
          <d:href>/principals/${user.id}/</d:href>
        </d:current-user-principal>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.status(207).send(userPrincipal);
}

async function handlePrincipalsOptions(req, res) {
  // macOS/iOS CalDAV 客户端需要这些头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, PROPFIND');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth, DAV');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Allow', 'OPTIONS, PROPFIND');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.sendStatus(200);
}

async function handlePrincipal(req, res) {
  const user = req.caldavUser;
  const userId = req.params.userId;

  // 验证请求的是自己的 principal
  if (userId !== user.id) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(403).send(`<?xml version="1.0" encoding="UTF-8"?>
<d:error xmlns:d="DAV:">
  <d:privilege><d:read/></d:privilege>
</d:error>`);
  }

  const principalXml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:response>
    <d:href>/principals/${user.id}/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>${escapeXml(user.email)}</d:displayname>
        <d:principal-URL>
          <d:href>/principals/${user.id}/</d:href>
        </d:principal-URL>
        <d:canonical-URL>
          <d:href>/principals/${user.id}/</d:href>
        </d:canonical-URL>
        <d:current-user-principal>
          <d:href>/principals/${user.id}/</d:href>
        </d:current-user-principal>
        <cal:calendar-user-address-set>
          <d:href>mailto:${escapeXml(user.email)}</d:href>
        </cal:calendar-user-address-set>
        <d:supported-report-set>
          <d:supported-report>
            <d:report><cal:calendar-query/></d:report>
          </d:supported-report>
          <d:supported-report>
            <d:report><cal:calendar-multiget/></d:report>
          </d:supported-report>
        </d:supported-report-set>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.status(207).send(principalXml);
}

async function handlePrincipalOptions(req, res) {
  // macOS/iOS CalDAV 客户端需要这些头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, PROPFIND');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth, DAV');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Allow', 'OPTIONS, PROPFIND');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.sendStatus(200);
}

// ============================================================
// CalDAV 根路径
// ============================================================

async function handleDavRoot(req, res) {
  const user = req.caldavUser;

  // 获取用户的日历列表
  const calResult = await pool.query(
    "SELECT id, name, color FROM calendars WHERE user_id = $1",
    [user.id]
  );

  let calendarResponses = '';
  for (const cal of calResult.rows) {
    calendarResponses += `
  <d:response>
    <d:href>/dav/${user.id}/${encodeURIComponent(cal.name)}/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype>
          <d:collection/>
          <cal:calendar/>
        </d:resourcetype>
        <d:displayname>${escapeXml(cal.name)}</d:displayname>
        <cal:calendar-description>${escapeXml(cal.name)}</cal:calendar-description>
        <cal:supported-calendar-component-set>
          <cal:comp name="VEVENT"/>
        </cal:supported-calendar-component-set>
        <d:owner>
          <d:href>/principals/${user.id}/</d:href>
        </d:owner>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;
  }

  // 添加 principal-URL 和 calendar-home-set
  const davXml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:card="urn:ietf:params:xml:ns:carddav" xmlns:apple="http://apple.com/ns/ical/">
  <d:response>
    <d:href>/dav/</d:href>
    <d:propstat>
      <d:prop>
        <d:principal-URL>
          <d:href>/principals/${user.id}/</d:href>
        </d:principal-URL>
        <d:current-user-principal>
          <d:href>/principals/${user.id}/</d:href>
        </d:current-user-principal>
        <d:current-user-privilege-set>
          <d:privilege><d:read/></d:privilege>
          <d:privilege><d:write/></d:privilege>
          <d:privilege><cal:schedule-deliver/></d:privilege>
        </d:current-user-privilege-set>
        <cal:calendar-home-set>
          <d:href>/dav/</d:href>
        </cal:calendar-home-set>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>${calendarResponses}
</d:multistatus>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.status(207).send(davXml);
}

async function handleDavRootOptions(req, res) {
  // macOS/iOS CalDAV 客户端需要这些头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, PROPFIND, REPORT, PROPPATCH, PUT, DELETE, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth, DAV, If-None-Match, If-Match');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Allow', 'OPTIONS, PROPFIND, REPORT, PROPPATCH, PUT, DELETE, GET');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.sendStatus(200);
}

async function handleCalendarOptions(req, res) {
  // macOS/iOS CalDAV 客户端需要这些头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, PROPFIND, REPORT, PROPPATCH, PUT, DELETE, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth, DAV, If-None-Match, If-Match, Prefer');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Allow', 'OPTIONS, PROPFIND, REPORT, PROPPATCH, PUT, DELETE, GET');
  res.setHeader('DAV', '1, 3, calendar-access, calendar-proxy');
  res.sendStatus(200);
}

// ============================================================
// 日历事件操作
// ============================================================

async function handlePutEvent(req, res) {
  const user = req.caldavUser;
  const { userId, calendarName, eventId } = req.params;

  // 验证用户
  if (userId !== user.id) {
    return res.status(403).send('Forbidden');
  }

  // 查找日历
  const calResult = await pool.query(
    'SELECT id FROM calendars WHERE user_id = $1 AND name = $2',
    [user.id, calendarName]
  );

  if (calResult.rows.length === 0) {
    return res.status(404).send('Calendar not found');
  }

  const calendarId = calResult.rows[0].id;

  // 解析 iCal 数据
  const icalData = req.body.toString();
  const parsed = parseICalEvent(icalData, eventId);

  if (!parsed) {
    return res.status(400).send('Invalid iCal data');
  }

  // 检查事件是否已存在
  const existingResult = await pool.query(
    'SELECT id FROM events WHERE id = $1',
    [eventId]
  );

  if (existingResult.rows.length > 0) {
    // 更新
    await pool.query(
      `UPDATE events SET
        calendar_id = $1, title = $2, description = $3, location = $4,
        start_date = $5, end_date = $6, start_time = $7, end_time = $8, is_all_day = $9,
        updated_at = NOW()
      WHERE id = $10`,
      [calendarId, parsed.title, parsed.description, parsed.location,
       parsed.startDate, parsed.endDate, parsed.startTime, parsed.endTime, parsed.isAllDay,
       eventId]
    );
  } else {
    // 创建（使用客户端提供的 UID）
    await pool.query(
      `INSERT INTO events (id, calendar_id, title, description, location, start_date, end_date, start_time, end_time, is_all_day, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [eventId, calendarId, parsed.title, parsed.description, parsed.location,
       parsed.startDate, parsed.endDate, parsed.startTime, parsed.endTime, parsed.isAllDay]
    );
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('ETag', `"${eventId}"`);
  res.status(201).send(`<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/${user.id}/${encodeURIComponent(calendarName)}/${eventId}.ics</d:href>
    <d:status>HTTP/1.1 201 Created</d:status>
  </d:response>
</d:multistatus>`);
}

async function handleDeleteEvent(req, res) {
  const user = req.caldavUser;
  const { userId, calendarName, eventId } = req.params;

  // 验证用户
  if (userId !== user.id) {
    return res.status(403).send('Forbidden');
  }

  // 删除事件
  await pool.query('DELETE FROM events WHERE id = $1', [eventId]);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(204).send('');
}

async function handleGetEvent(req, res) {
  const user = req.caldavUser;
  const { userId, calendarName, eventId } = req.params;

  // 验证用户
  if (userId !== user.id) {
    return res.status(403).send('Forbidden');
  }

  // 获取事件
  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);

  if (eventResult.rows.length === 0) {
    return res.status(404).send('Event not found');
  }

  const event = decryptEventData(eventResult.rows[0]);

  // 生成 ICS
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let dtstart, dtend;

  if (event.is_all_day || event.isAllDay) {
    const startDate = event.start_date.replace(/-/g, '');
    const endDate = event.end_date ? event.end_date.replace(/-/g, '') : startDate;
    dtstart = `DTSTART;VALUE=DATE:${startDate}`;
    dtend = `DTEND;VALUE=DATE:${endDate}`;
  } else {
    const startDate = event.start_date.replace(/-/g, '');
    const startTime = event.start_time ? event.start_time.replace(/:/g, '') : '000000';
    const endDate = event.end_date ? event.end_date.replace(/-/g, '') : startDate;
    const endTime = event.end_time ? event.end_time.replace(/:/g, '') : startTime;
    dtstart = `DTSTART;TZID=${DEFAULT_TIMEZONE}:${startDate}T${startTime}`;
    dtend = `DTEND;TZID=${DEFAULT_TIMEZONE}:${endDate}T${endTime}`;
  }

  // ICS 格式特殊字符转义（RFC 5545）
  const icsEscape = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')  // 反斜杠转义
      .replace(/;/g, '\\;')     // 分号转义
      .replace(/,/g, '\\,')    // 逗号转义
      .replace(/\n/g, '\\n');  // 换行符转义
  };

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Claw Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${icsEscape(calendarName)}
BEGIN:VEVENT
UID:${eventId}
DTSTAMP:${now}
${dtstart}
${dtend}
SUMMARY:${icsEscape(event.title || '')}
DESCRIPTION:${icsEscape(event.description || '')}
LOCATION:${icsEscape(event.location || '')}
END:VEVENT
END:VCALENDAR`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('ETag', `"${eventId}"`);
  res.send(ics);
}

async function handleReportEvents(req, res) {
  const user = req.caldavUser;
  const { userId, calendarName } = req.params;

  // 验证用户
  if (userId !== user.id) {
    return res.status(403).send('Forbidden');
  }

  // 查找日历
  const calResult = await pool.query(
    'SELECT id, name FROM calendars WHERE user_id = $1 AND name = $2',
    [user.id, calendarName]
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

  // 生成 VCALENDAR 响应
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let vevents = '';

  // ICS 格式特殊字符转义（RFC 5545）
  const icsEscape = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  for (const event of events) {
    const uid = event.id;
    const summary = icsEscape(event.title || '');
    const description = icsEscape(event.description || '');
    const location = icsEscape(event.location || '');

    // 处理日期时间格式
    let dtstart, dtend;
    if (event.is_all_day || event.isAllDay) {
      const startDate = event.start_date.replace(/-/g, '');
      const endDate = event.end_date ? event.end_date.replace(/-/g, '') : startDate;
      dtstart = `DTSTART;VALUE=DATE:${startDate}`;
      dtend = `DTEND;VALUE=DATE:${endDate}`;
    } else {
      const startDate = event.start_date.replace(/-/g, '');
      const startTime = event.start_time ? event.start_time.replace(/:/g, '') : '000000';
      const endDate = event.end_date ? event.end_date.replace(/-/g, '') : startDate;
      const endTime = event.end_time ? event.end_time.replace(/:/g, '') : startTime;
      dtstart = `DTSTART;TZID=${DEFAULT_TIMEZONE}:${startDate}T${startTime}`;
      dtend = `DTEND;TZID=${DEFAULT_TIMEZONE}:${endDate}T${endTime}`;
    }

    vevents += `
  <d:response>
    <d:href>/dav/${user.id}/${encodeURIComponent(calendarName)}/${uid}.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"${uid}"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Claw Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${icsEscape(calendarName)}
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
${dtstart}
${dtend}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${location}
END:VEVENT
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;
  }

  const reportXml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">${vevents}
</d:multistatus>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('DAV', '1, 3, calendar-access');
  res.status(207).send(reportXml);
}

async function handleProppatch(req, res) {
  // 简化实现：返回成功
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('DAV', '1, 3, calendar-access');
  res.status(207).send(`<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${req.originalUrl}</d:href>
    <d:propstat>
      <d:prop/>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`);
}

// ============================================================
// iCal 解析
// ============================================================

function parseICalEvent(icalData, providedUid) {
  const lines = icalData.split(/\r?\n/);
  const event = {};

  for (const line of lines) {
    // 处理行折叠
    if (line.startsWith(' ') || line.startsWith('\t')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const rawKey = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);

    // 提取基础键名（去掉参数部分）
    const key = rawKey.split(';')[0];

    // 处理 DTSTART
    if (key === 'DTSTART') {
      if (rawKey.includes('VALUE=DATE')) {
        // 全天事件
        event.startDate = value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        event.isAllDay = true;
      } else if (rawKey.includes('TZID=')) {
        // 带时区的时间事件
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.startDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.startTime = `${match[4]}:${match[5]}:${match[6]}`;
          event.isAllDay = false;
        }
      } else {
        // 纯时间
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.startDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.startTime = `${match[4]}:${match[5]}:${match[6]}`;
        }
      }
    }
    // 处理 DTEND
    else if (key === 'DTEND') {
      if (rawKey.includes('VALUE=DATE')) {
        event.endDate = value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      } else if (rawKey.includes('TZID=')) {
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.endDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.endTime = `${match[4]}:${match[5]}:${match[6]}`;
        }
      } else {
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.endDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.endTime = `${match[4]}:${match[5]}:${match[6]}`;
        }
      }
    }
    // 处理其他字段
    else if (key === 'SUMMARY') {
      event.title = value;
    } else if (key === 'DESCRIPTION') {
      event.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
    } else if (key === 'LOCATION') {
      event.location = value;
    } else if (key === 'UID') {
      event.uid = value;
    }
  }

  // 如果没有提供 UID，使用路径参数
  if (!event.uid && providedUid) {
    event.uid = providedUid;
  }

  // 如果没有结束日期，使用开始日期
  if (!event.endDate) {
    event.endDate = event.startDate;
  }

  // 如果是全天事件且没有结束时间，设置默认结束时间
  if (event.isAllDay && !event.endTime) {
    event.endTime = '23:59:59';
  }

  return event.uid ? event : null;
}

module.exports = router;
