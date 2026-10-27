import { useState } from "react";
import API from "../services/api";
import "../css/MyDeliveries.css"; // the overlay and box styles

export default function RatingModal({ show, onClose, delivery, receiverId, onRated }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!show) return null;

  const submitRating = async () => {
    if (stars === 0) return setError("Please select a rating.");
    setError("");

    try {
      setLoading(true);

      await API.post("/ratings", {
        deliveryId: delivery.id,
        receiverId,
        rating: stars,
        comment,
      });

      onRated(delivery.id);
      onClose();
    } catch (err) {
      console.error("Rating failed", err);
      setError(err.response?.data?.msg || "Rating failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h5>Rate Your Traveler</h5>

        <div className="stars">
          {[1, 2, 3, 4, 5].map((s) => (
            <span
              key={s}
              className="star"
              style={{ color: s <= stars ? "gold" : "#ccc" }}
              onClick={() => setStars(s)}
            >
              ★
            </span>
          ))}
        </div>

        <textarea
          className="form-control"
          rows={3}
          placeholder="Optional comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {error && <div className="alert alert-danger mt-2 mb-0 py-1" role="alert">{error}</div>}

        <button className="btn btn-primary w-100 mt-2" onClick={submitRating} disabled={loading}>
          {loading ? "Submitting..." : "Submit Rating"}
        </button>
        <button className="btn btn-secondary w-100 mt-2" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
