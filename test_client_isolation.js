const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:7700';

function makeRequest(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runIsolationTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING STRICT CLIENT-WISE ISOLATION TEST SUITE');
  console.log('====================================================\n');

  try {
    // Test 1: Client A (1572) API Isolation
    console.log('🔹 Test 1: Client A (1572) GET /api/status');
    const resA = await makeRequest('/api/status', 'GET', { 'X-Client-Id': '1572' });
    assert.strictEqual(resA.status, 200);
    assert.strictEqual(resA.body.client_id, 1572);
    const runnersA = resA.body.runners;
    assert(runnersA.every(r => r.client_id === 1572), 'Client A must see ONLY Client A runners!');
    console.log(`   ✅ PASS: Client A sees ${runnersA.length} runners (All client_id: 1572).\n`);

    // Test 2: Client B (2001) API Isolation
    console.log('🔹 Test 2: Client B (2001) GET /api/status');
    const resB = await makeRequest('/api/status', 'GET', { 'X-Client-Id': '2001' });
    assert.strictEqual(resB.status, 200);
    assert.strictEqual(resB.body.client_id, 2001);
    const runnersB = resB.body.runners;
    assert(runnersB.every(r => r.client_id === 2001), 'Client B must see ONLY Client B runners!');
    assert(runnersB.length > 0, 'Client B should have allocated runners.');
    console.log(`   ✅ PASS: Client B sees ${runnersB.length} runners (All client_id: 2001).\n`);

    // Test 3: Client Isolation Check - Client A vs Client B Runner Disjoint Sets
    console.log('🔹 Test 3: Client A & Client B Runner Segregation');
    const namesA = new Set(runnersA.map(r => r.agent_name));
    const namesB = new Set(runnersB.map(r => r.agent_name));
    const intersection = [...namesA].filter(x => namesB.has(x));
    assert.strictEqual(intersection.length, 0, 'Client A and Client B runner sets must be disjoint!');
    console.log('   ✅ PASS: Client A and Client B runners are 100% disjoint.\n');

    // Test 4: Admin Access (X-Role: admin)
    console.log('🔹 Test 4: Admin View (X-Role: admin)');
    const resAdmin = await makeRequest('/api/status', 'GET', { 'X-Role': 'admin' });
    assert.strictEqual(resAdmin.status, 200);
    assert.strictEqual(resAdmin.body.is_admin, true);
    const allRunners = resAdmin.body.runners;
    assert(allRunners.length >= 12, 'Admin must see ALL clients runners.');
    console.log(`   ✅ PASS: Admin sees total ${allRunners.length} runners across all clients.\n`);

    // Test 5: Security Check - HTTP 403 Forbidden Enforcement
    console.log('🔹 Test 5: Security Check - Unauthorized Cross-Client Request (HTTP 403)');
    const resTampered = await makeRequest('/api/status', 'GET', {
      'X-Auth-Client-Id': '1572',
      'X-Client-Id': '2001'
    });
    assert.strictEqual(resTampered.status, 403);
    assert(resTampered.body.error.includes('403 Forbidden'), 'Unauthorized cross-client request must return 403 Forbidden.');
    console.log('   ✅ PASS: Tampered cross-client request rejected with 403 Forbidden.\n');

    console.log('====================================================');
    console.log('🎉 ALL CLIENT-WISE ISOLATION TESTS PASSED 100%!');
    console.log('====================================================');
    process.exit(0);

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run test suite
runIsolationTests();
