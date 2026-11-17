import { useEffect, useRef } from "react";

/**
 * Scoreboard numerals. When the value changes, only the characters that changed
 * roll in, the way a real LED board updates one digit at a time.
 */
export function Led({ value, className = "", label }: { value: string; className?: string; label?: string }) {
  const prev = useRef(value);
  const gen = useRef(0);
  const changed = prev.current !== value;
  if (changed) gen.current += 1;
  const before = changed ? prev.current : value;

  useEffect(() => {
    prev.current = value;
  }, [value]);

  // Right-align the comparison so "980" -> "1 020" rolls the right digits.
  const offset = value.length - before.length;
  return (
    <span className={`led ${className}`} aria-label={label ?? value} role="img">
      {Array.from(value).map((ch, i) => {
        const old = before[i - offset];
        const roll = changed && old !== ch;
        return (
          <span
            key={roll ? `${i}-${gen.current}` : i}
            className={`led-cell${roll ? " roll" : ""}${ch === "." || ch === "," ? " led-dot" : ""}${ch === ":" ? " led-colon" : ""}${ch === " " ? " led-gap" : ""}`}
            aria-hidden
          >
            {/* Doto's punctuation reads badly: draw separators as lit LEDs instead. */}
            {ch === "." || ch === "," ? <i /> : ch === ":" ? (<><i /><i /></>) : ch === " " ? null : <span>{ch}</span>}
          </span>
        );
      })}
    </span>
  );
}
