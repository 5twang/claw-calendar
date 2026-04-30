// 测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET='***';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
process.env.ENCRYPTION_SALT = 'test-salt-value-for-unit-tests';
process.env.DATABASE_TYPE = 'file';
process.env.DEV_CALDAV_USER = 'verifytest@test.com';
