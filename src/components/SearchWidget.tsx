import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from './SearchWidget.module.css';
import { Case } from './CaseResultList';

interface SearchWidgetProps {
  initialQuery?: string;
  onResultsLoaded?: (cases: Case[]) => void;
  onCaseSelect?: (selectedCase: Case) => void;
  onSelectionChange?: (selectedCaseIds: string[]) => void;
  disabled?: boolean;
}

const SearchWidget: React.FC<SearchWidgetProps> = ({ 
  initialQuery = "", 
  onResultsLoaded,
  onCaseSelect,
  onSelectionChange,
  disabled = false
}) => {
  const [results, setResults] = useState<Case[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  
  // Use a ref to track previous selection to prevent infinite loops
  const prevSelectionRef = useRef<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Initialize with initial query if provided
  useEffect(() => {
    if (initialQuery) {
      setInput(initialQuery);
      fetchResults({ append: false });
    }
  }, [initialQuery]);

  // Notify parent component when selected cases change, but only if different
  useEffect(() => {
    if (onSelectionChange) {
      const currentSelection = Array.from(selectedCases);
      const prevSelection = prevSelectionRef.current;
      
      // Check if the selection has actually changed
      const isDifferent = 
        currentSelection.length !== prevSelection.length || 
        currentSelection.some(id => !prevSelection.includes(id));
      
      if (isDifferent) {
        // Update the previous selection ref
        prevSelectionRef.current = currentSelection;
        // Notify parent
        onSelectionChange(currentSelection);
      }
    }
  }, [selectedCases, onSelectionChange]);

  // Fetch search results from API
  const fetchResults = useCallback(
    async ({ append = false, token = null }: { append?: boolean; token?: string | null } = {}) => {
      if (!input.trim()) return;
      setIsLoading(true);

      try {
        // Using the backend's search endpoint
        const res = await fetch("/api/case-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: input,
            pageToken: token,
          }),
        });
        
        const data = await res.json();
        
        // Extract cases from the response
        const cases = data.cases || [];
        
        // Update state with results
        setResults((prev) => (append ? [...prev, ...cases] : cases));
        setTotalResults(data.totalCount || cases.length);
        setPageToken(data.nextPageToken || null);
        setHasMore(!!data.nextPageToken);
        
        // Notify parent component about loaded results
        if (onResultsLoaded) {
          onResultsLoaded(append ? [...results, ...cases] : cases);
        }
      } catch (error) {
        console.error("Error fetching search results:", error);
        if (!append) {
          setResults([]);
          if (onResultsLoaded) onResultsLoaded([]);
        }
        setHasMore(false);
      }
      
      setIsLoading(false);
    },
    [input, results, onResultsLoaded]
  );

  // New search (reset)
  const startNewSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setResults([]);
    setPageToken(null);
    setHasMore(false);
    fetchResults({ append: false });
  };

  // Handle case selection toggle
  const toggleCaseSelection = (result: Case) => {
    if (!disabled) {
      setSelectedCases(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(result.id)) {
          newSelection.delete(result.id);
        } else {
          newSelection.add(result.id);
        }
        return newSelection;
      });
      
      // Also call the single case selection callback if provided
      if (onCaseSelect) {
        onCaseSelect(result);
      }
      
      // Log the selected cases for debugging
      console.log(`Case ${result.id} selection toggled`);
    }
  };

  // Infinite scroll event
  useEffect(() => {
    const onScroll = () => {
      const el = listRef.current;
      if (
        el &&
        hasMore &&
        !isLoading &&
        el.scrollHeight - el.scrollTop - el.clientHeight < 100
      ) {
        fetchResults({ append: true, token: pageToken });
      }
    };
    
    const el = listRef.current;
    if (el) el.addEventListener("scroll", onScroll);
    
    return () => {
      if (el) el.removeEventListener("scroll", onScroll);
    };
  }, [hasMore, isLoading, pageToken, fetchResults]);

  return (
    <div className={`${styles.searchWidget} ${disabled ? styles.disabled : ''}`}>
      {/* Search Bar */}
      <form
        className={styles.searchForm}
        onSubmit={startNewSearch}
        autoComplete="off"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search cases…"
          className={styles.searchInput}
          onKeyDown={e => {
            if (e.key === "Enter") startNewSearch(e);
          }}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={isLoading || disabled}
          className={styles.searchButton}
          tabIndex={-1}
        >
          🔍
        </button>
      </form>

      {/* Results Count and Selection Info */}
      {input && !isLoading && results.length > 0 && (
        <div className={styles.resultsInfo}>
          <div className={styles.resultsCount}>
            Showing {results.length}
            {totalResults ? ` of ${totalResults}` : ""} results
          </div>
          {selectedCases.size > 0 && (
            <div className={styles.selectionCount}>
              {selectedCases.size} case{selectedCases.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}

      {/* Results List */}
      <div
        ref={listRef}
        className={`${styles.resultsList} ${disabled ? styles.disabledList : ''}`}
      >
        {disabled && (
          <div className={styles.disabledOverlay}>
            Use the latest search widget
          </div>
        )}
        
        {results.length === 0 && input && !isLoading && (
          <div className={styles.noResults}>
            No results found.
          </div>
        )}
        
        {results.map((result) => (
          <div
            key={result.id}
            className={`${styles.resultItem} ${selectedCases.has(result.id) ? styles.selected : ''}`}
            onClick={() => toggleCaseSelection(result)}
          >
            <div className={styles.resultTitle} title={result.title}>
              {result.title}
            </div>
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                className={styles.checkbox}
                disabled={disabled}
                checked={selectedCases.has(result.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleCaseSelection(result);
                }}
              />
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className={styles.loading}>
            Loading…
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchWidget; 