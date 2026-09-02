import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import ApiKeyDetailsTable from "./ApiKeyDetailsTable";
import "./ApiKeyManager.css";

// Removed hardcoded llmProviders array

const AddApiKey = ({ onProviderSelect }) => {
  const [apiKey, setApiKey] = useState("");
  const [llmProvider, setLlmProvider] = useState("");
  const [llmProviderType, setLlmProviderType] = useState("TEXT-TO-TEXT");
  const [modelName, setModelName] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [providersList, setProvidersList] = useState([]); // State for dynamic providers
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastAddedProvider, setLastAddedProvider] = useState(null);

  const userid = Cookies.get("userid");
  const firmid = Cookies.get("firmid");
  const [llmDetails, setLlmDetails] = useState([]);
  const navigate = useNavigate();

  const isMyBlocksServer = llmProvider && llmProvider.startsWith('MYBLOCKS_SERVERS');

  useEffect(() => {
    const usertype = Cookies.get("usertype");
    if (!userid) {
      alert("Please login");
      navigate("/login");
    } else if (usertype === "USERAPP") {
      alert("Login with Business User Credentials");
      navigate("/login");
    }
  }, [navigate, userid]);

  useEffect(() => {
    fetchLLMDetails();
    fetchProviders(); // Fetch providers on load
  }, []);

  // Fetch providers from backend
  const fetchProviders = async () => {
    try {
      const response = await axios.get("/api/apikey-manager/providers");
      setProvidersList(response.data);
    } catch (err) {
      console.error("Failed to fetch providers:", err);
      setError("Failed to load providers.");
    }
  };

  // Fetch models when provider changes
  useEffect(() => {
    if (llmProvider) {
      fetchModelsForProvider(llmProvider);
      // Set provider type based on selection
      const selectedProvider = providersList.find(p => p.PROVIDER_VALUE === llmProvider);
      if (selectedProvider) {
        setLlmProviderType(selectedProvider.PROVIDER_TYPE);
      }
    } else {
      setAvailableModels([]);
      setModelName("");
    }
  }, [llmProvider, providersList]);

  const fetchModelsForProvider = async (provider) => {
    try {
      const response = await axios.get("/api/apikey-manager/models", {
        params: { provider }
      });
      setAvailableModels(response.data);
      if (response.data.length > 0) {
        setModelName(response.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch models:", err);
      setAvailableModels([]);
    }
  };

  const fetchLLMDetails = async () => {
    if (!userid || !firmid) {
      setError("USERID and FIRMID cookies are missing.");
      return;
    }
    try {
      const response = await axios.get("/api/apikey-manager/list", {
        params: { userid, firmid },
      });
      setLlmDetails(response.data);
    } catch (err) {
      setError("Failed to fetch data. Please try again.");
    }
  };

  const handleActivate = (provider) => {
    if (typeof onProviderSelect === 'function') {
      onProviderSelect(provider);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this API key?")) return;

    try {
      await axios.delete(`/api/apikey-manager/delete/${id}`, {
        params: { userid, firmid }
      });
      setMessage("API Key deleted successfully!");
      fetchLLMDetails();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError("Failed to delete API key.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!llmProvider) {
      setError("Provider is required.");
      setMessage(null);
      return;
    }

    // API key is only required for non-MYBLOCKS_SERVERS providers
    if (!isMyBlocksServer && !apiKey) {
      setError("API Key is required for this provider.");
      setMessage(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Submitting API Key:", {
        USERID: userid,
        FIRMID: firmid,
        LLM_PROVIDER: llmProvider,
        MODEL_NAME: modelName
      });

      const response = await axios.post("/api/apikey-manager/add", {
        USERID: userid,
        FIRMID: firmid,
        LLM_PROVIDER: llmProvider,
        LLM_PROVIDER_TYPE: llmProviderType,
        MODEL_NAME: modelName,
        API_KEY: apiKey || '', // Send empty string if not provided
      });

      console.log("API Response:", response.data);

      if (response.data.success) {
        setMessage("API Key added successfully!");
        setError(null);

        // Set the last added provider so the dropdown auto-selects it
        setLastAddedProvider(llmProvider);

        // Reset form
        setApiKey("");
        setLlmProvider("");
        setModelName("");

        fetchLLMDetails();
        handleActivate(llmProvider);

        setTimeout(() => setMessage(null), 3000);
      } else {
        setError(response.data.message || "Failed to add API Key.");
      }
    } catch (err) {
      console.error("Error adding API Key:", err);
      console.error("Error response:", err.response);

      // Show more detailed error message
      let errorMessage = "Error adding API Key.";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.details) {
        errorMessage = `Error: ${err.response.data.details}`;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = `Network Error: ${err.message}`;
      }

      setError(errorMessage);
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="apikey-page-wrapper">
      <div className="apikey-container">
        <div className="apikey-header">
          <div className="apikey-header-icon">🔐</div>
          <div className="apikey-header-content">
            <h1>API Key Manager</h1>
            <p>Securely manage your LLM provider credentials</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit} className="apikey-form">
          <div className="form-row">
            <div className="form-group">
              <label>LLM Provider *</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="form-select"
              >
                <option value="">Select Provider</option>

                {/* Text Generation Providers */}
                {providersList.some(p => p.PROVIDER_TYPE !== "TEXT-TO-IMAGE") && (
                  <optgroup label="💬 Text Generation">
                    {providersList
                      .filter(p => p.PROVIDER_TYPE !== "TEXT-TO-IMAGE")
                      .map((provider) => (
                        <option key={provider.PROVIDER_VALUE} value={provider.PROVIDER_VALUE}>
                          {provider.PROVIDER_LABEL}
                        </option>
                      ))}
                  </optgroup>
                )}

                {/* Image Generation Providers */}
                {providersList.some(p => p.PROVIDER_TYPE === "TEXT-TO-IMAGE") && (
                  <optgroup label="🖼️ Image Generation">
                    {providersList
                      .filter(p => p.PROVIDER_TYPE === "TEXT-TO-IMAGE")
                      .map((provider) => (
                        <option key={provider.PROVIDER_VALUE} value={provider.PROVIDER_VALUE}>
                          {provider.PROVIDER_LABEL}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {availableModels.length > 0 && (
              <div className="form-group">
                <label>Model Name *</label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="form-select"
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>



          <div className="form-group full-width">
            <label>API Key {isMyBlocksServer ? '(Optional)' : '*'}</label>
            <input
              type="password"
              placeholder={isMyBlocksServer ? "API Key is optional for MyBlocks Servers" : "Enter your API Key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="form-input"
            />
          </div>



          <div className="form-group full-width">
            <span className="provider-type-badge">
              Type: {llmProviderType === "TEXT-TO-IMAGE" ? "🖼️ Image Generation" : "💬 Text Generation"}
            </span>
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? "Adding..." : "➕ Add API Key"}
          </button>
        </form>

        <ApiKeyDetailsTable
          onActivate={handleActivate}
          fetchLLMDetails={fetchLLMDetails}
          llmDetails={llmDetails}
          onDelete={handleDelete}
          lastAddedProvider={lastAddedProvider}
        />
      </div>
    </div>
  );
};

export default AddApiKey;
