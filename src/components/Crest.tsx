/**
 * Placeholder crest. Swap for the official MVTTC logo asset when supplied
 * (PRD.md §11, item 2) — this component is the only place it is referenced.
 */
export function Crest({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="MVTTC crest"
      fill="none"
    >
      <path
        d="M20 2 4 8v13c0 8.4 6.4 15.2 16 17 9.6-1.8 16-8.6 16-17V8L20 2Z"
        className="fill-mvttc-700"
      />
      <path
        d="M20 6 8 10.5V21c0 6.4 4.9 11.7 12 13.3 7.1-1.6 12-6.9 12-13.3V10.5L20 6Z"
        className="fill-mvttc-500"
      />
      <path
        d="M13 19.5 18 24l9-9"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
