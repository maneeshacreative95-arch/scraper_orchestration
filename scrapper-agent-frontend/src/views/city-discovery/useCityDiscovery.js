import { useState } from 'react';
import { apiFetch } from '../../api/config';
import { getAuthContext } from '../../utils/auth';

export function useCityDiscovery(onRefreshStatus) {
  const [promptInput, setPromptInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [validationResults, setValidationResults] = useState([]);
  const [selectedPortals, setSelectedPortals] = useState({});
  const [assignToOtherUser, setAssignToOtherUser] = useState(false);
  const [selectedAgentEmpId, setSelectedAgentEmpId] = useState('');
  const [isAddingToProcessing, setIsAddingToProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [llmInfo, setLlmInfo] = useState({ provider: 'GROQ', model: 'openai/gpt-oss-20b' });

  // Password prompt state for cross-user assignment
  const [pendingAssignPrompt, setPendingAssignPrompt] = useState({ isOpen: false, targetEmpId: null });

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!promptInput.trim()) return;

    setIsSearching(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await apiFetch('/api/orchestrate/full-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptInput })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setValidationResults(data.validation || []);
        setSelectedPortals({});
        setStatusMessage(`Successfully discovered ${data.validation?.length || 0} location portal records.`);
        if (data.llm_info) setLlmInfo(data.llm_info);
      } else {
        setErrorMessage(data.error || 'Failed to execute region discovery search.');
      }
    } catch (err) {
      setErrorMessage(`Server communication error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleExpandSearchWithAI = async () => {
    if (!promptInput.trim()) return;
    setIsExpanding(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const existingCities = validationResults.map((r) => r.city).filter(Boolean);

      const res = await apiFetch('/api/orchestrate/full-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptInput,
          force_llm: true,
          existing_cities: existingCities
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const newResults = data.validation || [];
        if (newResults.length === 0) {
          setStatusMessage('AI expansion completed, but no additional missing cities were found.');
        } else {
          setValidationResults((prev) => {
            const existingKeys = new Set(prev.map((item) => (item.portal_id ? String(item.portal_id) : item.city?.toLowerCase())));
            const filteredNew = newResults.filter((item) => {
              const key = item.portal_id ? String(item.portal_id) : item.city?.toLowerCase();
              return !existingKeys.has(key);
            });
            return [...prev, ...filteredNew];
          });
          setStatusMessage(`AI expansion discovered ${newResults.length} location portal records.`);
        }
        if (data.llm_info) setLlmInfo(data.llm_info);
      } else {
        setErrorMessage(data.error || 'Failed to expand search with AI.');
      }
    } catch (err) {
      setErrorMessage(`Server communication error: ${err.message}`);
    } finally {
      setIsExpanding(false);
    }
  };

  const handleSelectAll = (checked) => {
    const updated = {};
    validationResults.forEach((item, idx) => {
      if (!item.already_in_processing) {
        updated[idx] = checked;
      }
    });
    setSelectedPortals(updated);
  };

  const isAllSelected = () => {
    const selectableIndices = validationResults
      .map((item, idx) => (!item.already_in_processing ? idx : null))
      .filter((i) => i !== null);

    if (selectableIndices.length === 0) return false;
    return selectableIndices.every((idx) => selectedPortals[idx]);
  };

  const handleToggleItem = (idx, checked) => {
    setSelectedPortals((prev) => ({ ...prev, [idx]: checked }));
  };

  const handleAddToProcessing = async (superadminPassword = null) => {
    const selectedIndices = Object.keys(selectedPortals).filter((k) => selectedPortals[k]);
    if (selectedIndices.length === 0) {
      alert('Please select at least one portal checkbox to add to SCRAPPER_PROCESSING.');
      return;
    }

    if (assignToOtherUser && !selectedAgentEmpId) {
      alert('Please select an agent from the Agent Registry dropdown before adding to SCRAPPER_PROCESSING.');
      return;
    }

    const { userId } = getAuthContext();
    const currentUserId = String(userId || '919').trim();
    const isAssigningToOther = assignToOtherUser && selectedAgentEmpId && String(selectedAgentEmpId).trim() !== currentUserId;

    if (isAssigningToOther && !superadminPassword) {
      setPendingAssignPrompt({
        isOpen: true,
        targetEmpId: selectedAgentEmpId
      });
      return;
    }

    const itemsToAdd = selectedIndices.map((idx) => {
      const item = validationResults[idx];
      return {
        portal_id: item.portal_id,
        city: item.city,
        state: item.state
      };
    });

    setIsAddingToProcessing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const payload = { items: itemsToAdd };
      if (assignToOtherUser && selectedAgentEmpId) {
        payload.target_emp_id = selectedAgentEmpId;
      }
      if (superadminPassword) {
        payload.superadmin_password = superadminPassword;
      }

      const res = await apiFetch('/api/orchestrate/add-to-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage(data.message);
        setValidationResults((prev) =>
          prev.map((item, idx) => {
            if (selectedPortals[idx]) {
              return {
                ...item,
                status: 'Added to Processing',
                just_added: true,
                already_in_processing: true
              };
            }
            return item;
          })
        );
        setSelectedPortals({});
        setPendingAssignPrompt({ isOpen: false, targetEmpId: null });
        if (onRefreshStatus) onRefreshStatus();
      } else {
        const errText = data.error || 'Failed to add selected portals to SCRAPPER_PROCESSING.';
        setErrorMessage(errText);
        if (superadminPassword) {
          throw new Error(errText);
        }
      }
    } catch (err) {
      setErrorMessage(`Error adding to processing: ${err.message}`);
      if (superadminPassword) {
        throw err;
      }
    } finally {
      setIsAddingToProcessing(false);
    }
  };

  return {
    promptInput,
    setPromptInput,
    isSearching,
    isExpanding,
    validationResults,
    selectedPortals,
    assignToOtherUser,
    setAssignToOtherUser,
    selectedAgentEmpId,
    setSelectedAgentEmpId,
    isAddingToProcessing,
    statusMessage,
    errorMessage,
    llmInfo,
    pendingAssignPrompt,
    setPendingAssignPrompt,
    handleSearch,
    handleExpandSearchWithAI,
    handleSelectAll,
    isAllSelected,
    handleToggleItem,
    handleAddToProcessing
  };
}
