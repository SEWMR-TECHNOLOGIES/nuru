import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /** Prefix shown before the number, e.g. "TZS " */
  prefix?: string;
}

/**
 * An input that auto-formats numbers with commas as the user types.
 * Stores the raw numeric string (no commas) and displays formatted.
 */
const FormattedNumberInput = React.forwardRef<HTMLInputElement, FormattedNumberInputProps>(
  ({ value, onChange, prefix, className, ...props }, ref) => {
    const formatDisplay = (raw: string): string => {
      const digits = raw.replace(/[^\d]/g, "");
      if (!digits) return "";
      return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value;
      // Strip prefix if present
      const stripped = prefix ? inputVal.replace(prefix, "") : inputVal;
      const raw = stripped.replace(/[^\d]/g, "");
      onChange(raw);
    };

    const displayValue = formatDisplay(value);

    return (
      <Input
        ref={ref}
        className={cn(className)}
        value={prefix ? (displayValue ? `${prefix}${displayValue}` : "") : displayValue}
        onChange={handleChange}
        inputMode="numeric"
        autoComplete="off"
        {...props}
      />
    );
  }
);

FormattedNumberInput.displayName = "FormattedNumberInput";

export { FormattedNumberInput };
