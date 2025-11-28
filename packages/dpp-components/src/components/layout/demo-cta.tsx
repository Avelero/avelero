export function DemoCTA() {
  return (
    <div className="sticky bottom-3 @3xl:bottom-6 z-50 flex justify-end pr-3 @3xl:pr-6 mb-3 @3xl:mb-6 pointer-events-none">
      <a
        href="https://www.avelero.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 p-2 h-9 px-2 py-[10px] text-[14px] leading-[16px] hover:opacity-90 pointer-events-auto shadow-sm box-border"
        style={{ color: 'var(--highlight-foreground)', backgroundColor: 'var(--highlight)' }}
      >
        <div className="inline-flex items-center px-1">Talk to founders</div>
        <span className="inline-flex items-center h-4 w-4">
          <svg
            className="h-full w-full"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </span>
      </a>
    </div>
  );
}
