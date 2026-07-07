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
};

export function CupcakeOrderCombobox({
  options,
  placeholder = "Select an option",
}: CupcakeOrderComboboxProps) {
  const anchorRef = useComboboxAnchor();

  return (
    <Combobox items={options}>
      <div ref={anchorRef} className="w-full">
        <ComboboxInput
          className="w-full"
          placeholder={placeholder}
          aria-label={placeholder}
          readOnly
          inputMode="none"
          autoComplete="off"
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
