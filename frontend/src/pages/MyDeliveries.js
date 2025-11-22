import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import RatingModal from "../components/RatingModal";

export default function MyDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [showRating, setShowRating] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [ratedDeliveries, setRatedDeliveries] = useState({});

  useEffect(() => {
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

    loadDeliveries();
  }, []);

  const openRating = (d) => {
    setSelectedDelivery(d);
    setShowRating(true);
  };

  const markRated = (deliveryId) => {
    setRatedDeliveries((prev) => ({ ...prev, [deliveryId]: true }));
  };

  return (
    <div className="container mt-5">
      <h2>My Deliveries</h2>

      {deliveries.map((d) => (
        <div className="card p-3 mb-3" key={d.id}>
          <h5>{d.itemType} ({d.size})</h5>
          <p>
            <strong>Pickup:</strong> {d.pickup} <br />
            <strong>Dropoff:</strong> {d.dropoff} <br />
            <strong>Status:</strong> {d.status}
          </p>

          {d.status === "delivered" &&
            d.requests?.length > 0 &&
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
          receiverId={selectedDelivery.requests[0].travelerId}
          onRated={markRated}
          onClose={() => setShowRating(false)}
        />
      )}
    </div>
  );
}
