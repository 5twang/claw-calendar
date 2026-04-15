/**
 * 数据库适配器基类
 * 定义所有数据库适配器必须实现的接口
 */
class DatabaseAdapter {
  constructor() {
    if (new.target === DatabaseAdapter) {
      throw new Error('DatabaseAdapter 是抽象类，不能直接实例化');
    }
  }

  /**
   * 执行 SQL 查询
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数数组
   * @returns {Promise<{rows: Array, rowCount: number}>}
   */
  async query(sql, params = []) {
    throw new Error('子类必须实现 query 方法');
  }

  /**
   * 关闭数据库连接
   */
  async end() {
    throw new Error('子类必须实现 end 方法');
  }

  /**
   * 获取适配器类型名称
   */
  getType() {
    return 'unknown';
  }
}

module.exports = DatabaseAdapter;
