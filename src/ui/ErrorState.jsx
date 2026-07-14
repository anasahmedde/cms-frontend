import { AlertTriangle, RefreshCw } from "lucide-react";
import Button from "./Button";
import "./kit-core.css";

// Failed-request panel: says what happened and offers a retry. Use this —
// never an empty list — when a fetch fails.
export default function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="ui-empty ui-error" role="alert">
      <span className="ui-empty-icon ui-error-icon">
        <AlertTriangle size={18} aria-hidden="true" />
      </span>
      <p className="ui-empty-title">{message}</p>
      {onRetry ? (
        <div className="ui-empty-action">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
