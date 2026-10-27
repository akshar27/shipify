import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import API from "../services/api";
import RatingModal from "../components/RatingModal";

const errText = (err, fallback) => err.response?.data?.msg || fallback;
const CONFIRM_WINDOW_HOURS = 72; // keep in step with AUTO_CONFIRM_HOURS on the server; the server enforces it either way

const STATUS_TEXT = {
  pending: "Waiting for a traveler",
  accepted: "A traveler has accepted",
  "in-transit": "On its way",
  delivered: "Delivered: please confirm",
  confirmed: "Confirmed",
  disputed: "Under review",
  refunded: "Refunded",
};

// Ratings open once the sender confirmed, or the confirm window passed without a word (the server counts that as confirmed too).
const canRate = (d) =>
  d.status === "confirmed" || (d.status === "delivered" && d.deliveredAt && Date.now() - new Date(d.deliveredAt).getTime() > CONFIRM_WINDOW_HOURS * 3600 * 1000);

// An unpaid delivery is not visible to travelers yet, so it must not claim to be waiting for one.
const statusText = (d) => (d.status === "pending" && d.paymentStatus === "unpaid" ? "Awaiting payment" : STATUS_TEXT[d.status] || d.status);

export default function MyDeliveries() {
  const flash = useLocation().state?.notice; // e.g. "Payment could not be started... press Pay now"
  const [deliveries, setDeliveries] = useState([]);
  const [showRating, setShowRating] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [ratedDeliveries, setRatedDeliveries] = useState({});

  const [codes, setCodes] = useState({}); // deliveryId -> handover code, fetched on demand
  const [reporting, setReporting] = useState(null); // deliveryId whose "report a problem" form is open
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState({}); // deliveryId -> { type, text }, shown on that card

  const say = (id, type, text) => setNotice((n) => ({ ...n, [id]: { type, text } }));
  const patchDelivery = (id, changes) => setDeliveries((list) => list.map((d) => (d.id === id ? { ...d, ...changes } : d)));

  const loadDeliveries = async () => {
    try {
      const res = await API.get("/deliveries/mine");
      setDeliveries(res.data);

      // Check rating status for each delivery
      for (let d of res.data) {
        const r = await API.get(`/ratings/delivery/${d.id}`);
        setRatedDeliveries((prev) => ({ ...prev, [d.id]: !!r.data }));
      }
    } catch (err) {
      console.error("Failed to load deliveries", err);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  const payNow = async (deliveryId) => {
    try {
      const res = await API.post("/payments/create-checkout-session", { deliveryId });
      window.location.href = res.data.url;
    } catch (err) {
      say(deliveryId, "danger", errText(err, "Payment could not be started"));
    }
  };

  const showCode = async (deliveryId) => {
    try {
      const res = await API.get(`/deliveries/${deliveryId}/handover-code`);
      setCodes((c) => ({ ...c, [deliveryId]: res.data.code }));
    } catch (err) {
      say(deliveryId, "danger", errText(err, "Could not load the code"));
    }
  };

  const confirm = async (deliveryId) => {
    try {
      const res = await API.post(`/deliveries/${deliveryId}/confirm`);
      patchDelivery(deliveryId, { status: res.data.delivery.status });
      say(deliveryId, "success", "Thanks! The traveler will be paid.");
    } catch (err) {
      say(deliveryId, "danger", errText(err, "Could not confirm"));
    }
  };

  const report = async (deliveryId) => {
    try {
      const res = await API.post(`/deliveries/${deliveryId}/dispute`, { reason });
      patchDelivery(deliveryId, { status: res.data.delivery.status });
      setReporting(null);
      setReason("");
      say(deliveryId, "info", "Thanks, we'll look into it and get back to you.");
    } catch (err) {
      say(deliveryId, "danger", errText(err, "Could not send your report"));
    }
  };

  const openRating = (d) => {
    setSelectedDelivery(d);
    setShowRating(true);
  };

  const markRated = (deliveryId) => {
    setRatedDeliveries((prev) => ({ ...prev, [deliveryId]: true }));
  };

  const travelerOf = (d) => d.travelerId || d.requests?.[0]?.travelerId;

  return (
    <div className="container mt-5">
      <h2>My Deliveries</h2>

      {flash && <div className="alert alert-info">{flash}</div>}

      {deliveries.map((d) => (
        <div className="card p-3 mb-3" key={d.id}>
          <h5>{d.itemType} ({d.size})</h5>
          <p>
            <strong>Pickup:</strong> {d.pickup} <br />
            <strong>Dropoff:</strong> {d.dropoff} <br />
            <strong>Status:</strong> {statusText(d)} <br />
            <strong>Payment:</strong> {d.paymentStatus || "unpaid"}
          </p>

          {notice[d.id] && <div className={`alert alert-${notice[d.id].type} py-2`}>{notice[d.id].text}</div>}

          {d.paymentStatus === "unpaid" && d.status === "pending" && (
            <div>
              <button className="btn btn-primary" onClick={() => payNow(d.id)}>
                Pay now
              </button>
            </div>
          )}

          {(d.status === "accepted" || d.status === "in-transit") && (
            <div className="mb-2">
              {codes[d.id] ? (
                <div className="p-3 bg-light border rounded text-center">
                  <div className="text-muted small">Handover code. Give it to the person receiving the package, not to the traveler.</div>
                  <div style={{ fontSize: "2rem", letterSpacing: "0.4rem", fontWeight: 600 }}>{codes[d.id]}</div>
                  <div className="text-muted small">The traveler enters it when they hand the package over.</div>
                </div>
              ) : (
                <button className="btn btn-outline-primary" onClick={() => showCode(d.id)}>
                  Show handover code
                </button>
              )}
            </div>
          )}

          {(d.status === "accepted" || d.status === "in-transit" || d.status === "delivered") && reporting !== d.id && (
            <div className="mb-2">
              {d.status === "delivered" && (
                <>
                  <p className="mb-2">
                    The traveler says it was delivered. Confirm if everything is fine. If you do nothing, it is confirmed automatically {CONFIRM_WINDOW_HOURS} hours after delivery.
                  </p>
                  <button className="btn btn-success me-2" onClick={() => confirm(d.id)}>
                    Confirm delivery
                  </button>
                </>
              )}
              <button className="btn btn-outline-danger" onClick={() => { setReporting(d.id); setReason(""); }}>
                Report a problem
              </button>
            </div>
          )}

          {reporting === d.id && (
            <div className="mb-2">
              <textarea className="form-control mb-2" rows={3} placeholder="What went wrong? (at least 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn btn-danger me-2" disabled={reason.trim().length < 10} onClick={() => report(d.id)}>
                Send report
              </button>
              <button className="btn btn-link" onClick={() => setReporting(null)}>Cancel</button>
            </div>
          )}

          {canRate(d) &&
            travelerOf(d) &&
            !ratedDeliveries[d.id] && (
              <button className="btn btn-success" onClick={() => openRating(d)}>
                Rate Traveler
              </button>
          )}

          {ratedDeliveries[d.id] && (
            <p className="text-success">Thanks for your rating!</p>
          )}
        </div>
      ))}

      {showRating && (
        <RatingModal
          show={showRating}
          delivery={selectedDelivery}
          receiverId={travelerOf(selectedDelivery)}
          onRated={markRated}
          onClose={() => setShowRating(false)}
        />
      )}
    </div>
  );
}
