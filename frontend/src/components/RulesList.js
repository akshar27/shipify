import { useEffect, useState } from "react";
import { getRules, money } from "../services/legal";

/** The prohibited-items list, rendered from the server's copy. `compact` shows just the titles. */
export default function RulesList({ compact = false }) {
  const [rules, setRules] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getRules().then(setRules).catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-danger">Could not load the rules. Please refresh the page.</p>;
  if (!rules) return <p className="text-muted">Loading...</p>;

  return (
    <ul className={compact ? "mb-2" : ""}>
      {rules.prohibited.map((p) => (
        <li key={p.id} className="mb-1">
          <strong>{p.title}.</strong>
          {!compact && <> {p.id === "value" ? `Items worth more than ${money(rules.maxItemValueCents, rules.currency)}.` : p.detail}</>}
        </li>
      ))}
    </ul>
  );
}
