import { TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

/** A borderless text input that saves on blur / Enter and reverts on Escape. */
export function InlineEdit({
  value,
  onSave,
  required,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => unknown;
  required?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const v = draft.trim();
    if (v === value || (required && !v)) return setDraft(value);
    void onSave(v);
  };

  return (
    <TextInput
      variant="unstyled"
      size="sm"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          const input = e.currentTarget;
          setDraft(value);
          requestAnimationFrame(() => input.blur());
        }
      }}
    />
  );
}
