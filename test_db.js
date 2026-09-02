const mysql = require('mysql2/promise');

async function test() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '88.150.227.117',
      user: 'nrktrn_web_admin',
      password: 'GOeg&*$*657',
      database: 'nrkindex_trn',
      port: 3306
    });

    const [states] = await connection.query(`
      SELECT state, COUNT(*) as count 
      FROM portal 
      WHERE status = 'ACTIVE' 
      GROUP BY state
    `);
    console.log('States & counts:', states);

    const [samples] = await connection.query(`
      SELECT portalid, portalname, state 
      FROM portal 
      WHERE status = 'ACTIVE' AND state = 'Karnataka'
      LIMIT 10
    `);
    console.log('Sample Karnataka portals:', samples);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}
test();
