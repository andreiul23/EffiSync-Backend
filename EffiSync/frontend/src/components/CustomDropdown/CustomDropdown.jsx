import { useState, useRef, useEffect } from 'react';
import './CustomDropdown.scss';

function CustomDropdown({ value, options, onChange, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <div 
        className={`custom-dropdown__control ${isOpen ? 'custom-dropdown__control--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="custom-dropdown__value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="custom-dropdown__arrow">▾</span>
      </div>
      
      {isOpen && (
        <div className="custom-dropdown__menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`custom-dropdown__option ${opt.value === value ? 'custom-dropdown__option--selected' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CustomDropdown;
