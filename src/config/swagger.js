/**
 * Swagger/OpenAPI 配置
 * 
 * 安装依赖：
 *   npm install swagger-ui-express swagger-jsdoc
 * 
 * 访问地址：
 *   - 开发环境: http://localhost:3000/api-docs
 *   - 生产环境: 自动禁用
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Claw Calendar API',
      version: '1.0.0',
      description: '面向开发者的日历 API 服务 - 让应用轻松接入日历功能。支持 REST API 和 CalDAV 协议。',
      contact: {
        name: 'OpenClaw',
        url: 'https://github.com/5twang/claw-calendar'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '开发服务器'
      }
    ],
    tags: [
      { name: '认证', description: '用户注册、登录、邮箱验证' },
      { name: '日历', description: '日历 CRUD 操作' },
      { name: '事件', description: '日历事件管理' },
      { name: 'API Keys', description: '开发者 API Key 管理' },
      { name: '订阅', description: 'iCal 订阅和 CalDAV 访问' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Token（登录后获取）'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key（用于开发者接口）'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: '错误信息' }
          }
        },
        Calendar: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: '我的日历' },
            description: { type: 'string', example: '工作安排' },
            color: { type: 'string', example: '#4f46e5' },
            timezone: { type: 'string', example: 'Asia/Shanghai' },
            isDefault: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            calendarId: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: '团队会议' },
            description: { type: 'string', example: '讨论项目进度' },
            startDate: { type: 'string', format: 'date', example: '2026-04-20' },
            endDate: { type: 'string', format: 'date', example: '2026-04-20' },
            allDay: { type: 'boolean' },
            location: { type: 'string', example: '会议室A' },
            color: { type: 'string', example: '#10b981' },
            alarmEnabled: { type: 'boolean' },
            alarmMinutes: { type: 'integer', example: 30 },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: '我的应用' },
            prefix: { type: 'string', example: 'cck_live_' },
            isActive: { type: 'boolean' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
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
            200: { description: '登录成功，返回 JWT Token' },
            401: { description: '认证失败' }
          }
        }
      },
      '/api/calendars': {
        get: {
          tags: ['日历'],
          summary: '获取用户所有日历',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: '日历列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Calendar' }
                  }
                }
              }
            }
          }
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
                    color: { type: 'string', example: '#4f46e5' }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: '日历创建成功' },
            400: { description: '参数错误' }
          }
        }
      },
      '/api/calendars/{calendarId}': {
        get: {
          tags: ['日历'],
          summary: '获取日历详情',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: '日历详情', content: { 'application/json': { schema: { $ref: '#/components/schemas/Calendar' } } } },
            404: { description: '日历不存在' }
          }
        },
        put: {
          tags: ['日历'],
          summary: '更新日历',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: '更新成功' },
            404: { description: '日历不存在' }
          }
        },
        delete: {
          tags: ['日历'],
          summary: '删除日历',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            204: { description: '删除成功' },
            404: { description: '日历不存在' }
          }
        }
      },
      '/api/calendars/{calendarId}/events': {
        get: {
          tags: ['事件'],
          summary: '获取日历下的所有事件',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: '事件列表',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } }
            }
          }
        },
        post: {
          tags: ['事件'],
          summary: '创建事件',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'calendarId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'startDate'],
                  properties: {
                    title: { type: 'string' },
                    startDate: { type: 'string', format: 'date' },
                    endDate: { type: 'string', format: 'date' },
                    allDay: { type: 'boolean' },
                    description: { type: 'string' },
                    location: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: '事件创建成功' },
            400: { description: '参数错误' }
          }
        }
      },
      '/api/keys': {
        get: {
          tags: ['API Keys'],
          summary: '获取用户的 API Keys',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'API Key 列表',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } } } }
            }
          }
        },
        post: {
          tags: ['API Keys'],
          summary: '创建新的 API Key',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: '我的应用' },
                    expiresInDays: { type: 'integer', example: 365 }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: 'API Key 创建成功（包含完整密钥）' }
          }
        }
      },
      '/api/keys/{keyId}': {
        delete: {
          tags: ['API Keys'],
          summary: '撤销 API Key',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'keyId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            204: { description: '撤销成功' },
            404: { description: 'Key 不存在' }
          }
        }
      },
      '/calendars/{id}.ics': {
        get: {
          tags: ['订阅'],
          summary: 'iCal 订阅（无需认证）',
          description: '通过订阅令牌获取日历的 ICS 格式，可导入到任何日历应用',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '日历 ID' },
            { name: 'token', in: 'query', required: true, schema: { type: 'string' }, description: '订阅令牌' }
          ],
          responses: {
            200: {
              description: 'iCal 格式日历',
              content: { 'text/calendar': { schema: { type: 'string' } } }
            },
            401: { description: '缺少订阅令牌' },
            403: { description: '无效的订阅令牌' },
            404: { description: '日历不存在' }
          }
        }
      },
      '/dav/calendars': {
        get: {
          tags: ['订阅'],
          summary: 'CalDAV  principal URL',
          security: [{ apiKey: [] }],
          description: 'RFC 4791 CalDAV 协议支持',
          responses: {
            200: { description: '支持 CalDAV 的日历集合' }
          }
        }
      }
    }
  },
  apis: [] // 不从文件扫描，手动定义 paths
};

const specs = swaggerJsdoc(options);

module.exports = { specs };
