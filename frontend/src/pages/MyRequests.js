import { useEffect, useState } from "react";
import API from "../services/api";

export default function MatchesForTraveler() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get("/match/matches-for-traveler");
        setMatches(res.data);
      } catch (err) {
        console.error("Fetch failed", err);
      }
    };

    fetch();
  }, []);

  const handleAccept = async (deliveryId) => {
    try {
      await API.patch(`/deliveries/${deliveryId}/accept`);
      setMatches((prev) =>
        prev.map((d) =>
          d.id === deliveryId ? { ...d, status: "accepted" } : d
        )
      );
    } catch (err) {
      console.error("Accept failed", err);
      alert("Failed to accept request");
    }
  };  

  const handleComplete = async (deliveryId) => {
    try {
      await API.patch(`/deliveries/${deliveryId}/complete`);
      setMatches((prev) =>
        prev.map((d) =>
          d.id === deliveryId ? { ...d, status: "delivered" } : d
        )
      );
    } catch (err) {
      console.error("Complete failed", err);
      alert("Failed to mark as delivered");
    }
  };

  return (
    <div className="container mt-4">
      <h2>Delivery Requests Matching Your Trips</h2>
      {matches.length === 0 ? (
        <p>No matching delivery requests.</p>
      ) : (
        matches.map((d) => (
          <div className="card my-3" key={d.id}>
            <div className="card-body">
              <h5>From: {d.sender.name} ({d.sender.email})</h5>
              <p>
                <strong>Pickup:</strong> {d.pickup}<br />
                <strong>Dropoff:</strong> {d.dropoff}<br />
                <strong>Item:</strong> {d.itemType} ({d.size})<br />
                <strong>Weight:</strong> {d.weight} kg<br />
                <strong>Status:</strong> {d.status}
              </p>

              {/* Action Buttons */}
              {d.status === "pending" && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleAccept(d.id)}
                >
                  Accept Delivery
                </button>
              )}

              {d.status === "accepted" && (
                <>
                  <button
                    className="btn btn-warning"
                    onClick={() => handleComplete(d.id)}
                  >
                    Mark as Delivered
                  </button>

                  <a
                    href={`/chat/${d.id}`}
                    className="btn btn-outline-success ms-2"
                  >
                    💬 Message Sender
                  </a>
                </>
              )}

              {d.status === "delivered" && (
                <span className="badge bg-success">Delivered</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
