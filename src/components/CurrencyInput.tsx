import React from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (val: number) => void;
  symbol?: string;
  disabled?: boolean;
  className?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  symbol = 'SAR',
  disabled = false,
  className = ''
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChange(isNaN(val) ? 0 : val);
  };

  return (
    <div className={`relative flex items-center rounded-md bg-[var(--color-surface-2)] shadow-sm ${className}`}>
      <span className="pl-3 text-sm text-[var(--color-text-muted)] pointer-events-none">
        {symbol}
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value === 0 ? '' : value}
        onChange={handleChange}
        disabled={disabled}
        placeholder="0.00"
        className="w-full bg-transparent border-0 py-2 pr-3 pl-2 text-right text-sm text-[var(--color-text)] focus:outline-none focus:ring-0 disabled:opacity-50"
      />
    </div>
  );
};
export default CurrencyInput;
