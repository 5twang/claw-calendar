/**
 * Swagger/OpenAPI 规范定义
 */
module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'Claw Calendar API',
    version: '1.0.0',
    description: '面向开发者的日历 API 服务 - 让应用轻松接入日历功能',
    contact: { name: 'OpenClaw', url: 'https://github.com/5twang/claw-calendar' }
  },
  servers: [{ url: 'http://localhost:3000' }],
  tags: [
    { name: '认证', description: '用户注册、登录、邮箱验证' },
    { name: '日历', description: '日历 CRUD 操作' },
    { name: '事件', description: '日历事件管理' },
    { name: 'API Keys', description: '开发者 API Key 管理' },
    { name: '订阅', description: 'iCal 订阅和 CalDAV 访问' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' }
    }
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['认证'],
        summary: '用户注册',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: '注册成功' },
          400: { description: '参数错误' },
          409: { description: '邮箱已被注册' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['认证'],
        summary: '用户登录',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: '登录成功' },
          401: { description: '认证失败' }
        }
      }
    },
    '/api/auth/verify-email': {
      post: {
        tags: ['认证'],
        summary: '验证邮箱',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          200: { description: '验证成功' },
          400: { description: '无效 Token' }
        }
      }
    },
    '/api/user': {
      get: {
        tags: ['认证'],
        summary: '获取当前用户信息',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: '用户信息' } }
      }
    },
    '/api/calendars': {
      get: {
        tags: ['日历'],
        summary: '获取所有日历',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: '日历列表' } }
      },
      post: {
        tags: ['日历'],
        summary: '创建日历',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  color: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 201: { description: '创建成功' } }
      }
    },
    '/api/calendars/{calendarId}': {
      get: {
        tags: ['日历'],
        summary: '获取日历详情',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '日历详情' }, 404: { description: '不存在' } }
      },
      put: {
        tags: ['日历'],
        summary: '更新日历',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '更新成功' } }
      },
      delete: {
        tags: ['日历'],
        summary: '删除日历',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: '删除成功' } }
      }
    },
    '/api/calendars/{calendarId}/events': {
      get: {
        tags: ['事件'],
        summary: '获取事件列表',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '事件列表' } }
      },
      post: {
        tags: ['事件'],
        summary: '创建事件',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'startDate'],
                properties: {
                  title: { type: 'string' },
                  startDate: { type: 'string' },
                  endDate: { type: 'string' },
                  allDay: { type: 'boolean' },
                  description: { type: 'string' },
                  location: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 201: { description: '创建成功' } }
      }
    },
    '/api/events/{eventId}': {
      get: {
        tags: ['事件'],
        summary: '获取事件详情',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '事件详情' } }
      },
      put: {
        tags: ['事件'],
        summary: '更新事件',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '更新成功' } }
      },
      delete: {
        tags: ['事件'],
        summary: '删除事件',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: '删除成功' } }
      }
    },
    '/api/keys': {
      get: {
        tags: ['API Keys'],
        summary: '获取 API Keys',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Key 列表' } }
      },
      post: {
        tags: ['API Keys'],
        summary: '创建 API Key',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  expiresInDays: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: { 201: { description: '创建成功' } }
      }
    },
    '/api/keys/{keyId}': {
      delete: {
        tags: ['API Keys'],
        summary: '撤销 API Key',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'keyId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: '撤销成功' } }
      }
    },
    '/calendars/{id}.ics': {
      get: {
        tags: ['订阅'],
        summary: 'iCal 订阅（无需认证）',
        description: '通过订阅令牌获取日历的 ICS 格式',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '日历 ID' },
          { name: 'token', in: 'query', required: true, schema: { type: 'string' }, description: '订阅令牌' }
        ],
        responses: {
          200: { description: 'iCal 日历文件' },
          401: { description: '缺少令牌' },
          403: { description: '无效令牌' }
        }
      }
    },
    '/health': {
      get: {
        tags: ['订阅'],
        summary: '健康检查',
        responses: { 200: { description: '服务正常' } }
      }
    }
  }
};
