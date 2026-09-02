async function test() {
  try {
    const url = 'http://127.0.0.1:7500/executions';
    const response = await fetch(url, {
      headers: { 'X-User-Id': '1572', 'X-Firm-Id': '5' }
    });
    const data = await response.json();
    const executions = data.executions || [];
    if (executions.length > 0) {
      console.log('Keys of first execution:', Object.keys(executions[0]));
      console.log('Execution details:', JSON.stringify(executions[0], null, 2));
    } else {
      console.log('No active executions found.');
    }
  } catch (err) {
    console.error('Error occurred:', err.message);
  }
}
test();
