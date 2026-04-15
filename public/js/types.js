/**
 * Claw Calendar - API 类型定义
 * 统一前后端数据类型，确保 API 响应格式一致
 */

// ============ 基础类型 ============

/** UUID 字符串 */
export type UUID = string;

/** ISO 8601 日期字符串 (YYYY-MM-DD) */
export type DateString = string;

/** ISO 8601 时间字符串 (HH:mm:ss) */
export type TimeString = string;

/** ISO 8601 日期时间字符串 */
export type DateTimeString = string;

// ============ API 通用响应 ============

/** API 通用响应包装 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============ 用户相关 ============

export interface User {
  id: UUID;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface UserProfile extends User {
  emailVerified: boolean;
  calendarCount: number;
  eventCount: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresAt: DateTimeString;
}

// ============ 日历相关 ============

export interface Calendar {
  id: UUID;
  userId: UUID;
  name: string;
  description: string | null;
  color: string;
  isPublic: boolean;
  apiKeyPrefix: string;
  subscribeToken: string | null;
  eventCount?: number;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface CreateCalendarRequest {
  name: string;
  description?: string;
  color?: string;
  isPublic?: boolean;
}

export interface UpdateCalendarRequest {
  name?: string;
  description?: string;
  color?: string;
  isPublic?: boolean;
}

export interface CalendarListResponse {
  success: boolean;
  calendars: Calendar[];
}

// ============ 日程相关 ============

export interface CalendarEvent {
  id: UUID;
  calendarId: UUID;
  title: string;
  description: string | null;
  location: string | null;
  startDate: DateString;
  endDate: DateString;
  startTime: TimeString | null;
  endTime: TimeString | null;
  isAllDay: boolean;
  alarmEnabled: boolean;
  alarmMinutes: number;
  recurrenceRule: string | null;
  externalId: string | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  location?: string;
  startDate: DateString;
  endDate: DateString;
  startTime?: TimeString;
  endTime?: TimeString;
  isAllDay?: boolean;
  alarmEnabled?: boolean;
  alarmMinutes?: number;
  recurrenceRule?: string;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  location?: string;
  startDate?: DateString;
  endDate?: DateString;
  startTime?: TimeString;
  endTime?: TimeString;
  isAllDay?: boolean;
  alarmEnabled?: boolean;
  alarmMinutes?: number;
  recurrenceRule?: string;
}

export interface EventListResponse {
  success: boolean;
  events: CalendarEvent[];
  total: number;
}

// ============ API Key 相关 ============

export interface ApiKey {
  id: UUID;
  name: string;
  prefix: string;
  isActive: boolean;
  expiresAt: DateTimeString | null;
  lastUsedAt: DateTimeString | null;
  usageCount: number;
  createdAt: DateTimeString;
}

export interface CreateApiKeyRequest {
  name: string;
  expiresInDays?: number; // 不传表示永不过期
}

export interface ApiKeyResponse {
  success: boolean;
  apiKey: ApiKey;
  fullKey: string; // 仅创建时返回一次
}

// ============ 订阅相关 ============

export interface Subscription {
  id: UUID;
  calendarId: UUID;
  subscriberEmail: string;
  notifyEnabled: boolean;
  notifyBeforeMinutes: number;
  createdAt: DateTimeString;
}

export interface SubscribeRequest {
  email: string;
  notifyEnabled?: boolean;
  notifyBeforeMinutes?: number;
}

// ============ 错误码定义 ============

export enum ErrorCode {
  // 认证错误 (40x)
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // 权限错误 (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // 资源错误 (404)
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  CALENDAR_NOT_FOUND = 'CALENDAR_NOT_FOUND',
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',

  // 验证错误 (422)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_DATE = 'INVALID_DATE',

  // 业务错误 (409)
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  CALENDAR_LIMIT_EXCEEDED = 'CALENDAR_LIMIT_EXCEEDED',
  EVENT_CONFLICT = 'EVENT_CONFLICT',

  // 服务器错误 (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}
