import React from 'react';
import { NumericFormat } from 'react-number-format';
import { UseFormRegister } from 'react-hook-form';

interface CurrencyInputProps {
  name: string;
  register: UseFormRegister<any>;
  error?: string;
  label?: string;
  className?: string;
  onChange?: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
  setValue?: any;
}

export default function CurrencyInput({
  name,
  register,
  error,
  label,
  className = '',
  onChange,
  disabled = false,
  placeholder = '',
  setValue
}: CurrencyInputProps) {
  const { onChange: registerOnChange, ref, ...rest } = register(name, {
    setValueAs: (value: string) => {
      if (!value) return undefined;
      const numericValue = typeof value === 'string' ? 
        parseFloat(value.replace(/\D/g, '')) / 100 : 
        value;
      return numericValue;
    }
  });

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
      )}
      <NumericFormat
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        getInputRef={ref}
        className={`appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm ${className}`}
        placeholder={placeholder}
        disabled={disabled}
        onValueChange={(values) => {
          const numericValue = values.floatValue || undefined;
          registerOnChange({
            target: {
              name,
              value: numericValue,
              type: 'number'
            }
          });
          if (onChange) {
            onChange(numericValue || 0);
          }
          if (setValue) {
            setValue(name, numericValue);
          }
        }}
        {...rest}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}