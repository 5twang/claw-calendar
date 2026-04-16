/**
 * FileAdapter 数据库适配器测试
 */

const path = require('path');
const fs = require('fs');

describe('FileAdapter 数据库适配器', () => {
  let FileAdapter;
  let adapter;

  beforeEach(() => {
    // 清除 require 缓存以获取新的适配器实例
    jest.resetModules();
    
    // 设置测试数据目录
    process.env.DATABASE_TYPE = 'file';
    
    // 重新加载适配器
    FileAdapter = require('../src/config/adapters/file');
    adapter = new FileAdapter();
  });

  describe('INSERT 操作', () => {
    test('应该插入用户记录', async () => {
      const result = await adapter.query(
        `INSERT INTO users (id, email, password_hash, name, is_active) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['test-user-1', 'test@example.com', 'hash123', 'Test User', true]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0].id).toBe('test-user-1');
      expect(result.rows[0].email).toBe('test@example.com');
    });

    test('应该自动设置 created_at 和 updated_at', async () => {
      const result = await adapter.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        ['test-user-2', 'test2@example.com', 'hash456']
      );

      expect(result.rows[0].created_at).toBeDefined();
      expect(result.rows[0].updated_at).toBeDefined();
    });

    test('应该设置默认值', async () => {
      const result = await adapter.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        ['test-user-3', 'test3@example.com', 'hash789']
      );

      expect(result.rows[0].is_active).toBe(false);  // 默认 false
    });

    test('应该插入日历记录', async () => {
      const result = await adapter.query(
        `INSERT INTO calendars (id, user_id, name) VALUES ($1, $2, $3)`,
        ['test-cal-1', 'test-user-1', '测试日历']
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].id).toBe('test-cal-1');
    });
  });

  describe('SELECT 操作', () => {
    beforeEach(async () => {
      // 插入测试数据
      await adapter.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        ['select-user-1', 'select@example.com', 'hash']
      );
    });

    test('应该查询所有记录', async () => {
      const result = await adapter.query(
        'SELECT * FROM users'
      );

      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('应该按 ID 查询', async () => {
      const result = await adapter.query(
        'SELECT * FROM users WHERE id = $1',
        ['select-user-1']
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].email).toBe('select@example.com');
    });

    test('应该按 email 查询', async () => {
      const result = await adapter.query(
        'SELECT * FROM users WHERE email = $1',
        ['select@example.com']
      );

      expect(result.rowCount).toBe(1);
    });
  });

  describe('UPDATE 操作', () => {
    beforeEach(async () => {
      await adapter.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        ['update-user-1', 'update@example.com', 'old_hash']
      );
    });

    test('应该更新记录', async () => {
      const result = await adapter.query(
        `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        ['新名称', 'update-user-1']
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('新名称');
    });

    test('应该更新布尔字段', async () => {
      const result = await adapter.query(
        `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING is_active`,
        [true, 'update-user-1']
      );

      expect(result.rows[0].is_active).toBe(true);
    });
  });

  describe('DELETE 操作', () => {
    beforeEach(async () => {
      await adapter.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        ['delete-user-1', 'delete@example.com', 'hash']
      );
    });

    test('应该删除记录', async () => {
      const result = await adapter.query(
        'DELETE FROM users WHERE id = $1',
        ['delete-user-1']
      );

      expect(result.rowCount).toBe(1);
    });

    test('应该按 ID 删除日历', async () => {
      await adapter.query(
        `INSERT INTO calendars (id, user_id, name) VALUES ($1, $2, $3)`,
        ['delete-cal-1', 'test-user-1', '删除日历']
      );

      const result = await adapter.query(
        'DELETE FROM calendars WHERE id = $1',
        ['delete-cal-1']
      );

      expect(result.rowCount).toBe(1);
    });
  });

  describe('ORDER BY 支持', () => {
    test('应该支持升序排序', async () => {
      await adapter.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        ['order-user-1', 'a@example.com', 'hash']
      );
      await adapter.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        ['order-user-2', 'b@example.com', 'hash']
      );

      const result = await adapter.query(
        'SELECT * FROM users ORDER BY email ASC'
      );

      expect(result.rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('表关联查询', () => {
    test('应该支持日历和事件关联查询', async () => {
      // 插入日历
      await adapter.query(
        `INSERT INTO calendars (id, user_id, name) VALUES ($1, $2, $3)`,
        ['join-cal-1', 'test-user-1', '关联日历']
      );

      // 插入事件
      await adapter.query(
        `INSERT INTO events (id, calendar_id, title, start_date) VALUES ($1, $2, $3, $4)`,
        ['join-event-1', 'join-cal-1', '测试事件', '2026-04-20']
      );

      // 查询日历及其事件
      const result = await adapter.query(
        'SELECT * FROM events WHERE calendar_id = $1',
        ['join-cal-1']
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].title).toBe('测试事件');
    });
  });
});
