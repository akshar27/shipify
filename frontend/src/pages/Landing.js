import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="container-fluid bg-primary text-white vh-100 d-flex flex-column justify-content-center align-items-center text-center">
      <h1 className="display-3 fw-bold">Shipify</h1>
      <p className="lead w-75">
        Send and receive packages using people already traveling between cities.
        Save fuel, time, and earn rewards while helping others.
      </p>
      <div className="mt-4">
        <Link to="/signup" className="btn btn-light btn-lg me-3">Sign Up</Link>
        <Link to="/login" className="btn btn-outline-light btn-lg">Login</Link>
      </div>
    </div>
  );
}
