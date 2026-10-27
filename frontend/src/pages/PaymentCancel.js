import { Link } from "react-router-dom";

// Stripe sends people here when they back out of Checkout. Nothing was charged and the delivery stays unpaid.
export default function PaymentCancel() {
  return (
    <div className="container mt-5 text-center">
      <h2>Payment cancelled</h2>
      <p>You have not been charged. Your delivery is saved, and travelers will see it once it is paid.</p>
      <Link to="/my-deliveries" className="btn btn-primary">Back to my deliveries</Link>
    </div>
  );
}
