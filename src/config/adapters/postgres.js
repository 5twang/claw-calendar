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
      
      // 连接池配置优化
      const poolConfig = {
        connectionString: this.config.url,
        // 连接池大小配置
        max: parseInt(process.env.DB_POOL_MAX) || 20,  // 最大连接数（生产环境建议10-50）
        min: parseInt(process.env.DB_POOL_MIN) || 2,    // 最小连接数
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,  // 空闲超时
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT) || 5000,  // 连接超时
        // 连接命名（用于日志追踪）
        log: (msg) => console.log('[DB Pool]', msg),
      };

      // 生产环境 SSL 配置（支持通过环境变量禁用）
      if (process.env.NODE_ENV === 'production' && process.env.DB_SSL_DISABLED !== 'true') {
        poolConfig.ssl = {
          rejectUnauthorized: false,  // 关闭证书验证（本地/自签名证书环境）
          ca: process.env.DB_SSL_CA,      // CA 证书（可选）
          cert: process.env.DB_SSL_CERT,  // 客户端证书（可选）
          key: process.env.DB_SSL_KEY,   // 客户端私钥（可选）
        };
      }

      this.pool = new Pool(poolConfig);

      // 监听连接池错误
      this.pool.on('error', (err) => {
        console.error('[DB Pool] 意外错误:', err.message);
      });

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
