/**
 * API 请求日志中间件
 * 记录请求方法、路径、响应状态和耗时
 */

/**
 * 格式化请求日志
 */
function formatRequestLog(req, res, duration) {
  const timestamp = new Date().toISOString();
  const method = req.method.padEnd(6);
  const path = req.originalUrl.padEnd(50);
  const status = res.statusCode;
  const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
  const reset = '\x1b[0m';
  const durationStr = `${duration}ms`;

  return `${timestamp} ${method} ${path} ${statusColor}${status}${reset} ${durationStr}`;
}

/**
 * 跳过日志的路径
 */
const SKIP_PATHS = ['/health', '/favicon.ico'];

/**
 * 日志中间件
 */
function logger(req, res, next) {
  // 跳过某些路径
  if (SKIP_PATHS.includes(req.path)) {
    return next();
  }

  const start = Date.now();

  // 响应完成后记录
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // 生产环境只记录慢请求或错误
    const isProduction = process.env.NODE_ENV === 'production';
    const isSlow = duration > 1000;
    const isError = res.statusCode >= 400;
    
    if (!isProduction || isSlow || isError) {
      console.log(formatRequestLog(req, res, duration));
    }
  });

  next();
}

module.exports = { logger };
