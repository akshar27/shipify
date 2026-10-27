import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container mt-5 text-center">
      <h2>Page not found</h2>
      <p>That page does not exist.</p>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </div>
  );
}
