export function extractAgentOptions(runners = []) {
  return Array.from(
    new Map(
      runners.map((r) => {
        let empId = r.client_id || r.emp_id;
        if (!empId && r.runner_id && r.runner_id.startsWith('runner_')) {
          const parts = r.runner_id.split('_');
          if (parts[1] && !isNaN(parseInt(parts[1], 10))) empId = parseInt(parts[1], 10);
        }
        if (!empId) empId = 1572;

        const displayName = r.agent_name || r.server_name || `Runner ${r.runner_id || ''}`;
        return [empId, { empId, displayName }];
      })
    ).values()
  );
}
