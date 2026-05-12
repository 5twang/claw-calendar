# Claw Calendar Admin Panel - 实现计划

## 目标
在 claw-calendar 项目中增加后台管理功能，第一期实现注册用户的管理查询。

## 架构
- 数据库：users 表加 is_admin 字段
- 后端 API：/api/admin/* 路由
- 前端：public/admin/ 静态页面
- 认证：复用 JWT 体系，添加 admin 角色检查中间件
- 部署：Docker Compose 原生支持

## 任务分解

### Task 1: 数据库 + 认证中间件（后端核心）
- 在 schema.sql 的 users 表增加 `is_admin BOOLEAN DEFAULT false`
- 创建迁移 SQL 文件 db/migrations/001_add_admin.sql
- 创建 admin-auth middleware（检查 is_admin 角色）
- 在 app.js 注册 admin 路由

### Task 2: Admin API 路由（用户管理查询）
- GET /api/admin/users — 列表（分页、搜索、筛选、排序）
- GET /api/admin/users/:id — 用户详情（含统计信息）
- PATCH /api/admin/users/:id — 更新用户状态

### Task 3: Admin 前端页面
- public/admin/login.html — 管理员登录（复用现有登录流程）
- public/admin/index.html — 用户管理仪表盘
- public/admin/css/admin.css — 样式
- public/admin/js/admin.js — 前端逻辑

## API 合约（两方确认一致）

### GET /api/admin/users
Query: page=1&limit=20&search=xxx&status=active|inactive&sort=created_at:desc
Response:
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户名",
      "is_active": true,
      "is_admin": false,
      "created_at": "2024-01-01T00:00:00Z",
      "calendar_count": 3,
      "event_count": 15
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET /api/admin/users/:id
Response:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "用户名",
  "is_active": true,
  "is_admin": false,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "calendar_count": 3,
  "event_count": 15,
  "last_login": null
}
```

### PATCH /api/admin/users/:id
Body: { "is_active": false } 或 { "is_admin": true }
Response: { "id": "uuid", "email": "...", "is_active": false, "is_admin": true }

### POST /api/admin/auth/login
Body: { "email": "admin@example.com", "password": "xxx" }
Response: { "token": "jwt...", "user": { ... } }

## 文件清单

### 修改的文件
- src/models/schema.sql — 加 is_admin 字段
- src/middleware/auth.js — 加 requireAdmin 中间件
- src/routes/index.js — 注册 admin 路由
- src/app.js — 可能不变（index.js 处理）

### 新增的文件
- db/migrations/001_add_admin.sql — 迁移脚本
- src/middleware/adminAuth.js — admin 专有中间件（或直接在 auth.js 追加）
- src/routes/admin/ — admin 路由目录
  - index.js — admin 路由聚合
  - auth.js — admin 登录（复用 user session）
  - users.js — 用户管理路由
- public/admin/ — 前端页面目录
  - index.html
  - css/admin.css
  - js/admin.js
