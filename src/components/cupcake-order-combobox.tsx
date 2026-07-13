"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxInput,
  useComboboxAnchor,
} from "@/components/ui/combobox";

type CupcakeOrderComboboxProps = {
  options: string[];
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

export function CupcakeOrderCombobox({
  options,
  placeholder = "Select an option",
  value = "",
  onValueChange,
}: CupcakeOrderComboboxProps) {
  const anchorRef = useComboboxAnchor();

  return (
    <Combobox
      items={options}
      value={value || null}
      onValueChange={(nextValue) => onValueChange?.(typeof nextValue === "string" ? nextValue : "")}
    >
      <div ref={anchorRef} className="w-full">
        <ComboboxInput
          className="w-full"
          placeholder={placeholder}
          aria-label={placeholder}
          readOnly
          inputMode="none"
          autoComplete="off"
          showClear={Boolean(value)}
        />
      </div>

      <ComboboxContent anchor={anchorRef}>
        <ComboboxList>
          {options.map((option) => (
            <ComboboxItem key={option} value={option}>
              {option}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
