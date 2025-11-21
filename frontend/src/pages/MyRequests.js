import { useEffect, useState, useContext } from "react";
import API from "../services/api";
import { ChatContext } from "../context/ChatContext";

export default function MatchesForTraveler() {
  const [matches, setMatches] = useState([]);

  // 👇 Access global chat context
  const { setOpenChats } = useContext(ChatContext);

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

  const updateStatus = (deliveryId, newStatus) => {
    setMatches((prev) =>
      prev.map((m) => {
        if (m.delivery?.id === deliveryId) {
          return {
            ...m,
            delivery: {
              ...m.delivery,
              status: newStatus,
            },
          };
        }
        return m;
      })
    );
  };

  const handleAccept = async (deliveryId) => {
    try {
      await API.patch(`/deliveries/${deliveryId}/accept`);
      updateStatus(deliveryId, "accepted");
    } catch (err) {
      console.error("Accept failed", err);
      alert("Failed to accept request");
    }
  };

  const handleComplete = async (deliveryId) => {
    try {
      await API.patch(`/deliveries/${deliveryId}/complete`);
      updateStatus(deliveryId, "delivered");
    } catch (err) {
      console.error("Complete failed", err);
      alert("Failed to mark as delivered");
    }
  };

  const handleMessageClick = (deliveryId, sender) => {
    if (!sender?.id) {
      alert("Sender ID not found. Cannot open chat.");
      return;
    }

    // 💬 Open chat tab globally
    setOpenChats((prev) => ({
      ...prev,
      [deliveryId]: {
        receiverId: sender.id,
        senderName: sender.name || "Sender",
      },
    }));
  };

  return (
    <div className="container mt-4">
      <h2>Delivery Requests Matching Your Trips</h2>

      {matches.length === 0 ? (
        <p>No matching delivery requests.</p>
      ) : (
        matches
          .filter((m) => m.delivery)
          .map((m) => {
            const d = m.delivery;
            const sender = d.sender || {};

            return (
              <div className="card my-3" key={d.id}>
                <div className="card-body">
                  <h5>
                    From: {sender.name || "Unknown"} ({sender.email || "N/A"})
                  </h5>
                  <p>
                    <strong>Pickup:</strong> {d.pickup || "N/A"} <br />
                    <strong>Dropoff:</strong> {d.dropoff || "N/A"} <br />
                    <strong>Item:</strong> {d.itemType || "N/A"} ({d.size || "N/A"})<br />
                    <strong>Weight:</strong> {d.weight || "N/A"} kg<br />
                    <strong>Status:</strong> {d.status || "N/A"}
                  </p>

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

                      <button
                        className="btn btn-outline-success ms-2"
                        onClick={() => handleMessageClick(d.id, sender)}
                      >
                        💬 Message Sender
                      </button>
                    </>
                  )}

                  {d.status === "delivered" && (
                    <span className="badge bg-success">Delivered</span>
                  )}
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}
