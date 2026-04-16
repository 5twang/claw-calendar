/**
 * PostgreSQL 数据库适配器
 * 适用于生产环境
 * 
 * 配置方式：
 * - 设置 DATABASE_TYPE=postgres
 * - 设置 DATABASE_URL=postgresql://user:pass@host:5432/dbname
 * 
 * 需要安装 pg 包：npm install pg
 */
const DatabaseAdapter = require('./base');

class PostgresAdapter extends DatabaseAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.client = null;
    this.connected = false;
  }

  getType() {
    return 'postgres';
  }

  async connect() {
    // 延迟加载 pg 模块
    try {
      const { Pool } = require('pg');
      
      const poolConfig = {
        connectionString: this.config.url,
        max: 50,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };

      this.pool = new Pool(poolConfig);
      
      // 测试连接
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
      
      console.log('[DB] PostgreSQL 连接成功');
    } catch (error) {
      console.error('[DB] PostgreSQL 连接失败:', error.message);
      throw error;
    }
  }

  async query(sql, params = []) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.pool.query(sql, params);
      return {
        rows: result.rows || [],
        rowCount: result.rowCount || 0,
        lastID: result.rows?.[0]?.id
      };
    } catch (error) {
      console.error('[DB] PostgreSQL 查询错误:', error.message);
      throw error;
    }
  }

  async end() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('[DB] PostgreSQL 连接已关闭');
    }
  }
}

module.exports = PostgresAdapter;
