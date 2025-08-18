import { useEffect, useState } from "react";
import API from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import DeliveryProgressBar from "../components/DeliveryProgressBar";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await API.get("/auth/me");
        setUser(res.data);
      } catch (err) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    };

    const fetchDashboardData = async () => {
      try {
        const res = await API.get("/dashboard/summary");
        setStats(res.data.stats);
        setRecentDeliveries(res.data.recentDeliveries);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    };

    fetchUser();
    fetchDashboardData();
  }, [navigate]);

  if (!user) return <p className="text-center mt-5">Loading...</p>;

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Welcome, {user.name}</h2>

      {/* Summary Cards */}
      <div className="row mb-4">
        <StatCard label="Total Trips" count={stats.totalTrips} />
        <StatCard label="Deliveries Sent" count={stats.totalDeliveries} />
        <StatCard label="In Transit" count={stats.inTransit} />
        <StatCard label="Delivered" count={stats.delivered} />
      </div>

      <Link to="/create-trip" className="btn btn-outline-primary mb-4">
        + Add New Trip
      </Link>

      {/* Recent Deliveries */}
      <h5>Recent Delivery Activity</h5>
      {recentDeliveries.length === 0 ? (
        <p>No recent deliveries found.</p>
      ) : (
        <div className="list-group">
          {recentDeliveries.map((d) => (
            <div key={d.id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>{d.itemType}</strong> ({d.size})<br />
                  {d.pickup} ➡️ {d.dropoff} | {d.weight}kg
                </div>
                <span className="badge bg-secondary text-capitalize">{d.status}</span>
              </div>

              <div className="mt-2">
                <DeliveryProgressBar status={d.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, count }) {
  return (
    <div className="col-md-3 mb-3">
      <div className="card text-center shadow-sm border-0">
        <div className="card-body">
          <h4 className="card-title">{count || 0}</h4>
          <p className="card-text">{label}</p>
        </div>
      </div>
    </div>
  );
}
