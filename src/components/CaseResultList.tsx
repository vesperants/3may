import React, { useState, useEffect, useCallback } from 'react';
import styles from './CaseResultList.module.css';

export interface Case {
  id: string;
  title: string;
  selected?: boolean;
}

interface CaseResultListProps {
  cases: Case[];
  onSelectionChange: (selectedCases: Case[]) => void;
  onSubmitSelection?: (selectedCases: Case[]) => void;
}

const CaseResultList: React.FC<CaseResultListProps> = ({ 
  cases, 
  onSelectionChange,
  onSubmitSelection
}) => {
  const [selectedCases, setSelectedCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredCases, setFilteredCases] = useState<Case[]>(cases);

  // Debug cases on component mount
  useEffect(() => {
    console.log('DEBUG - CaseResultList rendered with cases:', cases);
  }, [cases]);

  // Filter cases whenever search term or cases change
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCases(cases);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = cases.filter(caseItem => 
      caseItem.id.toLowerCase().includes(term) || 
      caseItem.title.toLowerCase().includes(term)
    );
    
    setFilteredCases(filtered);
  }, [searchTerm, cases]);

  const handleCheckboxChange = (caseItem: Case) => {
    const updatedCases = selectedCases.some(c => c.id === caseItem.id)
      ? selectedCases.filter(c => c.id !== caseItem.id)
      : [...selectedCases, caseItem];
    
    setSelectedCases(updatedCases);
    onSelectionChange(updatedCases);
    console.log('DEBUG - Selected cases updated:', updatedCases);
  };

  const handleSubmit = () => {
    if (onSubmitSelection && selectedCases.length > 0) {
      onSubmitSelection(selectedCases);
    }
  };

  // Handle wheel events to prevent scroll propagation
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    
    // If scrolling up and already at the top
    if (e.deltaY < 0 && element.scrollTop <= 0) {
      e.preventDefault();
    }
    
    // If scrolling down and already at the bottom
    if (e.deltaY > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight) {
      e.preventDefault();
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>Found {cases.length} cases</span>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search cases..."
            value={searchTerm}
            onChange={handleSearchChange}
            className={styles.searchInput}
          />
          {searchTerm && filteredCases.length !== cases.length && (
            <div className={styles.filterInfo}>
              Showing {filteredCases.length} of {cases.length} cases
            </div>
          )}
        </div>
      </div>
      <div 
        className={styles.caseList}
        onWheel={handleWheel}
      >
        {filteredCases.length > 0 ? (
          filteredCases.map((caseItem) => (
            <div key={caseItem.id} className={styles.caseItem}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={selectedCases.some(c => c.id === caseItem.id)}
                  onChange={() => handleCheckboxChange(caseItem)}
                  className={styles.checkbox}
                />
                <div className={styles.caseInfo}>
                  <span className={styles.caseId}>निर्णय नं. {caseItem.id}</span>
                  <span className={styles.caseTitle}>{caseItem.title}</span>
                </div>
              </label>
            </div>
          ))
        ) : (
          <div className={styles.noCasesFound}>
            No cases found matching &quot;{searchTerm}&quot;
          </div>
        )}
      </div>
      {selectedCases.length > 0 && (
        <div className={styles.selectedCountContainer}>
          <div className={styles.selectedCount}>
            {selectedCases.length} case{selectedCases.length !== 1 ? 's' : ''} selected
          </div>
          {onSubmitSelection && (
            <button 
              onClick={handleSubmit}
              className={styles.submitButton}
            >
              Get details
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseResultList; 