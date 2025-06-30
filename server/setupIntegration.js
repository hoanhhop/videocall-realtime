const DatabaseAdapter = require('./adapters/DatabaseAdapter');
require('dotenv').config();

/**
 * Script để setup database cho integration server
 */
class DatabaseSetup {
  constructor() {
    this.db = new DatabaseAdapter();
  }

  async setupTables() {
    try {
      console.log('🗄️  Setting up database tables...');
      
      const connection = await this.db.getConnection();

      // Tạo bảng user_online_status
      console.log('Creating user_online_status table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS user_online_status (
          user_id INT PRIMARY KEY,
          is_online BOOLEAN DEFAULT FALSE,
          last_seen TIMESTAMP NULL,
          socket_id VARCHAR(255),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES taikhoan(Id) ON DELETE CASCADE
        )
      `);

      // Tạo bảng video_call_sessions
      console.log('Creating video_call_sessions table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS video_call_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          caller_id INT NOT NULL,
          callee_id INT NOT NULL,
          room_id VARCHAR(255) NOT NULL UNIQUE,
          status ENUM('pending', 'active', 'ended', 'rejected') DEFAULT 'pending',
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (caller_id) REFERENCES taikhoan(Id) ON DELETE CASCADE,
          FOREIGN KEY (callee_id) REFERENCES taikhoan(Id) ON DELETE CASCADE,
          INDEX idx_room_id (room_id),
          INDEX idx_status (status),
          INDEX idx_caller_id (caller_id),
          INDEX idx_callee_id (callee_id)
        )
      `);

      // Tạo bảng call_notifications
      console.log('Creating call_notifications table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS call_notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          type VARCHAR(50) NOT NULL,
          data JSON,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES taikhoan(Id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_is_read (is_read),
          INDEX idx_created_at (created_at)
        )
      `);

      await connection.end();
      console.log('✅ Database tables created successfully!');
      
    } catch (error) {
      console.error('❌ Error setting up database:', error);
      throw error;
    }
  }

  async run() {
    try {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║           Video Call Integration Database Setup          ║
╚══════════════════════════════════════════════════════════╝
      `);

      await this.setupTables();

      console.log(`
╔══════════════════════════════════════════════════════════╗
║                    Setup Complete!                       ║
╚══════════════════════════════════════════════════════════╝
      `);

    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.run();
}

module.exports = DatabaseSetup;
