const mysql = require('mysql2/promise');

/**
 * Database setup script cho video call integration
 * Sử dụng database hiện có: hommy_database
 */
class DatabaseSetup {
  constructor() {
    this.dbConfig = {
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'hommy_database',
      multipleStatements: true
    };
  }

  async setupDatabase() {
    try {
      console.log('🗄️  Setting up video call integration database...');
      
      const connection = await mysql.createConnection(this.dbConfig);

      // Đọc và thực thi migration script
      const fs = require('fs');
      const path = require('path');
      const migrationScript = fs.readFileSync(
        path.join(__dirname, 'migration.sql'), 
        'utf8'
      );

      await connection.query(migrationScript);
      
      console.log('✅ Database setup completed successfully!');
      console.log('📋 Tables created:');
      console.log('   - user_online_status');
      console.log('   - video_call_sessions');
      console.log('   - call_notifications');
      console.log('   - call_analytics');
      
      await connection.end();

    } catch (error) {
      console.error('❌ Error setting up database:', error);
      throw error;
    }
  }

  async verifySetup() {
    try {
      console.log('🔍 Verifying database setup...');
      
      const connection = await mysql.createConnection(this.dbConfig);

      // Kiểm tra bảng hiện có
      const [existingTables] = await connection.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'hommy_database'
        AND TABLE_NAME IN ('taikhoan', 'cuochen')
      `);

      // Kiểm tra bảng mới tạo
      const [newTables] = await connection.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'hommy_database'
        AND TABLE_NAME IN ('user_online_status', 'video_call_sessions', 'call_notifications', 'call_analytics')
      `);

      console.log('📊 Existing tables found:', existingTables.map(t => t.TABLE_NAME));
      console.log('🆕 New tables created:', newTables.map(t => t.TABLE_NAME));

      // Kiểm tra foreign key constraints
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = 'hommy_database'
        AND REFERENCED_TABLE_NAME IN ('taikhoan')
        AND TABLE_NAME IN ('user_online_status', 'video_call_sessions', 'call_notifications')
      `);

      console.log('🔗 Foreign key constraints:', constraints.length);

      await connection.end();
      
      console.log('✅ Database verification completed!');

    } catch (error) {
      console.error('❌ Error verifying database:', error);
      throw error;
    }
  }
}

// Chạy setup nếu được gọi trực tiếp
if (require.main === module) {
  const setup = new DatabaseSetup();
  
  setup.setupDatabase()
    .then(() => setup.verifySetup())
    .then(() => {
      console.log('🎉 Video call integration database ready!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseSetup;
