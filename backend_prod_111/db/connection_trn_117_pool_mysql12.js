const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '88.150.227.117',
  user: 'nrktrn_web_admin',
  password: 'GOeg&*$*657',
  database: 'nrkindex_trn',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  waitForConnections: true,   // ✅ instead of acquireTimeout
  multipleStatements: true,
  charset: 'utf8mb4',
});

pool.on('error', (err) => {
  console.error('❌ MySQL pool error in connection_trn_117_pool_mysql12:', err.code, err.message);
});


// Monitor new connections (optional)
pool.on('connection', (connection) => {
  console.log('✅ MySQL pool connected: ID', connection.threadId);


   connection.on('error', (err) => {
    console.error('❌ MySQL connection error in connection_trn_117_pool_mysql12 :', err.code, err.message);
  });

  connection.on('close', () => {
    console.warn('⚠️ MySQL connection closed');
  });
});

// Wrap the original execute function
const originalExecute = pool.execute.bind(pool);

const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ECONNREFUSED',
  'EPIPE',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_HANDSHAKE_TWICE',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
  'ER_SERVER_SHUTDOWN', // Server shutting down
  'ER_LOCK_DEADLOCK', // 
];



pool.execute = async function (...args) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      return await originalExecute(...args);
    } catch (err) {
      attempt++;
      const isRetryable = RETRYABLE_ERRORS.includes(err.code);
      console.error(`🔥 MySQL execute error [${err.code || err.message}], attempt ${attempt}`);

      if (!isRetryable || attempt >= MAX_RETRIES) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 500)); // short delay
    }
  }
};

const originalQuery = pool.query.bind(pool);

pool.query = async function (...args) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      return await originalQuery(...args);
    } catch (err) {
      attempt++;
      const isRetryable = RETRYABLE_ERRORS.includes(err.code);
      console.error(`🔥 MySQL query error [${err.code || err.message}], attempt ${attempt}`);
      if (!isRetryable || attempt >= MAX_RETRIES) throw err;
      await new Promise((res) => setTimeout(res, 500));
    }
  }
};

// Keep-alive ping (every 5 minutes)
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ MySQL keep-alive ping success');
  } catch (err) {
    console.warn('⚠️ Keep-alive failed:', err.code || err.message);
  }
}, 5 * 60 * 1000);


module.exports = pool;




// const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//   host: '88.150.227.117',
//   user: 'nrkindexdev1_admin',
//   password: 'nrkv1@0413',
//   database: 'nrkindex_trn',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// pool.on('connection', (connection) => {
//   console.log('✅ MySQL pool connected: ID', connection.threadId);

//   connection.on('error', (err) => {
//     console.error('❌ MySQL connection error:', err.code); // PROTOCOL_CONNECTION_LOST, etc.
//   });

//   connection.on('close', () => {
//     console.warn('⚠️ MySQL connection closed');
//   });
// });

// module.exports = pool;
