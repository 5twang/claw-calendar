/**
 * JSON 文件数据库适配器
 * 适用于开发环境和小型部署
 * 
 * 配置方式：
 * - 默认使用，无需特殊配置
 * - 或设置 DATABASE_TYPE=file
 */
const path = require('path');
const fs = require('fs');
const DatabaseAdapter = require('./base');

class FileAdapter extends DatabaseAdapter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data');
    this.tables = {
      users: new Map(),
      calendars: new Map(),
      events: new Map(),
      api_keys: new Map(),
      api_logs: new Map(),
      user_sessions: new Map(),
      email_verifications: new Map()
    };
    this.sequences = {
      api_logs: 1
    };
    this.saveDebounceTimer = null;
    this.savePending = false;

    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.load();
  }

  getType() {
    return 'file';
  }

  // 从文件加载数据
  load() {
    for (const tableName of Object.keys(this.tables)) {
      const filePath = path.join(this.dataDir, `${tableName}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.tables[tableName] = new Map();
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item && item.id) {
                this.tables[tableName].set(item.id, item);
              }
            }
          }
          console.log(`[DB] 已加载 ${tableName}: ${this.tables[tableName].size} 条记录`);
        } catch (e) {
          console.error(`[DB] 加载 ${tableName} 失败:`, e.message);
          this.tables[tableName] = new Map();
        }
      }
    }

    // 加载序列
    const seqFile = path.join(this.dataDir, '_sequences.json');
    if (fs.existsSync(seqFile)) {
      try {
        this.sequences = JSON.parse(fs.readFileSync(seqFile, 'utf-8'));
      } catch (e) {
        this.sequences = { api_logs: 1 };
      }
    }
  }

  // 保存数据到文件（防抖）
  save(tableName) {
    this.savePending = true;

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      this._flush();
    }, 500);
  }

  // 立即保存所有数据
  _flush() {
    if (!this.savePending) return;
    this.savePending = false;

    for (const tableName of Object.keys(this.tables)) {
      const filePath = path.join(this.dataDir, `${tableName}.json`);
      const data = Array.from(this.tables[tableName].values());
      try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {
        console.error(`[DB] 保存 ${tableName} 失败:`, e.message);
      }
    }

    // 保存序列
    const seqFile = path.join(this.dataDir, '_sequences.json');
    try {
      fs.writeFileSync(seqFile, JSON.stringify(this.sequences, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DB] 保存序列失败:', e.message);
    }

    console.log('[DB] 数据已持久化到磁盘');
  }

  async query(sql, params = []) {
    const normalizedSql = sql.trim().toLowerCase();

    if (normalizedSql.startsWith('insert into')) {
      return this.handleInsert(sql, params);
    }

    if (normalizedSql.startsWith('select')) {
      return this.handleSelect(sql, params);
    }

    if (normalizedSql.startsWith('update')) {
      return this.handleUpdate(sql, params);
    }

    if (normalizedSql.startsWith('delete from')) {
      return this.handleDelete(sql, params);
    }

    if (normalizedSql.startsWith('create table')) {
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  handleInsert(sql, params) {
    const match = sql.match(/insert into (\w+)/i);
    const tableName = match ? match[1].toLowerCase() : '';

    // 提取列名（处理多行 SQL）
    const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim().replace(/"/g, '') || '').filter(c => c) : [];

    // 提取 VALUES 部分（处理括号嵌套如 NOW()）
    let valuesStr = '';
    const valuesKeywordIndex = sql.toUpperCase().indexOf('VALUES');
    if (valuesKeywordIndex !== -1) {
      const start = sql.indexOf('(', valuesKeywordIndex);
      if (start !== -1) {
        let depth = 0;
        for (let i = start; i < sql.length; i++) {
          const char = sql[i];
          if (char === '(') {
            depth++;
          } else if (char === ')') {
            depth--;
            if (depth === 0) {
              valuesStr = sql.substring(start + 1, i);
              break;
            }
          }
        }
      }
    }

    let values = [];
    if (valuesStr) {
      const valueTokens = [];
      let current = '';
      let inQuote = false;
      let quoteChar = '';

      for (let i = 0; i < valuesStr.length; i++) {
        const char = valuesStr[i];
        if ((char === "'" || char === '"') && !inQuote) {
          inQuote = true;
          quoteChar = char;
          current += char;
        } else if (char === quoteChar && inQuote) {
          inQuote = false;
          quoteChar = '';
          current += char;
        } else if (char === ',' && !inQuote) {
          valueTokens.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        valueTokens.push(current.trim());
      }

      valueTokens.forEach(token => {
        const trimmed = token.trim();
        const paramMatch = trimmed.match(/^\$(\d+)$/);
        if (paramMatch) {
          // 参数占位符，直接使用参数值
          const idx = parseInt(paramMatch[1]) - 1;
          values.push(params[idx]);
        } else if (trimmed.toUpperCase().startsWith('NOW()') || trimmed.startsWith('NOW')) {
          // 处理 NOW() 或 NOW() + INTERVAL 等情况
          const nowIntervalMatch = trimmed.match(/NOW\(\)\s*\+\s*INTERVAL\s+'(\d+)\s+(HOUR|DAY|HOURS|DAYS)'/i);
          if (nowIntervalMatch) {
            const num = parseInt(nowIntervalMatch[1]);
            const unit = nowIntervalMatch[2].toLowerCase();
            const ms = unit.startsWith('hour') ? num * 60 * 60 * 1000 : num * 24 * 60 * 60 * 1000;
            values.push(new Date(Date.now() + ms).toISOString());
          } else {
            values.push(new Date().toISOString());
          }
        } else {
          // 处理 SQL 字面量：布尔值、数字、NULL
          const unquoted = trimmed.replace(/^['"]|['"]$/g, '');
          if (unquoted.toLowerCase() === 'null') {
            values.push(null);
          } else if (unquoted.toLowerCase() === 'true') {
            values.push(true);
          } else if (unquoted.toLowerCase() === 'false') {
            values.push(false);
          } else if (!isNaN(unquoted) && unquoted !== '') {
            // 数字
            values.push(Number(unquoted));
          } else {
            values.push(unquoted);
          }
        }
      });
    }

    const idIndex = columns.indexOf('id');
    const id = idIndex >= 0 && values[idIndex] ? values[idIndex] : require('uuid').v4();

    const row = { id };
    columns.forEach((col, idx) => {
      if (col !== 'id' && idx < values.length) {
        row[col] = values[idx];
      }
    });

    const now = new Date().toISOString();
    if (!row.created_at) row.created_at = now;
    if (!row.updated_at) row.updated_at = now;

    // 默认值
    if (tableName === 'users' && (row.is_active === undefined || row.is_active === null)) {
      row.is_active = false;
    }
    if (tableName === 'users' && (row.is_admin === undefined || row.is_admin === null)) {
      row.is_admin = false;
    }
    if (tableName === 'calendars' && (row.is_public === undefined || row.is_public === null)) {
      row.is_public = false;
    }
    if (tableName === 'api_keys' && (row.is_active === undefined || row.is_active === null)) {
      row.is_active = true;
    }
    if (tableName === 'email_verifications' && (row.used === undefined || row.used === null)) {
      row.used = false;
    }
    if (tableName === 'events' && (row.is_all_day === undefined || row.is_all_day === null)) {
      row.is_all_day = true;
    }
    if (tableName === 'events' && (row.alarm_enabled === undefined || row.alarm_enabled === null)) {
      row.alarm_enabled = true;
    }
    if (tableName === 'events' && (row.alarm_minutes === undefined || row.alarm_minutes === null)) {
      row.alarm_minutes = 15;
    }

    this.tables[tableName].set(id, row);
    this.save(tableName);

    return { rows: [row], rowCount: 1, lastID: id };
  }

  handleSelect(sql, params) {
    const match = sql.match(/from (\w+)/i);
    const tableName = match ? match[1].toLowerCase() : '';

    let rows = [];
    if (this.tables[tableName] && this.tables[tableName] instanceof Map) {
      rows = Array.from(this.tables[tableName].values());
    }

    if (sql.toLowerCase().includes('where')) {
      // 修复：$ 在正则中是特殊字符（行尾），需要转义处理
      // 匹配 WHERE 后的条件直到 ORDER BY/GROUP BY/LIMIT 或语句末尾
      const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|\s*$)/i);
      if (whereMatch) {
        const conditions = whereMatch[1].trim();
        const conditionParts = conditions.split(/\s+AND\s+/i);

        for (const condition of conditionParts) {
          const emailMatch = condition.match(/email\s*=\s*\$(\d+)/i);
          if (emailMatch) {
            const paramIndex = parseInt(emailMatch[1]) - 1;
            rows = rows.filter(r => r.email === params[paramIndex]);
            continue;
          }

          // 注意：id 匹配要放在 user_id 等更具体字段之后，且使用单词边界
          const idMatch = condition.match(/\bid\s*=\s*\$(\d+)/i);
          if (idMatch) {
            const paramIndex = parseInt(idMatch[1]) - 1;
            rows = rows.filter(r => r.id === params[paramIndex]);
            continue;
          }

          const userIdMatch = condition.match(/\buser_id\s*=\s*\$(\d+)/i);
          if (userIdMatch) {
            const paramIndex = parseInt(userIdMatch[1]) - 1;
            rows = rows.filter(r => r.user_id === params[paramIndex]);
            continue;
          }

          const calendarIdMatch = condition.match(/\bcalendar_id\s*=\s*\$(\d+)/i);
          if (calendarIdMatch) {
            const paramIndex = parseInt(calendarIdMatch[1]) - 1;
            rows = rows.filter(r => r.calendar_id === params[paramIndex]);
            continue;
          }

          // 日期范围比较：start_date >= $N 或 end_date <= $N
          const dateGteMatch = condition.match(/(\w+_date)\s*>=\s*\$(\d+)/i);
          if (dateGteMatch) {
            const column = dateGteMatch[1];
            const paramIndex = parseInt(dateGteMatch[2]) - 1;
            const dateValue = params[paramIndex];
            if (dateValue) {
              rows = rows.filter(r => r[column] && r[column] >= dateValue);
            }
            continue;
          }

          const dateLteMatch = condition.match(/(\w+_date)\s*<=\s*\$(\d+)/i);
          if (dateLteMatch) {
            const column = dateLteMatch[1];
            const paramIndex = parseInt(dateLteMatch[2]) - 1;
            const dateValue = params[paramIndex];
            if (dateValue) {
              rows = rows.filter(r => r[column] && r[column] <= dateValue);
            }
            continue;
          }

          const keyHashMatch = condition.match(/key_hash\s*=\s*\$(\d+)/i);
          if (keyHashMatch) {
            const paramIndex = parseInt(keyHashMatch[1]) - 1;
            rows = rows.filter(r => r.key_hash === params[paramIndex]);
            continue;
          }

          const isActiveMatch = condition.match(/is_active\s*=\s*\$(\d+)/i);
          if (isActiveMatch) {
            const paramIndex = parseInt(isActiveMatch[1]) - 1;
            rows = rows.filter(r => r.is_active === params[paramIndex]);
            continue;
          }

          const tokenMatch = condition.match(/token\s*=\s*\$(\d+)/i);
          if (tokenMatch) {
            const paramIndex = parseInt(tokenMatch[1]) - 1;
            rows = rows.filter(r => r.token === params[paramIndex]);
            continue;
          }

          const usedMatch = condition.match(/used\s*=\s*\$(\d+)/i);
          if (usedMatch) {
            const paramIndex = parseInt(usedMatch[1]) - 1;
            rows = rows.filter(r => r.used === params[paramIndex]);
            continue;
          }

          const typeMatch = condition.match(/type\s*=\s*\$(\d+)/i);
          if (typeMatch) {
            const paramIndex = parseInt(typeMatch[1]) - 1;
            rows = rows.filter(r => r.type === params[paramIndex]);
            continue;
          }

          const jtiMatch = condition.match(/token_jti\s*=\s*\$(\d+)/i);
          if (jtiMatch) {
            const paramIndex = parseInt(jtiMatch[1]) - 1;
            rows = rows.filter(r => r.token_jti === params[paramIndex]);
            continue;
          }

          const codeMatch = condition.match(/code\s*=\s*\$(\d+)/i);
          if (codeMatch) {
            const paramIndex = parseInt(codeMatch[1]) - 1;
            rows = rows.filter(r => r.code === params[paramIndex]);
            continue;
          }

          const expiresAtMatch = condition.match(/expires_at\s*>\s*NOW\(\)/i);
          if (expiresAtMatch) {
            const now = new Date();
            rows = rows.filter(r => !r.expires_at || new Date(r.expires_at) > now);
            continue;
          }
        }
      }
    }

    // 处理 GROUP BY 聚合查询（基础支持）
    if (sql.toLowerCase().includes('group by')) {
      const groupMatch = sql.match(/group\s+by\s+([\w.]+)/i);
      // 匹配 COUNT(e.id) as alias 或 COUNT(id) as alias
      const countMatch = sql.match(/count\s*\(\s*[\w.]+\s*\)\s+as\s+(\w+)/i);

      if (groupMatch && countMatch) {
        const groupColumn = groupMatch[1]; // 如 'c.id'
        const countAlias = countMatch[1];  // 如 'event_count'

        // 提取主表别名（如 'c'）和列名（如 'id'）
        const groupParts = groupColumn.split('.');
        const groupColName = groupParts[groupParts.length - 1]; // 最后一列是列名

        // 按主表列分组并计算关联表的数量
        const grouped = {};
        // 匹配各种 JOIN 变体：JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN
        const joinMatch = sql.match(/(?:left|right|inner)?\s*join\s+(\w+)\s+(\w+)\s+on\s+/i);

        if (joinMatch) {
          const relatedTable = joinMatch[1]; // 如 'events'
          const relatedAlias = joinMatch[2]; // 如 'e'

          // 获取关联表数据
          const relatedRows = this.tables[relatedTable] ?
            Array.from(this.tables[relatedTable].values()) : [];

          // 获取主表数据（rows已经在WHERE过滤后）
          const mainRows = rows;

          // 按主表ID分组，统计关联行数
          mainRows.forEach(mainRow => {
            const key = mainRow[groupColName];
            // 初始化分组结果
            if (!grouped[key]) {
              grouped[key] = {
                ...mainRow,
                [countAlias]: 0
              };
            }
            // 统计关联行数 - 检查 events 表中的 calendar_id
            const relatedCount = relatedRows.filter(relRow => {
              return relRow.calendar_id === key;
            }).length;
            grouped[key][countAlias] += relatedCount;
          });

          rows = Object.values(grouped);
        }
      }
    }

    if (sql.includes('order by')) {
      const orderMatch = sql.match(/order by (\w+)(?:\s*(asc|desc))?/i);
      if (orderMatch) {
        const column = orderMatch[1];
        const direction = (orderMatch[2] || 'asc').toLowerCase();
        rows.sort((a, b) => {
          if (direction === 'desc') {
            return b[column] > a[column] ? 1 : -1;
          }
          return a[column] > b[column] ? 1 : -1;
        });
      }
    }

    return { rows, rowCount: rows.length };
  }

  handleUpdate(sql, params) {
    const match = sql.match(/update (\w+)/i);
    const tableName = match ? match[1].toLowerCase() : '';

    const setMatch = sql.match(/set ([\s\S]+?) where/i);
    const whereMatch = sql.match(/where ([\s\S]+)/i);

    if (!setMatch || !whereMatch) {
      return { rows: [], rowCount: 0 };
    }

    const setClause = setMatch[1];
    const whereClause = whereMatch[1];

    const setAssignments = [];
    // 匹配 column = $N 或 column = NOW() 或 column = 字面量(false/true/NULL/数字)
    const setRegex = /(\w+)\s*=\s*(\$\d+|NOW\(\)|now\(\)|(?:'[^']*'|"[^"]*"|\w+))/gi;
    let setMatch2;
    while ((setMatch2 = setRegex.exec(setClause)) !== null) {
      setAssignments.push({ column: setMatch2[1], valueRef: setMatch2[2] });
    }

    let idParamIndex = -1;
    const idMatch = whereClause.match(/id\s*=\s*\$(\d+)/i);
    if (idMatch) {
      idParamIndex = parseInt(idMatch[1]) - 1;
    }

    let targetRows = [];
    if (idParamIndex >= 0) {
      const targetId = params[idParamIndex];
      const row = this.tables[tableName].get(targetId);
      if (row) targetRows.push(row);
    } else {
      targetRows = Array.from(this.tables[tableName].values());
    }

    targetRows.forEach(row => {
      setAssignments.forEach(assignment => {
        if (assignment.valueRef.startsWith('$')) {
          const paramIdx = parseInt(assignment.valueRef.substring(1)) - 1;
          row[assignment.column] = params[paramIdx];
        } else if (assignment.valueRef.toLowerCase() === 'now()') {
          row[assignment.column] = new Date().toISOString();
        } else {
          // 处理 SQL 字面量：布尔值、数字、NULL、字符串
          const val = assignment.valueRef.trim();
          const unquoted = val.replace(/^['"]|['"]$/g, '');
          if (unquoted.toLowerCase() === 'null') {
            row[assignment.column] = null;
          } else if (unquoted.toLowerCase() === 'true') {
            row[assignment.column] = true;
          } else if (unquoted.toLowerCase() === 'false') {
            row[assignment.column] = false;
          } else if (!isNaN(unquoted) && unquoted !== '') {
            row[assignment.column] = Number(unquoted);
          } else {
            row[assignment.column] = unquoted;
          }
        }
      });
      row.updated_at = new Date().toISOString();
    });

    if (targetRows.length > 0) {
      this.save(tableName);
    }

    const returningMatch = sql.match(/returning (.+)/i);
    if (returningMatch) {
      const returningClause = returningMatch[1].toLowerCase();
      const columns = returningClause.split(',').map(c => c.trim());
      if (columns.includes('*')) {
        return { rows: targetRows, rowCount: targetRows.length };
      } else {
        const projectedRows = targetRows.map(row => {
          const projected = {};
          columns.forEach(col => { projected[col] = row[col]; });
          return projected;
        });
        return { rows: projectedRows, rowCount: projectedRows.length };
      }
    }

    return { rows: targetRows, rowCount: targetRows.length };
  }

  handleDelete(sql, params) {
    const match = sql.match(/delete from (\w+)/i);
    const tableName = match ? match[1].toLowerCase() : '';

    const whereMatch = sql.match(/where (.+)/i);
    if (whereMatch) {
      const conditions = whereMatch[1].trim();

      const idMatch = conditions.match(/id\s*=\s*\$(\d+)/i);
      if (idMatch) {
        const paramIndex = parseInt(idMatch[1]) - 1;
        const id = params[paramIndex];
        const existed = this.tables[tableName].has(id);
        this.tables[tableName].delete(id);
        if (existed) this.save(tableName);
        return { rows: existed ? [{ id }] : [], rowCount: existed ? 1 : 0 };
      }

      const tokenMatch = conditions.match(/token_jti\s*=\s*\$(\d+)/i);
      if (tokenMatch) {
        const paramIndex = parseInt(tokenMatch[1]) - 1;
        const tokenJti = params[paramIndex];
        let count = 0;
        for (const [key, value] of this.tables[tableName]) {
          if (value.token_jti === tokenJti) {
            this.tables[tableName].delete(key);
            count++;
          }
        }
        if (count > 0) this.save(tableName);
        return { rows: [], rowCount: count };
      }

      const userIdMatch = conditions.match(/user_id\s*=\s*\$(\d+)/i);
      if (userIdMatch) {
        const paramIndex = parseInt(userIdMatch[1]) - 1;
        const userId = params[paramIndex];
        let count = 0;
        for (const [key, value] of this.tables[tableName]) {
          if (value.user_id === userId) {
            this.tables[tableName].delete(key);
            count++;
          }
        }
        if (count > 0) this.save(tableName);
        return { rows: [], rowCount: count };
      }
    }

    return { rows: [], rowCount: 0 };
  }

  async end() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this._flush();
  }
}

module.exports = FileAdapter;
