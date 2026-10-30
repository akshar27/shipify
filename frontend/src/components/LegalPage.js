import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRules } from "../services/legal";

/**
 * Wrapper for the Terms and Privacy pages. The text is a plain-language DRAFT written without a lawyer: the banner stays
 * until someone qualified has reviewed it. Company name and contact email come from server settings; when they are not
 * set the page says so in red instead of inventing them.
 */
export default function LegalPage({ title, children }) {
  const [rules, setRules] = useState(null);
  useEffect(() => {
    getRules().then(setRules).catch(() => {});
  }, []);

  const company = rules?.companyName || <span className="text-danger">[set COMPANY_NAME on the server]</span>;
  const email = rules?.supportEmail ? <a href={`mailto:${rules.supportEmail}`}>{rules.supportEmail}</a> : <span className="text-danger">[set SUPPORT_EMAIL on the server]</span>;

  return (
    <div className="container my-5" style={{ maxWidth: 820 }}>
      <div className="alert alert-warning">
        <strong>Draft.</strong> This text is a plain-language starting point and has not been reviewed by a lawyer. Have it reviewed before real
        people use the service.
      </div>
      <h1 className="mb-1">{title}</h1>
      {rules && <p className="text-muted">Version {rules.termsVersion}</p>}
      {typeof children === "function" ? children({ company, email, rules }) : children}
      <hr />
      <p className="small">
        <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/prohibited-items">Prohibited items</Link>
      </p>
    </div>
  );
}
