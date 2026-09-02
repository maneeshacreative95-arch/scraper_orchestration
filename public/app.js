document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const backendStatusBadge = document.getElementById('backendStatusBadge');
  const resetBtn = document.getElementById('resetBtn');

  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const workflowViews = document.querySelectorAll('.workflow-view');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      workflowViews.forEach(v => v.classList.add('hidden'));

      btn.classList.add('active');
      const viewId = btn.dataset.view;
      const targetView = document.getElementById(viewId);
      if (targetView) targetView.classList.remove('hidden');
    });
  });

  // City Queue & Single Prompt LLM Discovery Elements
  const orchestratePromptBtn = document.getElementById('orchestratePromptBtn');
  const scrapingPromptInput = document.getElementById('scrapingPromptInput');
  const discoveryResultsPanel = document.getElementById('discoveryResultsPanel');
  const discoveryResultsTableBody = document.getElementById('discoveryResultsTableBody');

  const addCityTriggerBtn = document.getElementById('addCityTriggerBtn');
  const addCityForm = document.getElementById('addCityForm');
  const submitCityBtn = document.getElementById('submitCityBtn');
  const cancelCityBtn = document.getElementById('cancelCityBtn');
  const cityNameInput = document.getElementById('cityNameInput');
  const cityStateInput = document.getElementById('cityStateInput');
  const cityPriorityInput = document.getElementById('cityPriorityInput');
  const cityCountInput = document.getElementById('cityCountInput');
  const cityQueueCardsContainer = document.getElementById('cityQueueCardsContainer');
  const regionPopulateSelect = document.getElementById('regionPopulateSelect');

  const startLLMOrchestrationBtn = document.getElementById('startLLMOrchestrationBtn');
  const llmTopicInput = document.getElementById('llmTopicInput');
  const llmRegionInput = document.getElementById('llmRegionInput');
  const llmTargetLimitInput = document.getElementById('llmTargetLimitInput');
  const validationResultsPanel = document.getElementById('validationResultsPanel');
  const validationResultsTableBody = document.getElementById('validationResultsTableBody');

  // Runner Registry Elements
  const addRunnerTriggerBtn = document.getElementById('addRunnerTriggerBtn');
  const addRunnerForm = document.getElementById('addRunnerForm');
  const submitRunnerBtn = document.getElementById('submitRunnerBtn');
  const cancelRunnerBtn = document.getElementById('cancelRunnerBtn');
  const runnerServerNameInput = document.getElementById('runnerServerNameInput');
  const runnerHostIpInput = document.getElementById('runnerHostIpInput');
  const runnerAgentNameInput = document.getElementById('runnerAgentNameInput');
  const runnerRegistryTableBody = document.getElementById('runnerRegistryTableBody');

  // Agent Legacy Elements
  const addAgentTriggerBtn = document.getElementById('addAgentTriggerBtn');
  const addAgentForm = document.getElementById('addAgentForm');
  const submitAgentBtn = document.getElementById('submitAgentBtn');
  const cancelAgentBtn = document.getElementById('cancelAgentBtn');
  const agentNameInput = document.getElementById('agentNameInput');
  const agentPortalInput = document.getElementById('agentPortalInput');
  const agentsGrid = document.getElementById('agentsGrid');

  // Allocation Engine Elements
  const pauseEngineBtn = document.getElementById('pauseEngineBtn');
  const resumeEngineBtn = document.getElementById('resumeEngineBtn');
  const allocAgentSelect = document.getElementById('allocAgentSelect');
  const allocCitySelect = document.getElementById('allocCitySelect');
  const assignAgentBtn = document.getElementById('assignAgentBtn');
  const allocationsTableBody = document.getElementById('allocationsTableBody');

  // Batch Scheduler Elements
  const schedulerTableBody = document.getElementById('schedulerTableBody');
  const schedBatchSizeInput = document.getElementById('schedBatchSizeInput');
  const schedMaxAgentsInput = document.getElementById('schedMaxAgentsInput');
  const saveSchedConfigBtn = document.getElementById('saveSchedConfigBtn');
  const runBasicCheck = document.getElementById('runBasicCheck');
  const runContactCheck = document.getElementById('runContactCheck');
  const runSocialCheck = document.getElementById('runSocialCheck');
  const runLeaderCheck = document.getElementById('runLeaderCheck');

  // Execution Monitor
  const monitorExecutionsList = document.getElementById('monitorExecutionsList');

  // Reallocation Timeline
  const reallocationTimeline = document.getElementById('reallocationTimeline');

  // Performance Matrix Elements
  const matrixTotalScraped = document.getElementById('matrixTotalScraped');
  const matrixCompletedStats = document.getElementById('matrixCompletedStats');
  const matrixRunnersStatus = document.getElementById('matrixRunnersStatus');
  const matrixAvgSpeed = document.getElementById('matrixAvgSpeed');
  const matrixAvgSuccess = document.getElementById('matrixAvgSuccess');
  const matrixSlowestCity = document.getElementById('matrixSlowestCity');
  const matrixGridTableBody = document.getElementById('matrixGridTableBody');

  // Performance Improvements Elements
  const improvementsTableBody = document.getElementById('improvementsTableBody');

  // Common Errors Elements
  const errorsTableBody = document.getElementById('errorsTableBody');

  // Form toggles
  if (addCityTriggerBtn) addCityTriggerBtn.addEventListener('click', () => addCityForm && addCityForm.classList.remove('hidden'));
  if (cancelCityBtn) cancelCityBtn.addEventListener('click', () => { addCityForm && addCityForm.classList.add('hidden'); clearCityForm(); });
  if (addAgentTriggerBtn) addAgentTriggerBtn.addEventListener('click', () => addAgentForm && addAgentForm.classList.remove('hidden'));
  if (cancelAgentBtn) cancelAgentBtn.addEventListener('click', () => { addAgentForm && addAgentForm.classList.add('hidden'); clearAgentForm(); });

  if (addRunnerTriggerBtn) addRunnerTriggerBtn.addEventListener('click', () => addRunnerForm && addRunnerForm.classList.remove('hidden'));
  if (cancelRunnerBtn) cancelRunnerBtn.addEventListener('click', () => {
    if (addRunnerForm) addRunnerForm.classList.add('hidden');
    clearRunnerForm();
  });

  function clearCityForm() {
    if (cityNameInput) cityNameInput.value = '';
    if (cityStateInput) cityStateInput.value = '';
    if (cityPriorityInput) cityPriorityInput.value = '';
    if (cityCountInput) cityCountInput.value = '';
  }

  function clearAgentForm() {
    if (agentNameInput) agentNameInput.value = '';
    if (agentPortalInput) agentPortalInput.value = '';
  }

  function clearRunnerForm() {
    if (runnerServerNameInput) runnerServerNameInput.value = '';
    if (runnerHostIpInput) runnerHostIpInput.value = '';
    if (runnerAgentNameInput) runnerAgentNameInput.value = '';
  }

  // Fetch / Sync loop
  const API_BASE = '';
  let configInitialized = false;

  async function fetchStatus() {
    try {
      const response = await fetch(`${API_BASE}/api/status`);
      if (!response.ok) throw new Error('Offline');
      const data = await response.json();
      updateUI(data);
    } catch (error) {
      console.error('Connection failure:', error);
      if (backendStatusBadge) {
        backendStatusBadge.textContent = 'Offline';
        backendStatusBadge.className = 'badge badge-failed';
      }
    }
  }

  // Update UI Elements
  function updateUI(data) {
    // Backend Status Badge
    if (backendStatusBadge) {
      if (data.backendOnline) {
        backendStatusBadge.textContent = data.backendStatus || '🟢 Scraper Manager Connected';
        backendStatusBadge.className = 'badge badge-completed';
      } else {
        backendStatusBadge.textContent = data.backendStatus || 'Offline';
        backendStatusBadge.className = 'badge badge-failed';
      }
    }

    // Keep scheduler inputs in sync with server configuration
    if (data.schedulerConfig) {
      if (schedBatchSizeInput && document.activeElement !== schedBatchSizeInput) schedBatchSizeInput.value = data.schedulerConfig.batch_size;
      if (schedMaxAgentsInput && document.activeElement !== schedMaxAgentsInput) schedMaxAgentsInput.value = data.schedulerConfig.max_parallel_agents;
      if (runBasicCheck && document.activeElement !== runBasicCheck) runBasicCheck.checked = data.schedulerConfig.run_basic;
      if (runContactCheck && document.activeElement !== runContactCheck) runContactCheck.checked = data.schedulerConfig.run_contact;
      if (runSocialCheck && document.activeElement !== runSocialCheck) runSocialCheck.checked = data.schedulerConfig.run_social;
      if (runLeaderCheck && document.activeElement !== runLeaderCheck) runLeaderCheck.checked = data.schedulerConfig.run_leader;
    }

    // 1. City Queue Cards Grid List
    if (cityQueueCardsContainer) {
      cityQueueCardsContainer.innerHTML = '';
      if (data.cityQueue.length === 0) {
        cityQueueCardsContainer.innerHTML = `<div style="text-align: center; color: var(--color-text-muted); padding: 3rem; background: var(--bg-card); border: 1px dashed var(--border-card); border-radius: 16px;">Queue is empty. Enter a prompt above (e.g. "Run healthcare companies across South India") and click Analyze & Orchestrate.</div>`;
      } else {
        data.cityQueue.forEach(city => {
          const badgeClass = city.status === 'Completed' ? 'badge-completed' : (city.status === 'Running' ? 'badge-running' : 'badge-pending');
          
          let actions = '';
          if (city.status === 'Pending') {
            actions = `
              <button class="btn btn-primary btn-sm" style="width: 100%; border-radius: 8px;" onclick="splitBatch('${city.city_id}')">⚡ Batch Split</button>
              <button class="btn btn-secondary btn-sm" style="width: 100%; border-radius: 8px; color: var(--color-error);" onclick="deleteCity('${city.city_id}')">Delete</button>
            `;
          } else if (city.status === 'Running') {
            actions = `<span class="badge badge-running" style="padding: 6px 12px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.7rem;">ACTIVE RUNNING<br>${city.execution_id || ''}</span>`;
          } else {
            actions = `<span class="badge badge-completed" style="padding: 6px 12px; border-radius: 6px;">COMPLETED</span>`;
          }

          let cardGradient = 'linear-gradient(135deg, #374151, #4b5563)';
          const st = String(city.state || '').toLowerCase();
          if (st.includes('karnataka')) {
            cardGradient = 'linear-gradient(135deg, #1e3a8a, #3b82f6)';
          } else if (st.includes('tamil') || st === 'tn') {
            cardGradient = 'linear-gradient(135deg, #7c2d12, #ea580c)';
          } else if (st.includes('kerala')) {
            cardGradient = 'linear-gradient(135deg, #064e3b, #10b981)';
          } else if (st.includes('andhra') || st.includes('telangana') || st === 'ap') {
            cardGradient = 'linear-gradient(135deg, #581c87, #a855f7)';
          }

          const card = document.createElement('div');
          card.className = 'premium-city-card';
          card.innerHTML = `
            <div class="city-image-area" style="background: ${cardGradient};">
              <div class="city-image-placeholder">🏙️</div>
              <span class="city-state-tag">${city.state || 'Portal'}</span>
            </div>
            
            <div class="city-details-area">
              <div style="display: flex; align-items: center; gap: 10px;">
                <h3 class="city-title">${city.city_name}</h3>
                <span class="badge ${badgeClass}">${city.status}</span>
              </div>
              <div class="city-location-row" style="margin-top: 8px;">
                <span>📍 Portal ID: <code>${city.portal_id && city.portal_id !== 0 ? city.portal_id : 'N/A'}</code></span>
                <span style="color: rgba(255,255,255,0.15);">|</span>
                <span>Priority: <strong>#${city.priority}</strong></span>
              </div>
              <div class="city-agent-row" style="margin-top: 5px;">
                <span>Assigned Agent: <strong style="${city.assigned_agent ? 'color: var(--color-success);' : 'color: var(--color-text-muted);'}">${city.assigned_agent || 'Unassigned'}</strong></span>
              </div>
            </div>

            <div class="city-data-grid">
              <div class="data-item">
                <span class="data-label">Target limit</span>
                <span class="data-value">${city.total_companies}</span>
              </div>
              <div class="data-item">
                <span class="data-label">Processed</span>
                <span class="data-value" style="color: var(--accent-color);">${city.companies_processed}</span>
              </div>
              <div class="data-item">
                <span class="data-label">Batches</span>
                <span class="data-value">${city.batch_count || '0/0'}</span>
              </div>
              <div class="data-item">
                <span class="data-label">Current Stage</span>
                <span class="data-value" style="color: var(--color-warning);">${city.current_stage || '-'}</span>
              </div>
            </div>

            <div class="city-actions-area">
              ${actions}
            </div>
          `;
          cityQueueCardsContainer.appendChild(card);
        });
      }
    }

    // Step 1 Discovery Results Table (State, City / Town, Approx Business Count)
    if (data.discoveryResults && data.discoveryResults.length > 0) {
      renderDiscoveryResults(data.discoveryResults);
    }

    // Step 2 Portal Validation Results Table
    if (data.validationResults && data.validationResults.length > 0) {
      renderValidationResults(data.validationResults);
    }

    // 2. Distributed Runner Registry (Step 5)
    renderRunnersTable(data.runners || []);

    // 3. Allocation Engine State & Controls
    if (pauseEngineBtn && resumeEngineBtn) {
      if (data.allocationEngineActive) {
        pauseEngineBtn.classList.remove('hidden');
        resumeEngineBtn.classList.add('hidden');
      } else {
        pauseEngineBtn.classList.add('hidden');
        resumeEngineBtn.classList.remove('hidden');
      }
    }

    // Populate manual selects
    if (allocAgentSelect) {
      const idleAgents = data.agents.filter(a => a.status === 'Idle');
      allocAgentSelect.innerHTML = idleAgents.map(a => {
        const pStr = (a.portal_id && a.portal_id !== 0) ? `Portal ${a.portal_id}` : 'No Portal';
        return `<option value="${a.agent_id}">${a.agent_name} (${pStr})</option>`;
      }).join('');
      if (idleAgents.length === 0) allocAgentSelect.innerHTML = `<option value="">No Idle Agents</option>`;
    }

    if (allocCitySelect) {
      const pendingCities = data.cityQueue.filter(c => c.status === 'Pending');
      allocCitySelect.innerHTML = pendingCities.map(c => `<option value="${c.city_id}">${c.city_name}</option>`).join('');
      if (pendingCities.length === 0) allocCitySelect.innerHTML = `<option value="">No Pending Cities</option>`;
    }

    // Active allocations mappings
    if (allocationsTableBody) {
      allocationsTableBody.innerHTML = '';
      if (!data.allocations || data.allocations.length === 0) {
        allocationsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-text-muted);">No active allocations.</td></tr>`;
      } else {
        data.allocations.forEach(alloc => {
          const tr = document.createElement('tr');
          const isRunning = alloc.status === 'Running';
          const statusBadge = isRunning 
            ? `<span class="badge badge-success" style="padding: 4px 8px; border-radius: 4px; background: rgba(34,197,94,0.15); color: #4ade80;">Running</span>`
            : `<span class="badge badge-secondary" style="padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #a0aec0;">Idle</span>`;
          
          const reassignBtn = isRunning 
            ? `<button class="btn btn-secondary btn-sm" onclick="reassignAgent('${alloc.agent_id}')">Reassign</button>`
            : '-';
          
          tr.innerHTML = `
            <td><strong>${alloc.agent_name}</strong></td>
            <td><code>${alloc.portal_id && alloc.portal_id !== '-' && alloc.portal_id !== 0 ? alloc.portal_id : '-'}</code></td>
            <td style="${isRunning ? 'color: var(--accent-color); font-weight: 500;' : ''}">${alloc.assigned_city || 'Idle'}</td>
            <td>${alloc.batch_count || '-'}</td>
            <td>${alloc.workflow_stage || '-'}</td>
            <td><strong style="color: #4ade80;">${(alloc.scraped_contacts || 0).toLocaleString()}</strong></td>
            <td>${statusBadge}</td>
            <td>${reassignBtn}</td>
          `;
          allocationsTableBody.appendChild(tr);
        });
      }
    }

    // 4. Batch Scheduler
    if (schedulerTableBody) {
      schedulerTableBody.innerHTML = '';
      if (data.schedulerBatches.length === 0) {
        schedulerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted);">No scheduled scraper executions active.</td></tr>`;
      } else {
        data.schedulerBatches.forEach(batch => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><code>${batch.batch_id}</code></td>
            <td>${batch.city_name}</td>
            <td>${batch.agent_name}</td>
            <td>${batch.started_at || '-'}</td>
            <td><strong style="color: var(--accent-color);">${batch.eta || '-'}</strong></td>
            <td>${batch.completed_at || '-'}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: 600; color: var(--color-success);">${batch.progress}</span>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">(${batch.completed_batches}/${batch.total_batches})</span>
              </div>
            </td>
          `;
          schedulerTableBody.appendChild(tr);
        });
      }
    }

    // 5. Execution Pipeline Monitoring View
    if (monitorExecutionsList) {
      monitorExecutionsList.innerHTML = '';
      
      const activeQueueItems = (data.cityQueue || []).filter(c => c.status === 'Running' || c.status === 'Completed' || c.status === 'Pending');
      const activeExecs = Object.values(data.executions || {});

      if (activeQueueItems.length === 0 && activeExecs.length === 0) {
        monitorExecutionsList.innerHTML = `<div style="text-align: center; color: var(--color-text-muted); padding: 3rem;">No active execution pipelines. Run a workflow prompt on City Discovery to start orchestration!</div>`;
      } else {
        const cardsGrid = document.createElement('div');
        cardsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px;';

        const displayItems = activeQueueItems.length > 0 ? activeQueueItems : activeExecs;

        displayItems.forEach((item, index) => {
          const execId = item.execution_id || `exec_${1788243317 + index}`;
          const topic = data.currentTopic || 'Healthcare / AI Startups';
          const state = item.state || 'India';
          const cleanCity = (item.city_name || item.city || 'Target City').replace(/\[Batch \d+\/\d+\]/, '').replace(/\(\d+\)/, '').trim();
          const portalId = item.portal_id || '-';
          
          let runnerName = 'Server-1';
          if (item.assigned_agent && data.runners) {
            const matchR = data.runners.find(r => r.agent_name === item.assigned_agent);
            if (matchR) runnerName = matchR.server_name || 'Runner-1';
          }

          const agentName = item.assigned_agent || item.username || 'Hari Krishna';
          const batchStr = item.batch_count || item.batch_number || 'Batch 1/1';
          const processed = item.companies_processed !== undefined ? item.companies_processed : (item.processed || 0);
          const totalComp = item.total_companies || item.target || item.estimated_company_count || 300;
          const progressPercent = totalComp > 0 ? Math.min(100, Math.round((processed / totalComp) * 100)) : 0;
          const stage = (item.current_stage && item.current_stage !== '-') ? item.current_stage : 'Basic Scraper';
          const eta = item.eta || '12 Minutes';
          const status = item.status || 'Running';
          const recovery = item.recovery_event || null;
          const tr = item.transitions || {};

          const card = document.createElement('div');
          card.className = 'panel-card';
          card.style.cssText = 'background: rgba(255,255,255,0.015); border: 1px solid var(--border-card); border-radius: 12px; padding: 1.25rem;';

          let statusBadgeClass = 'badge-running';
          if (status === 'Completed') statusBadgeClass = 'badge-completed';
          if (status === 'Failed') statusBadgeClass = 'badge-error';

          const recoveryHtml = recovery ? `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 0.8rem; color: #f87171;">
              <strong>Auto Failure Recovery:</strong> ${recovery}
            </div>
          ` : '';

          const basicStatus = stage === 'Basic Scraper' ? '<span style="color:#4ade80;">🟢 Basic Scraper Running</span>' : (tr.basic_at ? '✓ Basic Scraper Completed' : '⚪ Basic Scraper Pending');
          const contactStatus = stage === 'Contact Scraper' ? '<span style="color:#4ade80;">🟢 Contact Scraper Running</span>' : (tr.contact_at ? '✓ Contact Scraper Completed' : '🟡 Contact Scraper Waiting');
          const socialStatus = stage === 'Social Media' ? '<span style="color:#4ade80;">🟢 Social Media Running</span>' : (tr.social_at ? '✓ Social Media Completed' : '⚪ Social Media Pending');
          const leaderStatus = stage === 'Leader Scraper' ? '<span style="color:#4ade80;">🟢 Leader Scraper Running</span>' : (tr.leader_at ? '✓ Leader Scraper Completed' : '⚪ Leader Scraper Pending');

          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-card); padding-bottom: 10px; margin-bottom: 12px;">
              <span style="font-size: 0.85rem; color: var(--color-text-muted);">Execution: <code style="color: #60a5fa; font-weight: 600;">${execId}</code></span>
              <span class="badge ${statusBadgeClass}" style="text-transform: uppercase;">${status}</span>
            </div>
            
            ${recoveryHtml}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.83rem; margin-bottom: 12px;">
              <div>Topic: <strong>${topic}</strong></div>
              <div>State: <strong>${state}</strong></div>
              <div>City: <strong>${cleanCity}</strong></div>
              <div>Portal ID: <code>${portalId}</code></div>
              <div>Runner: <strong>${runnerName}</strong></div>
              <div>Agent: <strong>${agentName}</strong></div>
              <div>Batch: <strong>${batchStr}</strong></div>
              <div>Stage: <span style="color: var(--accent-color); font-weight: 600;">${stage}</span></div>
            </div>

            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
                <span>Progress: <strong>${processed} / ${totalComp} (${progressPercent}%)</strong></span>
                <span style="color: var(--color-text-muted);">ETA: <strong>${eta}</strong></span>
              </div>
              <div style="background: rgba(255,255,255,0.06); height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: var(--accent-color); width: ${progressPercent}%; height: 100%; transition: width 0.4s ease;"></div>
              </div>
            </div>

            <div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 10px; font-size: 0.78rem; border: 1px solid rgba(255,255,255,0.04);">
              <div style="font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Live Workflow Timeline</div>
              <div style="display: flex; flex-direction: column; gap: 4px; color: #cbd5e1;">
                <div>✓ 1. LLM Discovery Completed — ${tr.discovery_at || '10:30 AM'}</div>
                <div>✓ 2. Portal Validation Completed — ${tr.validation_at || '10:31 AM'}</div>
                <div>✓ 3. Batch Scheduler Completed — ${tr.scheduler_at || '10:32 AM'}</div>
                <div>🟢 4. Agent Assigned — ${agentName} (${runnerName})</div>
                <div>5. ${basicStatus} ${tr.basic_at ? '— ' + tr.basic_at : ''}</div>
                <div>6. ${contactStatus} ${tr.contact_at ? '— ' + tr.contact_at : ''}</div>
                <div>7. ${socialStatus} ${tr.social_at ? '— ' + tr.social_at : ''}</div>
                <div>8. ${leaderStatus} ${tr.leader_at ? '— ' + tr.leader_at : ''}</div>
                <div>9. ${status === 'Completed' ? '✓ Workflow Completed' : (status === 'Failed' ? '❌ Workflow Failed' : '⚪ Execution Active')}</div>
              </div>
            </div>
          `;

          cardsGrid.appendChild(card);
        });

        monitorExecutionsList.appendChild(cardsGrid);
      }
    }

    // 6. Auto Reallocation Event Timeline (Workflow 7)
    const reallocationTimelineBody = document.getElementById('reallocationTimelineBody');
    if (reallocationTimelineBody) {
      if (!data.reallocationEvents || data.reallocationEvents.length === 0) {
        reallocationTimelineBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">
              Timeline is active. Monitoring runner heartbeats every 5s and tracking failovers.
            </td>
          </tr>`;
      } else {
        reallocationTimelineBody.innerHTML = data.reallocationEvents.map(evt => {
          let eventBadge = '<span class="badge badge-pending">System Event</span>';
          const typeStr = String(evt.event_type || evt.event_desc || '');

          if (typeStr.includes('Completed')) {
            eventBadge = '<span class="badge badge-completed" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);">🟢 Batch Completed</span>';
          } else if (typeStr.includes('Heartbeat')) {
            eventBadge = '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">⚠️ Heartbeat Lost</span>';
          } else if (typeStr.includes('Failed') || typeStr.includes('Chrome') || typeStr.includes('Timeout')) {
            eventBadge = '<span class="badge badge-failed" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">❌ Execution Failed</span>';
          } else if (typeStr.includes('Manual')) {
            eventBadge = '<span class="badge badge-running" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">⚡ Manual Reassign</span>';
          }

          const fromAgent = evt.from_agent || '-';
          const toAgent = evt.to_agent || '-';
          const portalId = evt.portal_id || '-';
          const cityBatch = evt.city_batch || evt.city || '-';
          const reason = evt.reason || evt.event_desc || 'Workflow reallocation executed.';

          return `
            <tr style="background: rgba(30, 41, 59, 0.5); border-radius: 8px;">
              <td style="padding: 14px 16px; font-family: var(--font-mono); font-size: 0.8rem; color: #94a3b8; white-space: nowrap;">${evt.timestamp || '-'}</td>
              <td style="padding: 14px 16px; white-space: nowrap;">${eventBadge}</td>
              <td style="padding: 14px 16px; font-weight: 600; color: #f1f5f9;">${fromAgent}</td>
              <td style="padding: 14px 16px; font-weight: 600; color: #38bdf8;">${toAgent}</td>
              <td style="padding: 14px 16px; font-family: var(--font-mono); font-size: 0.85rem; color: #cbd5e1;">${portalId}</td>
              <td style="padding: 14px 16px; font-weight: 600; color: #f8fafc;">${cityBatch}</td>
              <td style="padding: 14px 16px; font-size: 0.85rem; color: #94a3b8; line-height: 1.4;">${reason}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 7. Performance Matrix
    if (matrixTotalScraped) matrixTotalScraped.innerHTML = `${data.metrics.totalScraped} <span style="font-size: 0.8rem; font-weight: 500; display: block; color: var(--color-text-muted); margin-top: 5px;">Today: ${data.metrics.scrapedToday} | ✉️ Emails: ${data.metrics.emailsFound} | 📞 Phones: ${data.metrics.phonesFound}</span>`;
    if (matrixCompletedStats) matrixCompletedStats.textContent = `${data.metrics.completedStates || 0} / ${data.metrics.completedCities || 0}`;
    if (matrixRunnersStatus) matrixRunnersStatus.textContent = `${data.metrics.activeRunners || 0} / ${data.metrics.idleRunners || 0}`;
    if (matrixAvgSpeed) matrixAvgSpeed.textContent = data.metrics.avgCompaniesPerMin || '0.0';
    if (matrixAvgSuccess) matrixAvgSuccess.textContent = data.metrics.avgSuccessRate + '%';
    if (matrixSlowestCity) matrixSlowestCity.textContent = data.metrics.slowestCity;

    if (matrixGridTableBody) {
      matrixGridTableBody.innerHTML = '';
      if (data.performanceMatrix.length === 0) {
        matrixGridTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--color-text-muted);">No reports archived yet.</td></tr>`;
      } else {
        data.performanceMatrix.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${row.city}</strong></td>
            <td>${row.agent}</td>
            <td><code>${row.portal_id && row.portal_id !== 0 ? row.portal_id : 'N/A'}</code></td>
            <td><code>${row.execution_id}</code></td>
            <td>${row.target_companies}</td>
            <td>${row.scraped_companies}</td>
            <td style="color: var(--color-success); font-weight: 600;">${row.success_rate}%</td>
            <td style="color: var(--color-error);">${row.failed_companies}</td>
            <td>${row.time_taken}s</td>
            <td><span class="badge badge-completed">${row.status}</span></td>
          `;
          matrixGridTableBody.appendChild(tr);
        });
      }
    }

    // 8. Performance Improvements
    if (improvementsTableBody) {
      improvementsTableBody.innerHTML = '';
      data.recommendations.forEach(rec => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="color: var(--color-error); font-weight: 500;">${rec.issue}</td>
          <td style="color: var(--color-success); font-weight: 600;">${rec.recommendation}</td>
        `;
        improvementsTableBody.appendChild(tr);
      });
    }

    // 9. Common Errors & Fixes
    if (errorsTableBody) {
      errorsTableBody.innerHTML = '';
      if (data.errorHistory.length === 0) {
        errorsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted);">No diagnostics logged. All connection ports active.</td></tr>`;
      } else {
        data.errorHistory.forEach(err => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><code>${err.execution_id || 'N/A'}</code></td>
            <td>${err.agent_name || 'System'}</td>
            <td>${err.city || 'Global'}</td>
            <td style="color: var(--color-error);">${err.message}</td>
            <td><code>${err.suggested_fix}</code></td>
            <td>
              <div style="display: flex; gap: 5px;">
                <button class="btn btn-primary btn-sm" onclick="retryError('${err.execution_id}', '${err.city}', ${err.portal_id || 0}, '${err.agent_name}')">Retry</button>
                <button class="btn btn-secondary btn-sm" style="color: var(--color-warning);" onclick="resumeError('${err.execution_id}', '${err.city}', ${err.portal_id || 0}, '${err.agent_name}')">Resume</button>
                <button class="btn btn-secondary btn-sm" style="color: var(--accent-color);" onclick="reassignError('${err.execution_id}', '${err.city}')">Reassign</button>
              </div>
            </td>
          `;
          errorsTableBody.appendChild(tr);
        });
      }
    }
  }

  // Single Prompt LLM Orchestration Trigger Handler ("Analyze & Orchestrate")
  if (orchestratePromptBtn) {
    orchestratePromptBtn.addEventListener('click', async () => {
      const promptText = scrapingPromptInput ? scrapingPromptInput.value.trim() : '';
      if (!promptText) return alert('Please enter a free-text scraping request (e.g. "Run healthcare companies across South India").');

      orchestratePromptBtn.textContent = 'Analyzing & Orchestrating...';
      orchestratePromptBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/orchestrate/full-workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText })
        });

        if (res.ok) {
          const data = await res.json();
          renderDiscoveryResults(data.discovery || []);
          renderValidationResults(data.validation || []);
          await fetchStatus();
        } else {
          const err = await res.json();
          console.error(`Orchestration Error: ${err.error || 'Failed to orchestrate prompt.'}`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        orchestratePromptBtn.textContent = 'Analyze & Orchestrate';
        orchestratePromptBtn.disabled = false;
      }
    });
  }

  // Render Step 1 Discovery Table (State, City / Town, Approx Business Count)
  function renderDiscoveryResults(discovery) {
    if (!discoveryResultsPanel || !discoveryResultsTableBody) return;
    if (!discovery || discovery.length === 0) return;

    discoveryResultsPanel.classList.remove('hidden');
    discoveryResultsTableBody.innerHTML = '';

    discovery.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.state}</strong></td>
        <td>${item.city}</td>
        <td style="color: var(--color-success); font-weight: 600;">${(item.approx_businesses || item.db_content_count || 0).toLocaleString()}</td>
      `;
      discoveryResultsTableBody.appendChild(tr);
    });
  }

  // Render Step 2 Portal Validation Table
  function renderValidationResults(results) {
    if (!results || results.length === 0 || !validationResultsPanel || !validationResultsTableBody) return;
    validationResultsPanel.classList.remove('hidden');
    validationResultsTableBody.innerHTML = '';
    
    results.forEach(res => {
      const badgeClass = res.status === 'Completed' ? 'badge-completed' : (res.status === 'Partial' ? 'badge-running' : 'badge-pending');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${res.state}</strong></td>
        <td>${res.city}</td>
        <td>${(res.estimated_businesses || 0).toLocaleString()}</td>
        <td style="color: var(--accent-color); font-weight: 500;">${(res.existing_businesses || 0).toLocaleString()}</td>
        <td style="color: var(--color-success); font-weight: 600;">${(res.remaining_businesses || 0).toLocaleString()}</td>
        <td><code>${res.portal_id || '-'}</code></td>
        <td><span class="badge ${badgeClass}">${res.status}</span></td>
      `;
      validationResultsTableBody.appendChild(tr);
    });
  }

  // Runner Registry Render & Form Handler
  if (submitRunnerBtn) {
    submitRunnerBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const server_name = runnerServerNameInput ? runnerServerNameInput.value.trim() : '';
      const host_ip = runnerHostIpInput ? runnerHostIpInput.value.trim() : '';
      const agent_name = runnerAgentNameInput ? runnerAgentNameInput.value.trim() : '';

      if (!server_name || !agent_name) return alert('Server Name and Agent Name are required.');

      try {
        const res = await fetch(`${API_BASE}/api/runners/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ server_name, host_ip, agent_name })
        });
        if (res.ok) {
          if (addRunnerForm) addRunnerForm.classList.add('hidden');
          clearRunnerForm();
          fetchStatus();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  function renderRunnersTable(runners) {
    if (!runnerRegistryTableBody) return;
    runnerRegistryTableBody.innerHTML = '';
    if (!runners || runners.length === 0) {
      runnerRegistryTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--color-text-muted);">No runners registered.</td></tr>`;
      return;
    }

    runners.forEach(r => {
      const statusClass = r.status === 'Running' || r.status === 'Busy' ? 'badge-running' : (r.status === 'Offline' || r.status === 'Crashed' ? 'badge-failed' : 'badge-completed');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${r.server_name}</strong></td>
        <td><code>${r.runner_id}</code></td>
        <td><code>${r.host_ip}</code></td>
        <td>${r.agent_name}</td>
        <td><span class="badge ${statusClass}">${r.status}</span></td>
        <td style="font-size: 0.75rem;">${r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleTimeString() : '-'}</td>
        <td style="color: var(--accent-color); font-weight: 500;">${r.current_workflow || '-'}</td>
        <td>${r.current_batch || '-'}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn btn-secondary btn-sm" onclick="sendRunnerHeartbeat('${r.runner_id}')">Heartbeat</button>
            <button class="btn btn-secondary btn-sm" style="color: var(--color-error);" onclick="deleteRunner('${r.runner_id}')">Delete</button>
          </div>
        </td>
      `;
      runnerRegistryTableBody.appendChild(tr);
    });
  }

  window.sendRunnerHeartbeat = async (runnerId) => {
    try {
      await fetch(`${API_BASE}/api/runners/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runner_id: runnerId })
      });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  window.deleteRunner = async (runnerId) => {
    if (confirm('Deregister runner?')) {
      try {
        await fetch(`${API_BASE}/api/runners/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runner_id: runnerId })
        });
        fetchStatus();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Allocation Controls Event Listeners
  if (pauseEngineBtn) {
    pauseEngineBtn.addEventListener('click', async () => {
      await fetch(`${API_BASE}/api/allocations/pause`, { method: 'POST' });
      fetchStatus();
    });
  }

  if (resumeEngineBtn) {
    resumeEngineBtn.addEventListener('click', async () => {
      await fetch(`${API_BASE}/api/allocations/resume`, { method: 'POST' });
      fetchStatus();
    });
  }

  if (assignAgentBtn) {
    assignAgentBtn.addEventListener('click', async () => {
      const agent_id = allocAgentSelect.value;
      const city_id = allocCitySelect.value;

      if (!agent_id || !city_id) return alert('Select both agent and city.');

      try {
        const res = await fetch(`${API_BASE}/api/allocations/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id, city_id })
        });
        if (res.ok) fetchStatus();
      } catch (err) {
        console.error(err);
      }
    });
  }

  window.reassignAgent = async (agentId) => {
    const newCityId = prompt("Enter the new target City ID to assign to this agent:");
    if (newCityId) {
      try {
        const res = await fetch(`${API_BASE}/api/allocations/reassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agentId, new_city_id: newCityId })
        });
        if (res.ok) fetchStatus();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Save Scheduler Config Event
  if (saveSchedConfigBtn) {
    saveSchedConfigBtn.addEventListener('click', async () => {
      const batch_size = parseInt(schedBatchSizeInput.value, 10);
      const max_parallel_agents = parseInt(schedMaxAgentsInput.value, 10);
      const run_basic = runBasicCheck.checked;
      const run_contact = runContactCheck.checked;
      const run_social = runSocialCheck.checked;
      const run_leader = runLeaderCheck.checked;

      if (isNaN(batch_size) || isNaN(max_parallel_agents)) {
        return alert('Enter valid numeric config values.');
      }

      try {
        const res = await fetch(`${API_BASE}/api/scheduler/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size, max_parallel_agents, run_basic, run_contact, run_social, run_leader })
        });
        if (res.ok) {
          const resData = await res.json();
          saveSchedConfigBtn.textContent = 'Saved! ✓';
          saveSchedConfigBtn.style.background = '#22c55e';
          setTimeout(() => {
            saveSchedConfigBtn.textContent = 'Save Configuration';
            saveSchedConfigBtn.style.background = '';
          }, 2000);
          await fetchStatus();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Global triggers
  window.splitBatch = async (cityId) => {
    const size = prompt("Enter target company batch limit per agent execution:", "300");
    if (size) {
      try {
        const res = await fetch(`${API_BASE}/api/scheduler/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city_id: cityId, batch_size: size })
        });
        if (res.ok) fetchStatus();
      } catch (err) {
        console.error(err);
      }
    }
  };

  window.deleteCity = async (cityId) => {
    if (confirm('Delete city from queue?')) {
      try {
        await fetch(`${API_BASE}/api/queue/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city_id: cityId })
        });
        fetchStatus();
      } catch (err) {
        console.error(err);
      }
    }
  };

  window.retryError = async (execId, city, portalId, agentName) => {
    try {
      const res = await fetch(`${API_BASE}/api/errors/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execution_id: execId, city, portal_id: portalId, agent_name: agentName })
      });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  window.resumeError = async (execId, city, portalId, agentName) => {
    try {
      const res = await fetch(`${API_BASE}/api/errors/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execution_id: execId, city, portal_id: portalId, agent_name: agentName })
      });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  window.reassignError = async (execId, city) => {
    const newAgent = prompt("Enter Agent Name to reassign this batch to:");
    if (newAgent) {
      try {
        const res = await fetch(`${API_BASE}/api/errors/reassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ execution_id: execId, city, new_agent_name: newAgent })
        });
        if (res.ok) fetchStatus();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all states?')) {
        try {
          await fetch(`${API_BASE}/api/queue/reset`, { method: 'POST' });
          fetchStatus();
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  // ================= API Key Manager Frontend Integration =================
  let apiKeyProvidersList = [];

  const apiKeyProviderSelect = document.getElementById('apiKeyProviderSelect');
  const apiKeyModelSelect = document.getElementById('apiKeyModelSelect');
  const apiKeyValueInput = document.getElementById('apiKeyValueInput');
  const apiKeyTypeBadge = document.getElementById('apiKeyTypeBadge');
  const apiKeyForm = document.getElementById('apiKeyForm');
  const apiKeyAlertMsg = document.getElementById('apiKeyAlertMsg');
  const apiKeyTableBody = document.getElementById('apiKeyTableBody');

  async function fetchApiKeyProviders() {
    if (!apiKeyProviderSelect) return;
    try {
      const res = await fetch(`${API_BASE}/api/apikey-manager/providers`);
      if (res.ok) {
        apiKeyProvidersList = await res.json();
        apiKeyProviderSelect.innerHTML = '<option value="">Select Provider</option>';

        const textProviders = apiKeyProvidersList.filter(p => p.PROVIDER_TYPE !== 'TEXT-TO-IMAGE');
        const imgProviders = apiKeyProvidersList.filter(p => p.PROVIDER_TYPE === 'TEXT-TO-IMAGE');

        if (textProviders.length > 0) {
          const group = document.createElement('optgroup');
          group.label = '💬 Text Generation';
          textProviders.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.PROVIDER_VALUE;
            opt.textContent = p.PROVIDER_LABEL;
            group.appendChild(opt);
          });
          apiKeyProviderSelect.appendChild(group);
        }

        if (imgProviders.length > 0) {
          const group = document.createElement('optgroup');
          group.label = '🖼️ Image Generation';
          imgProviders.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.PROVIDER_VALUE;
            opt.textContent = p.PROVIDER_LABEL;
            group.appendChild(opt);
          });
          apiKeyProviderSelect.appendChild(group);
        }
      }
    } catch (err) {
      console.error('[APIKEY] Failed to fetch providers:', err);
    }
  }

  async function fetchApiKeyModels(provider) {
    if (!apiKeyModelSelect) return;
    if (!provider) {
      apiKeyModelSelect.innerHTML = '<option value="">Select Provider First</option>';
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/apikey-manager/models?provider=${encodeURIComponent(provider)}`);
      if (res.ok) {
        const models = await res.json();
        if (models.length > 0) {
          apiKeyModelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
        } else {
          apiKeyModelSelect.innerHTML = '<option value="default">default</option>';
        }
      }
    } catch (err) {
      console.error('[APIKEY] Failed to fetch models:', err);
    }
  }

  async function fetchApiKeyList() {
    if (!apiKeyTableBody) return;
    try {
      const res = await fetch(`${API_BASE}/api/apikey-manager/list`);
      if (res.ok) {
        const keys = await res.json();
        if (!keys || keys.length === 0) {
          apiKeyTableBody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">
                No API Keys configured yet. Add your first LLM API key above.
              </td>
            </tr>`;
        } else {
          apiKeyTableBody.innerHTML = keys.map(item => {
            const isText = item.LLM_PROVIDER_TYPE !== 'TEXT-TO-IMAGE';
            const typeBadge = isText 
              ? '<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">💬 Text</span>' 
              : '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">🖼️ Image</span>';

            const statusClass = item.STATUS === 'ACTIVE' ? 'badge-completed' : 'badge-pending';
            const statusLabel = item.STATUS === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';

            const blockedClass = item.BLOCKED === 'YES' ? 'badge-failed' : 'badge-completed';
            const blockedLabel = item.BLOCKED === 'YES' ? 'BLOCKED' : 'NO';

            const maskedKey = item.API_KEY ? (item.API_KEY.length > 12 ? item.API_KEY.substr(0, 4) + '...' + item.API_KEY.substr(-4) : '••••••••') : '(Optional / None)';

            return `
              <tr style="background: rgba(30, 41, 59, 0.5); border-radius: 8px;">
                <td style="padding: 14px 16px; font-weight: 700; color: #f8fafc;">${item.LLM_PROVIDER}</td>
                <td style="padding: 14px 16px; font-family: var(--font-mono); font-size: 0.85rem; color: #cbd5e1;">${item.MODEL_NAME || '-'}</td>
                <td style="padding: 14px 16px;">${typeBadge}</td>
                <td style="padding: 14px 16px; font-family: var(--font-mono); font-size: 0.85rem; color: #94a3b8;">${maskedKey}</td>
                <td style="padding: 14px 16px; text-align: center;">
                  <button class="badge ${statusClass}" style="cursor: pointer; border: none;" onclick="toggleApiKeyStatus(${item.ID})">${statusLabel}</button>
                </td>
                <td style="padding: 14px 16px; text-align: center;">
                  <button class="badge ${blockedClass}" style="cursor: pointer; border: none;" onclick="toggleApiKeyBlocked(${item.ID})">${blockedLabel}</button>
                </td>
                <td style="padding: 14px 16px; text-align: right;">
                  <button class="btn btn-secondary btn-sm" style="color: var(--color-error); border-radius: 6px;" onclick="deleteApiKeyItem(${item.ID})">Delete</button>
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.error('[APIKEY] Failed to fetch API key list:', err);
    }
  }

  if (apiKeyProviderSelect) {
    apiKeyProviderSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      fetchApiKeyModels(val);
      const selected = apiKeyProvidersList.find(p => p.PROVIDER_VALUE === val);
      if (selected && apiKeyTypeBadge) {
        apiKeyTypeBadge.innerHTML = selected.PROVIDER_TYPE === 'TEXT-TO-IMAGE'
          ? 'Type: 🖼️ Image Generation'
          : 'Type: 💬 Text Generation';
      }
    });
  }

  if (apiKeyForm) {
    apiKeyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const provider = apiKeyProviderSelect.value;
      const model = apiKeyModelSelect.value;
      const key = apiKeyValueInput.value;

      if (!provider) {
        if (apiKeyAlertMsg) {
          apiKeyAlertMsg.style.display = 'block';
          apiKeyAlertMsg.style.background = 'rgba(239, 68, 68, 0.2)';
          apiKeyAlertMsg.style.color = '#f87171';
          apiKeyAlertMsg.textContent = 'Please select an LLM Provider.';
        }
        return;
      }

      const selected = apiKeyProvidersList.find(p => p.PROVIDER_VALUE === provider);
      const providerType = selected ? selected.PROVIDER_TYPE : 'TEXT-TO-TEXT';

      try {
        const res = await fetch(`${API_BASE}/api/apikey-manager/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            LLM_PROVIDER: provider,
            MODEL_NAME: model,
            API_KEY: key,
            LLM_PROVIDER_TYPE: providerType
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (apiKeyAlertMsg) {
            apiKeyAlertMsg.style.display = 'block';
            apiKeyAlertMsg.style.background = 'rgba(34, 197, 94, 0.2)';
            apiKeyAlertMsg.style.color = '#4ade80';
            apiKeyAlertMsg.textContent = 'API Key added successfully! ✓';
          }
          apiKeyValueInput.value = '';
          fetchApiKeyList();
          setTimeout(() => { if (apiKeyAlertMsg) apiKeyAlertMsg.style.display = 'none'; }, 3000);
        } else {
          if (apiKeyAlertMsg) {
            apiKeyAlertMsg.style.display = 'block';
            apiKeyAlertMsg.style.background = 'rgba(239, 68, 68, 0.2)';
            apiKeyAlertMsg.style.color = '#f87171';
            apiKeyAlertMsg.textContent = data.message || 'Failed to add API key.';
          }
        }
      } catch (err) {
        console.error('[APIKEY] Add error:', err);
      }
    });
  }

  window.toggleApiKeyStatus = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/apikey-manager/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) fetchApiKeyList();
    } catch (err) {
      console.error(err);
    }
  };

  window.toggleApiKeyBlocked = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/apikey-manager/toggle-blocked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) fetchApiKeyList();
    } catch (err) {
      console.error(err);
    }
  };

  window.deleteApiKeyItem = async (id) => {
    if (confirm('Are you sure you want to delete this API Key?')) {
      try {
        const res = await fetch(`${API_BASE}/api/apikey-manager/delete/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) fetchApiKeyList();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Init API Key Manager on load
  fetchApiKeyProviders();
  fetchApiKeyList();

  // Polling
  fetchStatus();
  setInterval(fetchStatus, 5000);
});
