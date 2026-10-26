import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

const money = (cents, currency = "usd") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "");
const errText = (err, fallback) => err.response?.data?.msg || fallback;
const CONFIRMED_BY = {
  sender: "Confirmed by the sender",
  admin: "Released by an admin after a dispute",
  timeout: "Auto-confirmed after the review window",
};

// Payouts are manual for the MVP: pay the traveler outside the app (bank transfer etc.), then record the reference here.
// No alert() or prompt() anywhere on this page: inline messages only.
export default function AdminPayouts() {
  const [tab, setTab] = useState("ready");
  const [ready, setReady] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);

  // per-row form state, keyed by delivery id
  const [reference, setReference] = useState({});
  const [note, setNote] = useState({});
  const [armed, setArmed] = useState(null); // "<id>:<action>" waiting for a second click

  const load = useCallback(async () => {
    try {
      const [r, d, h] = await Promise.all([API.get("/admin/payouts/ready"), API.get("/admin/disputes"), API.get("/admin/payouts/history")]);
      setReady(r.data);
      setDisputes(d.data);
      setHistory(h.data);
    } catch (err) {
      setMessage({ type: "danger", text: errText(err, "Could not load payouts") });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (request, okText) => {
    setBusy(true);
    setMessage(null);
    try {
      await request();
      setMessage({ type: "success", text: okText });
      setArmed(null);
      await load();
    } catch (err) {
      setMessage({ type: "danger", text: errText(err, "That did not work") });
      setArmed(null); // a failed refund must be armed again on purpose
    } finally {
      setBusy(false);
    }
  };

  const markPaid = (d) =>
    run(() => API.post(`/admin/payouts/${d.id}`, { reference: reference[d.id] || "" }), `Recorded: ${d.traveler.name} was paid ${money(d.netCents, d.currency)}.`);

  const resolve = (d, action) => {
    const key = `${d.id}:${action}`;
    if (action === "refund" && armed !== key) return setArmed(key); // refunding moves real money: ask twice
    return run(
      () => API.post(`/admin/disputes/${d.id}/resolve`, { action, note: note[d.id] || "" }),
      action === "refund" ? "Refunded to the sender." : "Released: the traveler is now due a payout."
    );
  };

  const owed = ready.reduce((sum, d) => sum + d.netCents, 0);
  const tabBtn = (id, label, count) => (
    <button className={`btn btn-sm me-2 ${tab === id ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab(id)}>
      {label}
      {count > 0 && <span className="badge bg-light text-dark ms-2">{count}</span>}
    </button>
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Payouts and disputes</h2>
        <Link to="/admin" className="btn btn-sm btn-outline-secondary">Back to users</Link>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="mb-3">
        {tabBtn("ready", "Ready to pay", ready.length)}
        {tabBtn("disputes", "Disputes", disputes.length)}
        {tabBtn("history", "Paid out", 0)}
      </div>

      {tab === "ready" && (
        <>
          <p className="text-muted">
            {ready.length === 0
              ? "Nobody is owed money right now."
              : `${ready.length} traveler payment${ready.length === 1 ? "" : "s"} due, ${money(owed, ready[0].currency)} in total. Pay each traveler yourself, then record the reference.`}
          </p>
          {ready.map((d) => (
            <div className="card mb-3" key={d.id}>
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h5 className="mb-1">{d.traveler.name} <small className="text-muted">{d.traveler.email}</small></h5>
                    <div>{d.pickup} to {d.dropoff} ({d.itemType})</div>
                    <div className="text-muted small">
                      Sender: {d.sender.name}. {CONFIRMED_BY[d.confirmedBy]} {when(d.readySince)}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fs-4">{money(d.netCents, d.currency)}</div>
                    <div className="text-muted small">{money(d.grossCents, d.currency)} paid, {money(d.feeCents, d.currency)} platform fee</div>
                  </div>
                </div>
                <div className="input-group mt-3">
                  <input
                    className="form-control"
                    placeholder="Payment reference (e.g. bank transfer id)"
                    value={reference[d.id] || ""}
                    onChange={(e) => setReference({ ...reference, [d.id]: e.target.value })}
                  />
                  <button className="btn btn-success" disabled={busy || (reference[d.id] || "").trim().length < 3} onClick={() => markPaid(d)}>
                    Mark as paid
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "disputes" && (
        <>
          {disputes.length === 0 && <p className="text-muted">No open disputes.</p>}
          {disputes.map((d) => (
            <div className="card mb-3 border-warning" key={d.id}>
              <div className="card-body">
                <h5 className="mb-1">{d.pickup} to {d.dropoff} ({d.itemType})</h5>
                <div className="small text-muted mb-2">
                  Sender {d.sender.name} ({d.sender.email}) reported on {when(d.disputedAt)}. Traveler: {d.traveler ? `${d.traveler.name} (${d.traveler.email})` : "none"}.
                </div>
                <blockquote className="mb-3">{d.disputeReason}</blockquote>
                <textarea
                  className="form-control mb-2"
                  rows={2}
                  placeholder="Your decision and why (required, kept on the record)"
                  value={note[d.id] || ""}
                  onChange={(e) => setNote({ ...note, [d.id]: e.target.value })}
                />
                <button className="btn btn-success me-2" disabled={busy || (note[d.id] || "").trim().length < 3} onClick={() => resolve(d, "release")}>
                  Release to traveler
                </button>
                <button className="btn btn-danger" disabled={busy || (note[d.id] || "").trim().length < 3} onClick={() => resolve(d, "refund")}>
                  {armed === `${d.id}:refund` ? "Click again to refund the sender" : "Refund sender"}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "history" && (
        <table className="table table-sm">
          <thead>
            <tr><th>Paid</th><th>Traveler</th><th>Route</th><th>Net</th><th>Fee</th><th>Reference</th><th>By</th></tr>
          </thead>
          <tbody>
            {history.map((p) => (
              <tr key={p.id}>
                <td>{when(p.createdAt)}</td>
                <td>{p.traveler.name}</td>
                <td>{p.delivery.pickup} to {p.delivery.dropoff}</td>
                <td>{money(p.netCents, p.currency)}</td>
                <td>{money(p.feeCents, p.currency)}</td>
                <td>{p.reference}</td>
                <td>{p.paidBy.name}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan="7" className="text-muted">No payouts recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
