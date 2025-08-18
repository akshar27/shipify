import { Link, useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa"; // import icon

export default function Navbar() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary px-3">
      <div className="container-fluid">
        <span
          className="navbar-brand fw-bold"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(token ? (user?.role === "admin" ? "/admin" : "/dashboard") : '/')}
        >
          Shipify
        </span>

        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-center">

            {/* No user logged in */}
            {!token && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/signup">Sign Up</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Login</Link>
                </li>
              </>
            )}

            {/* Logged in as Admin */}
            {token && user?.role === "admin" && (
              <li className="nav-item">
                <button onClick={handleLogout} className="btn btn-sm btn-light">
                  Logout
                </button>
              </li>
            )}

            {/* Logged in as Regular User */}
            {token && user?.role !== "admin" && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/create-delivery">Create Delivery</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/create-trip">Create Trip</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/my-deliveries">My Deliveries</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/my-requests">Requests to Me</Link>
                </li>

                {/* 🔵 Profile icon */}
                <li className="nav-item ms-3">
                  <Link to="/profile" className="nav-link">
                    <FaUserCircle size={24} color="white" />
                  </Link>
                </li>

                <li className="nav-item">
                  <button onClick={handleLogout} className="btn btn-sm btn-light ms-3">
                    Logout
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
