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

  // The traveler marks a package delivered by typing the 6-digit code the recipient reads out from the sender's app.
  const [codeFor, setCodeFor] = useState(null); // deliveryId whose code form is open
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");

  const handleComplete = async (deliveryId) => {
    setCodeError("");
    try {
      await API.patch(`/deliveries/${deliveryId}/complete`, { code });
      updateStatus(deliveryId, "delivered");
      setCodeFor(null);
      setCode("");
    } catch (err) {
      setCodeError(err.response?.data?.msg || "Could not mark as delivered");
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

                  {(d.status === "accepted" || d.status === "in-transit") && (
                    <>
                      {codeFor === d.id ? (
                        <div className="mb-2">
                          <label className="form-label">Ask the person receiving the package for their 6-digit code</label>
                          <div className="input-group" style={{ maxWidth: 320 }}>
                            <input
                              className="form-control"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="123456"
                              value={code}
                              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                            />
                            <button className="btn btn-warning" disabled={code.length !== 6} onClick={() => handleComplete(d.id)}>
                              Confirm
                            </button>
                            <button className="btn btn-outline-secondary" onClick={() => { setCodeFor(null); setCode(""); setCodeError(""); }}>
                              Cancel
                            </button>
                          </div>
                          {codeError && <div className="text-danger mt-1">{codeError}</div>}
                        </div>
                      ) : (
                        <button
                          className="btn btn-warning"
                          onClick={() => { setCodeFor(d.id); setCode(""); setCodeError(""); }}
                        >
                          Mark as Delivered
                        </button>
                      )}

                      <button
                        className="btn btn-outline-success ms-2"
                        onClick={() => handleMessageClick(d.id, sender)}
                      >
                        💬 Message Sender
                      </button>
                    </>
                  )}

                  {d.status === "delivered" && (
                    <span className="badge bg-success">Delivered. Waiting for the sender to confirm</span>
                  )}
                  {d.status === "confirmed" && (
                    <span className="badge bg-success">Confirmed. Your payout is being arranged</span>
                  )}
                  {d.status === "disputed" && (
                    <span className="badge bg-warning text-dark">Under review by support</span>
                  )}
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}
