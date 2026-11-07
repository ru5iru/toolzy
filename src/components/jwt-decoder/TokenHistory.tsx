import { getHistory, clearHistory, HistoryEntry } from "./jwtUtils";
import { Button } from "@/components/ui/button";
import { Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSelect: (token: string) => void;
}

export const TokenHistory = ({ onSelect }: Props) => {
  const history = getHistory();

  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">No tokens decoded yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{history.length} token(s)</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-destructive"
          onClick={() => { clearHistory(); toast.success("History cleared"); }}
        >
          <Trash2 className="w-3 h-3 mr-1" /> Clear
        </Button>
      </div>
      <div className="space-y-1 max-h-[200px] overflow-auto">
        {history.map((entry, i) => (
          <button
            key={i}
            onClick={() => onSelect(entry.token)}
            className="w-full text-left flex items-center gap-2 p-2 rounded hover:bg-accent/10 transition-colors group"
          >
            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{entry.label}</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">{entry.token.slice(0, 40)}...</div>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {new Date(entry.timestamp).toLocaleDateString()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
