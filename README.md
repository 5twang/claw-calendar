# Claw Calendar

> Calendar Skills 智能日历助手 - 多种方式写入，手机原生日历查看

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## 简介

Claw Calendar 是一款 **Calendar Skills 智能日历助手**，支持：

- **普通用户**：订阅 Calendar Skill，让 App 自动把重要日期写进手机日历
- **开发者**：通过 API 为应用添加日历功能

用户通过手机原生日历（iOS Calendar、Android Calendar、macOS Calendar、HarmonyOS）订阅即可自动同步，**无需安装额外 App**。

**官方网站**: https://claw-calendar.com

---

## 核心特性

### Calendar Skills - 智能日历助手
| Skill | 说明 |
|-------|------|
| 📈 **股票日历** | 自动追踪持仓股票的分红、财报、会议 |
| 💼 **会议助手** | 预约会议、自动发送 ICS 订阅链接 |
| 🏥 **健康提醒** | 体检、复查、用药提醒 |
| 📚 **学习计划** | 课程表、作业截止、考试日期 |
| 📦 **物流追踪** | 快递到达预计时间自动提醒 |

### 写入方式
| 方式 | 说明 |
|------|------|
| 🤖 **智能助手写入** | AI 自动分析重要日期并写入日历 |
| 📱 **API 写入** | RESTful API，应用集成 |
| 📅 **iCalendar 订阅** | .ics 订阅链接，跨平台同步 |

### 技术特性
| 特性 | 说明 |
|------|------|
| 📅 **iCalendar 标准** | 完全兼容 RFC 5545，支持 .ics 订阅 |
| 📱 **跨平台订阅** | 支持 iOS、Android、macOS、HarmonyOS |
| 🔐 **数据加密** | AES-256-GCM 全数据加密 |
| 🚀 **高可用** | 支持 Docker 部署，易于水平扩展 |
| 🐳 **容器化部署** | Docker Compose 一键部署 |

---

## 快速开始

### 1. 安装

```bash
git clone https://gitee.com/yourusername/claw-calendar.git
cd claw-calendar
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 服务配置
PORT=3000
NODE_ENV=development

# 数据库（可选，使用 JSON 文件存储则无需配置）
# DATABASE_URL=postgresql://user:password@localhost:5432/clawcalendar

# 加密配置（生产环境必须设置）
ENCRYPTION_KEY=your-32-byte-encryption-key-here
ENCRYPTION_LEVEL=full

# 邮件配置（发送验证邮件）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
SMTP_FROM=Claw Calendar <noreply@claw-calendar.com>

# JWT 配置
JWT_SECRET=your-jwt-secret-key-here
```

### 3. 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

服务启动后访问 http://localhost:3000

---

## API 文档

**Base URL**: `https://claw-calendar.com`
**认证方式**: Bearer Token (JWT)

### 认证接口

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password",
  "name": "用户名（可选）"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "注册成功！验证邮件已发送到您的邮箱",
  "requireVerification": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

---

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**响应示例**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "用户名"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 获取当前用户
```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

#### 修改密码
```http
PUT /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "current-password",
  "newPassword": "new-password"
}
```

---

#### 忘记密码
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

---

#### 重置密码
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "new-password"
}
```

---

### 日历管理

#### 创建日历
```http
POST /api/calendars
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "我的日历",
  "description": "个人日程提醒",
  "color": "#4f46e5",
  "isPublic": false
}
```

**响应示例**:
```json
{
  "success": true,
  "calendar": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "我的日历",
    "description": "个人日程提醒",
    "color": "#4f46e5",
    "isPublic": false,
    "subscriptionUrl": "https://claw-calendar.com/calendars/550e8400...ics?token=xxx",
    "subscribeToken": "xxx",
    "createdAt": "2026-04-08T09:00:00.000Z"
  }
}
```

---

#### 获取日历列表
```http
GET /api/calendars
Authorization: Bearer <token>
```

---

#### 获取单个日历
```http
GET /api/calendars/:id
Authorization: Bearer <token>
```

---

#### 更新日历
```http
PUT /api/calendars/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新名称",
  "description": "新描述",
  "color": "#ef4444"
}
```

---

#### 删除日历
```http
DELETE /api/calendars/:id
Authorization: Bearer <token>
```

---

### 事件管理

#### 创建事件
```http
POST /api/calendars/:calendarId/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "股票分红提醒",
  "description": "招商银行分红除权日",
  "location": "深圳",
  "startDate": "2026-04-15",
  "endDate": "2026-04-15",
  "startTime": "09:30:00",
  "endTime": "10:30:00",
  "alarm": true,
  "alarmMinutes": 15
}
```

**响应示例**:
```json
{
  "success": true,
  "event": {
    "id": "evt-123456",
    "title": "股票分红提醒",
    "description": "招商银行分红除权日",
    "location": "深圳",
    "startDate": "2026-04-15",
    "endDate": "2026-04-15",
    "startTime": "09:30:00",
    "endTime": "10:30:00",
    "alarm": true,
    "alarmMinutes": 15,
    "createdAt": "2026-04-08T09:00:00.000Z"
  }
}
```

---

#### 获取事件列表
```http
GET /api/calendars/:calendarId/events
Authorization: Bearer <token>

# 支持日期范围筛选
GET /api/calendars/:calendarId/events?start=2026-04-01&end=2026-04-30
```

---

#### 获取单个事件
```http
GET /api/calendars/:calendarId/events/:eventId
Authorization: Bearer <token>
```

---

#### 更新事件
```http
PUT /api/calendars/:calendarId/events/:eventId
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "更新后的标题",
  "alarmMinutes": 30
}
```

---

#### 删除事件
```http
DELETE /api/calendars/:calendarId/events/:eventId
Authorization: Bearer <token>
```

---

### iCalendar 订阅

#### 订阅日历（无需认证）
```http
GET /calendars/:calendarId.ics?token=<subscribeToken>
```

返回标准的 `.ics` 文件，可直接添加到手机日历。

**订阅方法**：
- **iOS/Android**: 复制订阅链接，在系统日历中添加订阅
- **macOS**: 文件 → 新建日历订阅
- **HarmonyOS**: 日历 → 更多 → 通过链接添加

---

### 健康检查
```http
GET /health
```

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-08T09:00:00.000Z",
  "security": {
    "encryption": "enabled",
    "encryptionLevel": "full"
  }
}
```

---

## 使用场景

### 场景一：股票投资提醒

```javascript
// 监听财经新闻，自动写入日历
const response = await fetch('https://claw-calendar.com/api/calendars', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '股票提醒',
    description: '持仓股票重要日期'
  })
});

// 创建事件
await fetch('https://claw-calendar.com/api/calendars/xxx/events', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: '招商银行分红',
    startDate: '2026-04-15',
    alarm: true,
    alarmMinutes: 1440  // 提前1天提醒
  })
});
```

### 场景二：CURL 调用示例

```bash
# 用户登录获取 Token
curl -X POST https://claw-calendar.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}'

# 创建日历
curl -X POST https://claw-calendar.com/api/calendars \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "我的日历", "color": "#4f46e5"}'

# 添加事件
curl -X POST https://claw-calendar.com/api/calendars/:id/events \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"title": "会议", "startDate": "2026-04-15", "alarm": true}'
```

---

## 部署

### Docker Compose 部署（推荐）

```bash
# 克隆项目
git clone https://gitee.com/yourusername/claw-calendar.git
cd claw-calendar

# 配置环境变量
cp .env.production.example .env
# 编辑 .env 文件

# 启动服务
docker-compose up -d
```

### 环境变量

| 变量 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `PORT` | 服务端口 | 否 | 3000 |
| `NODE_ENV` | 运行环境 | 否 | development |
| `DATA_DIR` | 数据存储目录 | 否 | ./data |
| `DATABASE_URL` | PostgreSQL 连接字符串 | 否 | 使用 JSON 文件 |
| `ENCRYPTION_KEY` | 加密密钥（32字节） | 生产必填 | - |
| `ENCRYPTION_LEVEL` | 加密级别 | 否 | full |
| `JWT_SECRET` | JWT 签名密钥 | 生产必填 | - |
| `SMTP_HOST` | SMTP 服务器 | 否 | - |
| `SMTP_PORT` | SMTP 端口 | 否 | 587 |
| `SMTP_USER` | SMTP 用户名 | 否 | - |
| `SMTP_PASS` | SMTP 密码 | 否 | - |
| `SMTP_FROM` | 发件人地址 | 否 | noreply@localhost |

---

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: PostgreSQL / JSON 文件
- **认证**: JWT + Bearer Token
- **加密**: AES-256-GCM
- **邮件**: Nodemailer
- **安全**: Helmet + Rate Limiting
- **标准**: iCalendar (RFC 5545)

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如邮箱已注册） |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 开发

### 运行测试

```bash
npm test
```

### 项目结构

```
claw-calendar/
├── src/
│   ├── app.js              # Express 应用
│   ├── server.js           # 服务入口
│   ├── config/             # 配置
│   │   └── database.js     # 数据库连接
│   ├── middleware/         # 中间件
│   │   ├── auth.js         # 认证中间件
│   │   └── errorHandler.js # 错误处理
│   ├── routes/             # API 路由
│   │   ├── auth/           # 认证相关
│   │   ├── calendars.js    # 日历管理
│   │   └── events.js       # 事件管理
│   └── utils/              # 工具函数
├── public/                 # 静态文件（前端）
├── tests/                  # 测试用例
└── data/                   # JSON 数据存储
```

---

## License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 联系方式

- **官网**: https://claw-calendar.com
- **邮箱**: contact@claw-calendar.com
