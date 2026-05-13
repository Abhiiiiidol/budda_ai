const PROMPTS = [
  "Summarize this product",
  "Find the PRD document",
  "What decisions changed?",
  "What did AI tools suggest?",
  "Show me all Figma links",
  "Explain this to a new engineer",
] as const;

export default function SuggestedPrompts({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="text-5xl">🧘</div>
      <div>
        <p className="text-sm font-medium">Ask Budda anything about this product</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Answers come only from documents you've fed in.
        </p>
      </div>
      <div className="mt-2 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            disabled={disabled}
            className="rounded-md border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-foreground/30 hover:bg-card/80 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
