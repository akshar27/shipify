import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import "../css/MyDeliveries.css";

export default function MyDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentDelivery, setCurrentDelivery] = useState(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [ratedIds, setRatedIds] = useState({});

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const res = await API.get("/deliveries/mine");
        setDeliveries(res.data);
      } catch (err) {
        console.error("Failed to load deliveries", err);
      }
    };
    fetchDeliveries();
  }, []);

  const handleRate = (delivery) => {
    setCurrentDelivery(delivery);
    setStars(0);
    setComment("");
    setShowModal(true);
  };

  const submitRating = async () => {
    try {
      const travelerId = currentDelivery?.requests?.[0]?.travelerId;
      if (!travelerId || !stars) return;

      await API.post("/ratings", {
        deliveryId: currentDelivery.id,
        receiverId: travelerId,
        rating: stars,
        comment,
      });

      setRatedIds((prev) => ({ ...prev, [currentDelivery.id]: true }));
      setShowModal(false);
    } catch (err) {
      console.error("Failed to submit rating", err);
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">My Delivery Requests</h2>

      {deliveries.length === 0 ? (
        <p>No deliveries yet.</p>
      ) : (
        <div className="row">
          {deliveries.map((d) => (
            <div className="col-md-6 mb-4" key={d.id}>
              <div className="card shadow">
                <div className="card-body">
                  <h5 className="card-title">{d.itemType} ({d.size})</h5>
                  <p className="card-text">
                    <strong>From:</strong> {d.pickup}<br />
                    <strong>To:</strong> {d.dropoff}<br />
                    <strong>Weight:</strong> {d.weight} kg<br />
                    <strong>Status:</strong> {d.status}
                  </p>

                  <Link to={`/match/${d.id}`} className="btn btn-sm btn-outline-primary mb-2">
                    Find Traveler
                  </Link>

                  {d.status === "accepted" && d.requests?.length > 0 && (
                    <Link to={`/chat/${d.id}`} className="btn btn-sm btn-outline-success mt-2">
                      💬 Message Traveler
                    </Link>
                  )}

                  {d.status === "delivered" && !ratedIds[d.id] && d.requests?.length > 0 && (
                    <button
                      className="btn btn-sm btn-success ms-2"
                      onClick={() => handleRate(d)}
                    >
                      Rate Traveler
                    </button>
                  )}

                  {ratedIds[d.id] && (
                    <p className="text-success mt-2">Thanks for your rating!</p>
                  )}

                  <br />
                  <small className="text-muted">
                    Created: {new Date(d.createdAt).toLocaleString()}
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ⭐ Rating Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h5>Rate Your Traveler</h5>
            <div className="star-row mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: "24px",
                    color: s <= stars ? "gold" : "#ccc",
                    cursor: "pointer",
                  }}
                  onClick={() => setStars(s)}
                >
                  ★
                </span>
              ))}
            </div>
            <textarea
              className="form-control mb-3"
              rows={3}
              placeholder="Optional comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button className="btn btn-primary me-2" onClick={submitRating}>
              Submit
            </button>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
