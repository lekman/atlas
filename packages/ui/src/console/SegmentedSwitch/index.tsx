export interface SegmentedSwitchProps<Value extends string> {
  /** What the group switches, for screen readers: "Range", "View". */
  label: string;
  /** The choices in order, with the word each is shown by. */
  options: ReadonlyArray<{ value: Value; name: string }>;
  /** The choice shown now. */
  value: Value;
  /** Called with the choice the reader picks. */
  onChange(value: Value): void;
}

/**
 * A row of buttons where one is on, such as Today, Tomorrow and Backlog.
 * Each is a toggle button with `aria-pressed`, at least 44 px high.
 */
export function SegmentedSwitch<Value extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedSwitchProps<Value>) {
  return (
    <div className="console-segments" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}
