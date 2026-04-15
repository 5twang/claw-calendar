/**
 * Claw Calendar - Zod 验证 Schema
 * 用于请求验证和响应格式校验
 */

const { z } = require('zod');

// ============ 基础类型 ============

/** UUID 格式 */
const uuidSchema = z.string().uuid({ message: '无效的 UUID 格式' });

/** 日期格式 YYYY-MM-DD */
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: '日期格式必须是 YYYY-MM-DD'
});

/** 时间格式 HH:mm:ss 或 HH:mm */
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, {
  message: '时间格式必须是 HH:mm 或 HH:mm:ss'
});

/** 颜色格式 */
const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
  message: '颜色格式必须是 #RRGGBB'
});

// ============ 用户相关 Schema ============

const registerSchema = z.object({
  email: z.string().email({ message: '无效的邮箱格式' }),
  password: z.string()
    .min(8, { message: '密码至少8个字符' })
    .max(128, { message: '密码最多128个字符' }),
  name: z.string().min(1).max(100).optional()
});

const loginSchema = z.object({
  email: z.string().email({ message: '无效的邮箱格式' }),
  password: z.string().min(1, { message: '密码不能为空' })
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string()
    .min(8, { message: '新密码至少8个字符' })
    .max(128, { message: '新密码最多128个字符' })
    .optional()
});

// ============ 日历相关 Schema ============

const createCalendarSchema = z.object({
  name: z.string().min(1, { message: '日历名称不能为空' }).max(255),
  description: z.string().max(2000).optional(),
  color: colorSchema.optional(),
  isPublic: z.boolean().optional()
});

const updateCalendarSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  color: colorSchema.optional(),
  isPublic: z.boolean().optional()
});

// ============ 日程相关 Schema ============

const createEventSchema = z.object({
  title: z.string().min(1, { message: '日程标题不能为空' }).max(255),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  startDate: dateSchema,
  endDate: dateSchema,
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  isAllDay: z.boolean().optional(),
  alarmEnabled: z.boolean().optional(),
  alarmMinutes: z.number().int().min(0).max(10080).optional(), // 最多7天
  recurrenceRule: z.string().optional()
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: '结束日期不能早于开始日期', path: ['endDate'] }
);

const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  startTime: timeSchema.optional().nullable(),
  endTime: timeSchema.optional().nullable(),
  isAllDay: z.boolean().optional(),
  alarmEnabled: z.boolean().optional(),
  alarmMinutes: z.number().int().min(0).max(10080).optional(),
  recurrenceRule: z.string().optional().nullable()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: '结束日期不能早于开始日期', path: ['endDate'] }
);

// ============ API Key 相关 Schema ============

const createApiKeySchema = z.object({
  name: z.string().min(1, { message: '名称不能为空' }).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional() // 最多1年
});

// ============ 订阅相关 Schema ============

const subscribeSchema = z.object({
  email: z.string().email({ message: '无效的邮箱格式' }),
  notifyEnabled: z.boolean().optional(),
  notifyBeforeMinutes: z.number().int().min(0).max(10080).optional()
});

// ============ 通用查询 Schema ============

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const dateRangeSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: '结束日期不能早于开始日期', path: ['endDate'] }
);

// ============ 响应 Schema（用于测试验证） ============

const userResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({
    id: uuidSchema,
    email: z.string().email(),
    name: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
});

const calendarResponseSchema = z.object({
  success: z.literal(true),
  calendar: z.object({
    id: uuidSchema,
    userId: uuidSchema,
    name: z.string(),
    description: z.string().nullable(),
    color: z.string(),
    isPublic: z.boolean(),
    apiKeyPrefix: z.string(),
    subscribeToken: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
});

const eventResponseSchema = z.object({
  success: z.literal(true),
  event: z.object({
    id: uuidSchema,
    calendarId: uuidSchema,
    title: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    startDate: dateSchema,
    endDate: dateSchema,
    startTime: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
    isAllDay: z.boolean(),
    alarmEnabled: z.boolean(),
    alarmMinutes: z.number().int(),
    recurrenceRule: z.string().nullable().optional(),
    externalId: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
});

// ============ 错误响应 Schema ============

const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })
});

// ============ 便捷验证函数 ============

/**
 * 验证请求数据并返回格式化后的数据或错误
 */
function validateRequest(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    };
  }
  return { valid: true, data: result.data };
}

/**
 * 验证响应数据是否符合预期格式（用于开发测试）
 */
function validateResponse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn('[API Validation Warning]', {
      expected: schema.description || 'response',
      errors: result.error.errors
    });
    return false;
  }
  return true;
}

module.exports = {
  z,
  validateRequest,
  validateResponse,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createCalendarSchema,
  updateCalendarSchema,
  createEventSchema,
  updateEventSchema,
  createApiKeySchema,
  subscribeSchema,
  paginationSchema,
  dateRangeSchema,
  userResponseSchema,
  calendarResponseSchema,
  eventResponseSchema,
  apiErrorSchema
};
