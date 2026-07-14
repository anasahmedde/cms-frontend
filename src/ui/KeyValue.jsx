// Definition-list grid of label/value pairs. item: { label, value, mono }.
// Null/undefined/empty values render "—".
import "./kit-data.css";

export default function KeyValue({ items = [], columns = 2 }) {
  return (
    <dl
      className="ui-kv"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => (
        <div className="ui-kv-item" key={`${item.label}-${i}`}>
          <dt className="ui-kv-label">{item.label}</dt>
          <dd
            className={`ui-kv-value${item.mono ? " ui-kv-value-mono" : ""}`}
          >
            {item.value === null || item.value === undefined || item.value === ""
              ? "—"
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
