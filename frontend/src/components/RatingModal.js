import { useState } from "react";
import API from "../services/api";

export default function RatingModal({ show, onClose, delivery, receiverId, onRated }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const submitRating = async () => {
    if (stars === 0) return alert("Please select a rating.");

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
      alert("Rating failed");
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

        <button className="btn btn-primary w-100 mt-2" onClick={submitRating}>
          {loading ? "Submitting..." : "Submit Rating"}
        </button>
        <button className="btn btn-secondary w-100 mt-2" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
