/**
 * 数据库适配器工厂
 * 根据配置自动选择合适的数据库适配器
 * 
 * 使用方式：
 * - 开发环境（默认）：使用 FileAdapter (JSON 文件)
 * - 生产环境：设置 DATABASE_TYPE=postgres 使用 PostgresAdapter
 * 
 * 切换数据库只需修改环境变量，无需修改代码
 */

require('dotenv').config();

// 获取数据库配置
const dbType = process.env.DATABASE_TYPE || 'file';
const dbUrl = process.env.DATABASE_URL;

let Adapter;
let adapterType = 'file';

switch (dbType.toLowerCase()) {
  case 'postgres':
  case 'postgresql':
  case 'pg':
    if (!dbUrl) {
      console.warn('[DB] 警告：DATABASE_TYPE=postgres 但未设置 DATABASE_URL，使用 FileAdapter');
      Adapter = new (require('./adapters/file'))();
    } else {
      const PostgresAdapter = require('./adapters/postgres');
      Adapter = new PostgresAdapter({ url: dbUrl });
      adapterType = 'postgres';
    }
    break;
  
  case 'file':
  default:
    Adapter = new (require('./adapters/file'))();
    adapterType = 'file';
    break;
}

// 显示当前使用的数据库类型
console.log(`[DB] 使用数据库适配器: ${adapterType === 'postgres' ? 'PostgreSQL' : 'JSON 文件'}`);

// 导出适配器实例
module.exports = Adapter;
