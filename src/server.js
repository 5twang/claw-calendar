require('dotenv').config();
const app = require('./app');
const { checkAndReport } = require('./config/validation');

const PORT = process.env.PORT || 3000;

// 检查环境变量配置
if (!checkAndReport()) {
  console.error('环境配置验证失败，请修复后再试。\n');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🚀 Claw Calendar 服务已启动`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
});
