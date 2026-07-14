// Catches render crashes so one bad page never white-screens the app.
import React from "react";
import { RotateCw } from "lucide-react";
import Button from "../ui/Button";
import ErrorState from "../ui/ErrorState";
import "./shell.css";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const stack = [error?.stack, info?.componentStack].filter(Boolean).join("\n\n");
    const message = error?.message
      ? `Something went wrong: ${error.message}`
      : "Something went wrong while rendering this page.";

    return (
      <div className="ui-eb">
        <ErrorState message={message} />
        <div className="ui-eb-actions">
          <Button variant="primary" icon={RotateCw} onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
        {stack ? (
          <details className="ui-eb-details">
            <summary>Technical details</summary>
            <pre className="ui-eb-stack">{stack}</pre>
          </details>
        ) : null}
      </div>
    );
  }
}
