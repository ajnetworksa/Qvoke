import React from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  className = '',
  disabled = false
}) => {
  // Convert Date object to YYYY-MM-DD string for input
  const dateString = value instanceof Date && !isNaN(value.getTime())
    ? value.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value);
    if (!isNaN(selectedDate.getTime())) {
      onChange(selectedDate);
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <Calendar className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
        <input
          type="date"
          value={dateString}
          onChange={handleChange}
          disabled={disabled}
          className="w-full premium-input pl-10 pr-3 py-2 cursor-pointer focus:outline-none focus:ring-0 disabled:opacity-50"
        />
      </div>
    </div>
  );
};
export default DatePicker;
