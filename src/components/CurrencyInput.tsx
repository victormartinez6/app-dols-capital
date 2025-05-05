import React, { useState, useEffect } from 'react';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
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
  control?: any;
}

// Função para formatar o valor como moeda (exportada para uso em outros componentes)
export const formatCurrency = (value: number): string => {
  if (!value && value !== 0) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function CurrencyInput({
  name,
  register,
  error,
  label,
  className = '',
  onChange,
  disabled = false,
  placeholder = '',
  setValue,
  control
}: CurrencyInputProps) {
  // Estado para controlar o valor formatado
  const [displayValue, setDisplayValue] = useState<string>('');
  
  // Referência para o input
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  
  // Registrar o campo com react-hook-form
  const { onChange: registerOnChange, onBlur, ref, ...rest } = register(name);

  // Combinar as referências
  const setRefs = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    if (typeof ref === 'function' && element) {
      ref(element);
    }
  };
  
  // Função para garantir que o valor seja sempre numérico
  const ensureNumericValue = (value: any): number => {
    if (value === undefined || value === null) return 0;
    
    if (typeof value === 'string') {
      // Remove caracteres não numéricos, exceto vírgula e ponto
      const cleanValue = value.replace(/[^\d,-]/g, '').replace(',', '.');
      return parseFloat(cleanValue) || 0;
    }
    
    return Number(value) || 0;
  };

  // Função para formatar o valor para exibição
  const formatValueForDisplay = (value: any): string => {
    const numericValue = ensureNumericValue(value);
    return numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Função para formatar o valor para o campo
  const formatValueForField = (value: any): number => {
    return ensureNumericValue(value);
  };

  // Efeito para verificar e atualizar o valor inicial
  useEffect(() => {
    // Verificar o valor inicial após um pequeno atraso
    const timer = setTimeout(() => {
      try {
        if (control) {
          // Se temos controle, podemos usar useWatch para obter o valor atual
          const currentValue = control._getWatch(name);
          console.log(`CurrencyInput - Valor atual para ${name} via control:`, currentValue);
          
          if (currentValue !== undefined && currentValue !== null) {
            // Garantir que o valor seja um número válido
            const numericValue = formatValueForField(currentValue);
            
            // Formatar o valor como moeda
            const formattedValue = formatValueForDisplay(numericValue);
            setDisplayValue(formattedValue);
            
            // Garantir que o valor no formulário seja um número válido
            if (setValue) {
              setValue(name, numericValue, { shouldValidate: false });
            }
          }
        } else if (inputRef.current) {
          const rawValue = inputRef.current.getAttribute('value');
          console.log(`CurrencyInput - Valor bruto para ${name}:`, rawValue);
          
          if (rawValue) {
            // Tentar converter para número
            const numericValue = formatValueForField(rawValue);
            
            console.log(`CurrencyInput - Valor numérico para ${name}:`, numericValue);
            
            // Formatar o valor como moeda
            const formattedValue = formatValueForDisplay(numericValue);
            setDisplayValue(formattedValue);
            
            // Garantir que o valor no formulário seja um número válido
            if (setValue) {
              setValue(name, numericValue, { shouldValidate: false });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar valor inicial:', error);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [name, control, setValue]);

  const handleValueChange = (values: NumberFormatValues) => {
    const { floatValue } = values;
    const numericValue = floatValue !== undefined ? floatValue : 0;
    
    // Atualiza o valor no formulário
    registerOnChange({
      target: {
        name,
        value: numericValue,
        type: 'number'
      }
    });
    
    // Atualiza o valor local
    setDisplayValue(values.formattedValue || "R$ 0,00");
    
    // Chamar o onChange personalizado, se fornecido
    if (onChange) {
      onChange(numericValue);
    }
    
    // Atualizar o valor diretamente no formulário
    if (setValue) {
      // Garantir que o valor seja um número
      setValue(name, numericValue, { shouldValidate: true });
      
      // Log para debug
      console.log(`CurrencyInput - Valor atualizado para ${name}:`, numericValue, typeof numericValue);
    }
  };

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
        getInputRef={setRefs}
        className={`appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm ${className}`}
        placeholder={placeholder || "R$ 0,00"}
        disabled={disabled}
        value={displayValue === "0,00" || displayValue === "0" ? undefined : displayValue}
        onValueChange={handleValueChange}
        onBlur={(e) => {
          // Quando o campo perde o foco, garantir que o valor seja um número válido
          let currentValue;
          try {
            currentValue = ensureNumericValue(e.target.value);
          } catch (error) {
            currentValue = 0;
          }
          
          const validValue = isNaN(currentValue) ? 0 : currentValue;
          
          // Atualizar o valor no formulário
          if (setValue) {
            setValue(name, validValue, { shouldValidate: true });
            console.log(`CurrencyInput - onBlur - Valor final para ${name}:`, validValue, typeof validValue);
          }
          
          // Chamar o onBlur original
          onBlur(e);
        }}
        {...rest}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}