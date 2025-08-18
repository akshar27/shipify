import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import axios from "axios";

export default function MatchTrips() {
  const { deliveryId } = useParams();
  const [trips, setTrips] = useState([]);
  const [message, setMessage] = useState("");

  // ✅ Load user from localStorage
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/match/${deliveryId}`);
        setTrips(res.data);
      } catch (err) {
        console.error("Failed to fetch matches", err);
      }
    };

    fetchMatches();
  }, [deliveryId]);

  // ✅ Redirect unverified users (after hooks)
  if (!user?.isVerified) {
    return <Navigate to="/upload-doc" />;
  }

  const handleRequest = async (travelerId) => {
    try {
      await axios.post("http://localhost:5000/api/request", {
        deliveryId,
        travelerId,
      });
      setMessage("Request sent successfully!");
    } catch (err) {
      setMessage("Failed to send request or already requested.");
      console.error(err);
    }
  };

  return (
    <div className="container mt-4">
      <h3>Matching Trips for Your Delivery</h3>
      {message && <div className="alert alert-info mt-3">{message}</div>}
      {trips.length === 0 ? (
        <p>No matching trips found.</p>
      ) : (
        trips.map((trip) => (
          <div key={trip.id} className="card my-3">
            <div className="card-body">
              <h5 className="card-title">Trip by {trip.traveler.name}</h5>
              <p className="card-text">
                <strong>From:</strong> {trip.start} <br />
                <strong>To:</strong> {trip.end} <br />
                <strong>Departure:</strong> {new Date(trip.departure).toLocaleString()}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => handleRequest(trip.traveler.id)}
              >
                Request to Book
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
