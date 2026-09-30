import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../api/config';
import { getAuthContext } from '../utils/auth';
import Checkbox from '../components/Checkbox';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Save,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Filter,
  Globe,
  Sparkles,
  Tag
} from 'lucide-react';

export default function CategorySelection() {
  const { userId } = getAuthContext();
  const empId = userId || '919';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [groupedCategories, setGroupedCategories] = useState({});
  const [mainCategories, setMainCategories] = useState([]);

  // 'ALL' or 'CUSTOM'
  const [mode, setMode] = useState('ALL');
  const [selectedSubCats, setSelectedSubCats] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMains, setExpandedMains] = useState(new Set());

  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch all categories and user's saved preferences
  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Load all categories from KF_CATEGORY
      const catRes = await apiFetch('/api/categories');
      const catData = await catRes.json();

      if (!catRes.ok || !catData.success) {
        throw new Error(catData.error || 'Failed to load categories from KF_CATEGORY.');
      }

      setAllCategories(catData.categories || []);
      setGroupedCategories(catData.grouped || {});
      setMainCategories(catData.main_categories || []);

      // Auto-expand first 3 main categories
      if (catData.main_categories && catData.main_categories.length > 0) {
        setExpandedMains(new Set(catData.main_categories.slice(0, 3)));
      }

      // 2. Load user's saved category preferences from SCRAPPER_TASK_CATEGORIES
      const userRes = await apiFetch(`/api/user-categories?emp_id=${encodeURIComponent(empId)}`);
      const userData = await userRes.json();

      if (userRes.ok && userData.success) {
        if (userData.mode === 'CUSTOM' && Array.isArray(userData.selected_categories) && userData.selected_categories.length > 0) {
          setMode('CUSTOM');
          setSelectedSubCats(new Set(userData.selected_categories));
        } else {
          setMode('ALL');
          setSelectedSubCats(new Set());
        }
      }
    } catch (err) {
      console.error('[CATEGORY VIEW LOAD ERROR]', err);
      setErrorMessage(err.message || 'Error loading category data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [empId]);

  // Filtered categories based on search
  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedCategories;
    }
    const q = searchQuery.toLowerCase().trim();
    const result = {};

    for (const main of mainCategories) {
      const items = groupedCategories[main] || [];
      const matchingItems = items.filter(
        (it) =>
          it.sub_category.toLowerCase().includes(q) ||
          (it.main_category && it.main_category.toLowerCase().includes(q))
      );
      if (matchingItems.length > 0) {
        result[main] = matchingItems;
      }
    }
    return result;
  }, [groupedCategories, mainCategories, searchQuery]);

  // When search changes, expand matching groups automatically
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedMains(new Set(Object.keys(filteredGrouped)));
    }
  }, [searchQuery, filteredGrouped]);

  const toggleMainExpand = (main) => {
    setExpandedMains((prev) => {
      const next = new Set(prev);
      if (next.has(main)) {
        next.delete(main);
      } else {
        next.add(main);
      }
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedMains(new Set(mainCategories));
  };

  const collapseAllGroups = () => {
    setExpandedMains(new Set());
  };

  // Toggle single subcategory
  const handleToggleSubCategory = (subCatName) => {
    setSelectedSubCats((prev) => {
      const next = new Set(prev);
      if (next.has(subCatName)) {
        next.delete(subCatName);
      } else {
        next.add(subCatName);
      }
      return next;
    });
  };

  // Toggle all in a main category
  const handleToggleMainCategory = (main) => {
    const items = groupedCategories[main] || [];
    const itemNames = items.map((i) => i.sub_category);
    const allSelected = itemNames.every((name) => selectedSubCats.has(name));

    setSelectedSubCats((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        itemNames.forEach((name) => next.delete(name));
      } else {
        itemNames.forEach((name) => next.add(name));
      }
      return next;
    });
  };

  // Select all visible / filtered
  const handleSelectAllFiltered = () => {
    const next = new Set(selectedSubCats);
    for (const main of Object.keys(filteredGrouped)) {
      for (const item of filteredGrouped[main]) {
        next.add(item.sub_category);
      }
    }
    setSelectedSubCats(next);
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedSubCats(new Set());
  };

  // Save preferences to server
  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      let payload;
      if (mode === 'ALL') {
        payload = {
          mode: 'ALL',
          emp_id: empId,
          categories: []
        };
      } else {
        if (selectedSubCats.size === 0) {
          throw new Error('Please select at least one sub-category, or switch to "Scrape All Categories".');
        }

        // Map subcategories with their parent main_category and id
        const catsPayload = [];
        for (const subCat of selectedSubCats) {
          const match = allCategories.find((c) => c.sub_category === subCat);
          catsPayload.push({
            sub_category: subCat,
            main_category: match?.main_category || null,
            category_id: match?.id || null
          });
        }

        payload = {
          mode: 'CUSTOM',
          emp_id: empId,
          categories: catsPayload
        };
      }

      const res = await apiFetch('/api/user-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage(
          mode === 'ALL'
            ? 'Success: Scraping mode set to ALL categories. All future scraper runs will scrape all 310 categories.'
            : `Success: Saved ${data.count || selectedSubCats.size} category preference(s)! Your runner agents will now scrape ONLY these categories and bypass the rest.`
        );
      } else {
        throw new Error(data.error || 'Failed to save category preferences.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error saving category preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* Top Banner / Header */}
      <div className="panel-card" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                <Layers size={22} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.02em' }}>
                Category Selection Manager
              </h2>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', maxWidth: '780px', lineHeight: 1.5 }}>
              Configure which categories from <strong style={{ color: '#93c5fd' }}>KF_CATEGORY</strong> your scraper agents will process.
              Your preferences are permanently saved in <code style={{ color: '#38bdf8', background: 'rgba(15, 23, 42, 0.8)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.82rem' }}>SCRAPPER_TASK_CATEGORIES</code> for User <strong style={{ color: '#f3f4f6' }}>{empId}</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={loadData}
              disabled={isLoading || isSaving}
              className="btn btn-secondary btn-sm"
              title="Refresh categories"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontWeight: '600', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)' }}
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total In Database</span>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ffffff', marginTop: '4px' }}>
              {allCategories.length || 310} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>categories</span>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Main Industries</span>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#a78bfa', marginTop: '4px' }}>
              {mainCategories.length || 0} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>groups</span>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Active Mode</span>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: mode === 'ALL' ? '#38bdf8' : '#34d399', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {mode === 'ALL' ? <Globe size={16} /> : <Tag size={16} />}
              <span>{mode === 'ALL' ? 'Scrape All Categories' : `${selectedSubCats.size} Selected Categories`}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Assigned Account</span>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f3f4f6', marginTop: '4px' }}>
              Employee ID: <span style={{ color: '#fbbf24' }}>{empId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {statusMessage && (
        <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '14px 20px', borderRadius: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.92rem' }}>
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '14px 20px', borderRadius: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.92rem' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mode Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Card 1: All Categories */}
        <div
          onClick={() => setMode('ALL')}
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            border: mode === 'ALL' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
            background: mode === 'ALL' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(15, 23, 42, 0.6)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: mode === 'ALL' ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: mode === 'ALL' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <Globe size={18} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: mode === 'ALL' ? '#93c5fd' : '#ffffff' }}>
                  Scrape All Categories
                </h3>
              </div>
              <input
                type="radio"
                name="category_mode"
                checked={mode === 'ALL'}
                onChange={() => setMode('ALL')}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Standard exhaustive crawling. Scrapes all <strong>{allCategories.length || 310}</strong> active categories in <code style={{ color: '#93c5fd' }}>KF_CATEGORY</code> one after another for every city in your queue.
            </p>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '500' }}>
            ✓ Default system behavior • Deep coverage
          </div>
        </div>

        {/* Card 2: Custom Selection */}
        <div
          onClick={() => setMode('CUSTOM')}
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            border: mode === 'CUSTOM' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
            background: mode === 'CUSTOM' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.6)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: mode === 'CUSTOM' ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: mode === 'CUSTOM' ? '#10b981' : 'rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <Sparkles size={18} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: mode === 'CUSTOM' ? '#6ee7b7' : '#ffffff' }}>
                  Custom Selected Categories
                </h3>
              </div>
              <input
                type="radio"
                name="category_mode"
                checked={mode === 'CUSTOM'}
                onChange={() => setMode('CUSTOM')}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Choose specific sub-categories below. The scraper will <strong>bypass the rest</strong> and only crawl your selected categories, completing tasks much faster.
            </p>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: '500' }}>
            ✓ Targeted scraping • High speed • Low runtime
          </div>
        </div>
      </div>

      {/* Custom Category Browser (Visible when in CUSTOM mode or always as reference) */}
      <div className="panel-card" style={{ opacity: mode === 'ALL' ? 0.7 : 1, transition: 'opacity 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} style={{ color: '#60a5fa' }} />
              <span>Available Categories in KF_CATEGORY</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {mode === 'CUSTOM'
                ? `Select the categories you want to crawl (${selectedSubCats.size} selected).`
                : 'Showing all categories (Switch to "Custom Selected Categories" above to filter).'}
            </p>
          </div>

          {/* Quick Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {mode === 'CUSTOM' && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSelectAllFiltered}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckSquare size={14} />
                  <span>Select All Filtered</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAll}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Square size={14} />
                  <span>Clear All</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={expandAllGroups}
              style={{ fontSize: '0.8rem' }}
            >
              Expand All
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={collapseAllGroups}
              style={{ fontSize: '0.8rem' }}
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search categories (e.g. Hospital, Restaurant, Travel, Real Estate, Dental...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 46px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#ffffff',
              fontSize: '0.95rem',
              outline: 'none',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
            <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 12px' }} />
            <p>Loading KF_CATEGORY and user preferences...</p>
          </div>
        )}

        {/* Categories Groups List */}
        {!isLoading && Object.keys(filteredGrouped).length === 0 && (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', color: 'var(--color-text-muted)' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px', color: '#f59e0b' }} />
            <p>No categories found matching &quot;{searchQuery}&quot;.</p>
          </div>
        )}

        {!isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.keys(filteredGrouped).map((main) => {
              const items = filteredGrouped[main] || [];
              const isExpanded = expandedMains.has(main);
              const selectedCountInGroup = items.filter((it) => selectedSubCats.has(it.sub_category)).length;
              const allInGroupSelected = items.length > 0 && selectedCountInGroup === items.length;

              return (
                <div
                  key={main}
                  style={{
                    borderRadius: '12px',
                    border: selectedCountInGroup > 0 ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(15, 23, 42, 0.55)',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  {/* Group Header */}
                  <div
                    onClick={() => toggleMainExpand(main)}
                    style={{
                      padding: '12px 18px',
                      background: selectedCountInGroup > 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 41, 59, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isExpanded ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} color="#94a3b8" />}
                      <span style={{ fontWeight: '600', fontSize: '0.98rem', color: '#ffffff' }}>{main}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          background: selectedCountInGroup > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          color: selectedCountInGroup > 0 ? '#34d399' : '#94a3b8',
                          fontWeight: '600'
                        }}
                      >
                        {mode === 'CUSTOM'
                          ? `${selectedCountInGroup} / ${items.length} selected`
                          : `${items.length} categories`}
                      </span>
                    </div>

                    {mode === 'CUSTOM' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMainCategory(main);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        {allInGroupSelected ? 'Deselect All' : 'Select Group'}
                      </button>
                    )}
                  </div>

                  {/* Subcategories Grid */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '14px 18px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {items.map((item) => {
                        const isChecked = selectedSubCats.has(item.sub_category);
                        const disabled = mode === 'ALL';

                        return (
                          <div
                            key={item.id || item.sub_category}
                            onClick={() => {
                              if (!disabled) {
                                handleToggleSubCategory(item.sub_category);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                              border: isChecked ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                              cursor: disabled ? 'default' : 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Checkbox
                              checked={mode === 'ALL' || isChecked}
                              disabled={disabled}
                              onChange={() => handleToggleSubCategory(item.sub_category)}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.88rem',
                                  fontWeight: isChecked ? '600' : '400',
                                  color: isChecked ? '#ffffff' : '#cbd5e1',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                                title={item.sub_category}
                              >
                                {item.sub_category}
                              </div>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {item.type || 'VENDOR'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Save Bar */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {mode === 'CUSTOM' ? (
              <span>
                Ready to save <strong style={{ color: '#34d399' }}>{selectedSubCats.size}</strong> category preference(s) to <code style={{ color: '#93c5fd' }}>SCRAPPER_TASK_CATEGORIES</code>.
              </span>
            ) : (
              <span>
                All <strong style={{ color: '#38bdf8' }}>{allCategories.length || 310}</strong> categories are currently enabled.
              </span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontWeight: '600' }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving Preferences...' : 'Save Category Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
