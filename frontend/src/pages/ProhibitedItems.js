import LegalPage from "../components/LegalPage";
import RulesList from "../components/RulesList";
import { getRules } from "../services/legal";
import { useEffect, useState } from "react";

export default function ProhibitedItems() {
  const [rules, setRules] = useState(null);
  useEffect(() => {
    getRules().then(setRules).catch(() => {});
  }, []);

  return (
    <LegalPage title="Prohibited items and traveler rules">
      <p>Never send, and never carry, any of these:</p>
      <RulesList />
      <h4 className="mt-4">If you are a traveler</h4>
      <ul>
        {(rules?.travelerRules || []).map((r) => (
          <li key={r} className="mb-1">{r}</li>
        ))}
      </ul>
      <p className="text-muted">If you are unsure whether something is allowed, it is not. Leave it out.</p>
    </LegalPage>
  );
}
