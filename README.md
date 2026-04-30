# Claw Calendar

> Calendar Skills 智能日历助手 - 多种方式写入，手机原生日历查看

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Claw%20Calendar-blue.svg)](https://github.com/5twang/claw-calendar)

## 简介

Claw Calendar 是一款 **Calendar Skills 智能日历助手**，支持：

- **普通用户**：订阅 Calendar Skill，让 App 自动把重要日期写进手机日历
- **开发者**：通过 API 为应用添加日历功能

用户通过手机原生日历（iOS Calendar、Android Calendar、macOS Calendar、HarmonyOS）订阅即可自动同步，**无需安装额外 App**。

---

## 核心特性

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
| 🔐 **数据安全** | JWT 认证、API Key、请求限流 |
| 🚀 **高可用** | 支持 Docker 部署，易于水平扩展 |
| 🐳 **容器化部署** | Docker Compose 一键部署 |
| ⌨️ **键盘快捷键** | C 新建日程、Esc 取消、? 帮助、t 今天、d/w/m 切换视图 |

---

## 快速开始

### 1. 安装

```bash
git clone https://github.com/5twang/claw-calendar.git
cd claw-calendar
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

主要配置项：

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
```

启动后访问以下地址：

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | 前端界面 |
| http://localhost:3000/api-docs | **API 文档** (Swagger/OpenAPI) |

### 4. 运行测试

```bash
npm test          # 运行所有测试
npm test -- --coverage  # 带覆盖率报告
```

---

## API 文档

- **Base URL**: `http://localhost:3000`（本地）或通过 `BASE_URL` 环境变量配置

- **认证方式**: Bearer Token (JWT) 或 API Key

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

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

#### 获取当前用户
```http
GET /api/auth/me
Authorization: Bearer <token>
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

#### 获取日历列表
```http
GET /api/calendars
Authorization: Bearer <token>
```

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
  "title": "团队会议",
  "description": "项目进度讨论",
  "location": "会议室A",
  "startDate": "2026-04-15",
  "endDate": "2026-04-15",
  "startTime": "14:00:00",
  "endTime": "15:00:00",
  "alarm": true,
  "alarmMinutes": 15
}
```

#### 获取事件列表
```http
GET /api/calendars/:calendarId/events
Authorization: Bearer <token>

# 支持日期范围筛选
GET /api/calendars/:calendarId/events?start=2026-04-01&end=2026-04-30
```

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
- **iOS**: 设置 → 日历 → 账户 → 添加订阅日历
- **Android**: 日历 → 更多 → 设置 → 添加日历 → 订阅日历
- **macOS**: 文件 → 新建日历订阅
- **HarmonyOS**: 日历 → 更多 → 通过链接添加

---

### 健康检查
```http
GET /health
```

---

## 部署

### Docker Compose 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/5twang/claw-calendar.git
cd claw-calendar

# 配置环境变量
cp .env.example .env
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
| `DB_SSL_DISABLED` | 禁用 PostgreSQL SSL | 否 | false |
| `ENCRYPTION_KEY` | 加密密钥（64字符十六进制） | 生产必填 | - |
| `ENCRYPTION_LEVEL` | 加密级别 | 否 | full |
| `ENCRYPTION_SALT` | 加密盐值 | 生产必填 | - |
| `JWT_SECRET` | JWT 签名密钥 | 生产必填 | - |
| `SMTP_HOST` | SMTP 服务器 | 否 | - |
| `SMTP_PORT` | SMTP 端口 | 否 | 587 |
| `SMTP_USER` | SMTP 用户名 | 否 | - |
| `SMTP_PASS` | SMTP 密码/授权码 | 否 | - |
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
- **测试**: Jest (194 个测试用例，覆盖率 55%+)
- **文档**: Swagger/OpenAPI (仅开发环境)
- **标准**: iCalendar (RFC 5545) + CalDAV (RFC 4791)

---

## 项目结构

```
claw-calendar/
├── src/
│   ├── app.js              # Express 应用
│   ├── server.js           # 服务入口
│   ├── config/             # 配置
│   │   ├── database.js     # 数据库连接
│   │   └── adapters/       # 数据适配器（JSON/PostgreSQL）
│   ├── middleware/          # 中间件
│   │   ├── auth.js         # 认证中间件
│   │   ├── errorHandler.js # 错误处理
│   │   └── validation.js   # 参数验证
│   ├── routes/             # API 路由
│   │   ├── auth.js         # 认证相关
│   │   ├── calendars.js    # 日历管理
│   │   ├── events.js       # 事件管理
│   │   ├── apiKeys.js      # API Key 管理
│   │   └── caldav.js       # CalDAV 协议
│   └── utils/              # 工具函数
│       ├── constants.js    # 全局常量配置
│       ├── crypto.js       # 加密工具
│       ├── email.js       # 邮件工具
│       ├── errors.js      # 错误定义
│       └── ical.js        # iCal 解析工具
├── public/                 # 静态文件（前端页面）
├── tests/                  # 测试用例 (194 个)
├── data/                   # JSON 数据存储
└── docker-compose.yml      # Docker 部署配置
```

---

## License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 相关项目

- [Calendar Skill for WorkBuddy](https://github.com/claw-calendar/workbuddy-skill) - WorkBuddy 日历技能插件

---

## 联系方式

- **官网**: https://claw-calendar.com
- **GitHub**: https://github.com/5twang/claw-calendar
