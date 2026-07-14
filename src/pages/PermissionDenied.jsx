// Friendly in-shell page for routes the user's role cannot open.
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import "../shell/shell.css";

export default function PermissionDenied() {
  const navigate = useNavigate();
  return (
    <div className="ui-denied">
      <div className="ui-denied-card">
        <span className="ui-denied-icon">
          <Lock size={18} aria-hidden="true" />
        </span>
        <h2 className="ui-denied-title">You don't have access to this page</h2>
        <p className="ui-denied-hint">Ask a company admin to grant you the permission.</p>
        <Button variant="secondary" onClick={() => navigate("/")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
