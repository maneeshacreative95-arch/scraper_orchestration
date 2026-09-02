
import React, { useState, useEffect, useMemo } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import "./ApiKeyDetailsTable.css";

const ApiKeyDetailsTable = ({ onActivate, fetchLLMDetails, llmDetails = [], lastAddedProvider = null }) => {

    const [filterProvider, setFilterProvider] = useState("ALL");
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [providerDetails, setProviderDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const userid = Cookies.get("userid");
    const firmid = Cookies.get("firmid");

    // Utility function to format date
    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
    };

    // Get unique providers from llmDetails for dropdown
    const uniqueProviders = useMemo(() => {
        const providers = [...new Set(llmDetails.map(item => item.LLM_PROVIDER))];
        return providers.filter(Boolean).sort();
    }, [llmDetails]);

    // Filter data based on selected provider
    const filteredDetails = useMemo(() => {
        if (filterProvider === "ALL") {
            return llmDetails;
        }
        return llmDetails.filter(item => item.LLM_PROVIDER === filterProvider);
    }, [llmDetails, filterProvider]);

    // Auto-select the newly added provider when a key is added
    useEffect(() => {
        if (lastAddedProvider && uniqueProviders.includes(lastAddedProvider)) {
            setFilterProvider(lastAddedProvider);
        }
    }, [lastAddedProvider, uniqueProviders]);

    console.log("llmDetails", llmDetails)
    console.log("llmDetails", llmDetails, Array.isArray(llmDetails));
    console.log("filteredDetails", filteredDetails);




    const toggleStatus = async (id, provider) => {
        try {
            const response = await axios.post("/api/apikey-manager/toggle-status", {
                id,
                userid,
                firmid,
            });

            if (response.data.success) {
                fetchLLMDetails(); // Refresh the table after updating status
                // onSelectProvider(provider); // Pass selected provider to parent
                onActivate(provider);
            }
        } catch (err) {
            alert("Failed to update status.");
        }
    };

    const fetchProviderDetails = async (provider) => {
        setLoading(true);
        setError("");
        setSelectedProvider(provider);

        try {
            const response = await axios.get("/api/apikey-manager/list", {
                params: { provider },
            });
            setProviderDetails(response.data);
        } catch (err) {
            setError("Failed to fetch data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // if (loading) return <p>Loading...</p>;
    // if (error) return <p>{error}</p>;

    return (
        <div className="apikey-details-wrapper">
            <h1 className="apikey-details-title">API Key Details</h1>

            {/* Provider Filter Dropdown */}
            <div className="filter-container">
                <label htmlFor="provider-filter" className="filter-label">
                    Filter by Provider:
                </label>
                <select
                    id="provider-filter"
                    className="filter-select"
                    value={filterProvider}
                    onChange={(e) => setFilterProvider(e.target.value)}
                >
                    <option value="ALL">All Providers</option>
                    {uniqueProviders.map((provider) => (
                        <option key={provider} value={provider}>
                            {provider}
                        </option>
                    ))}
                </select>
                {filterProvider !== "ALL" && (
                    <span className="filter-count">
                        Showing {filteredDetails.length} of {llmDetails.length} keys
                    </span>
                )}
            </div>

            <table className="apikey-details-table">
                <thead>
                    <tr>
                        <th>LLM Provider</th>
                        <th>API Key</th>
                        <th>Insert Date</th>
                        <th>Update Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredDetails.length > 0 ? (
                        filteredDetails.map((detail) => (
                            <tr key={detail.ID}>
                                <td
                                    className="provider-link"
                                    onClick={() => fetchProviderDetails(detail.LLM_PROVIDER)}
                                >
                                    {detail.LLM_PROVIDER}
                                </td>
                                <td>{detail.API_KEY}</td>
                                <td>{formatDate(detail.INSRT_DTM)}</td>
                                <td>{formatDate(detail.UPD_DTM)}</td>
                                <td>
                                    {detail.STATUS === "ACTIVE" ? (
                                        <button
                                            className="disable-btn"
                                            onClick={() => toggleStatus(detail.ID, detail.LLM_PROVIDER)}
                                        >
                                            Disable
                                        </button>
                                    ) : (
                                        <button
                                            className="enable-btn"
                                            onClick={() => toggleStatus(detail.ID, detail.LLM_PROVIDER)}
                                        >
                                            Enable
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" className="no-data">
                                {filterProvider !== "ALL"
                                    ? `No API keys found for ${filterProvider}.`
                                    : "No data found."
                                }
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {selectedProvider && (
                <div className="provider-details-panel">
                    <h3>Details for: {selectedProvider}</h3>
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p className="error-text">{error}</p>
                    ) : providerDetails ? (
                        <pre>{JSON.stringify(providerDetails, null, 2)}</pre>
                    ) : (
                        <p>No details found.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ApiKeyDetailsTable;
