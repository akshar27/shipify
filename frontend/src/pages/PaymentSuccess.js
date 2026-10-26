import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../services/api";

const POLL_MS = 2000;
const MAX_POLLS = 20; // about 40 seconds for Stripe's webhook to arrive

// Stripe sends the browser here after checkout, but that redirect proves nothing: anyone can open this URL.
// A delivery counts as paid only when our server says so, which it does after verifying Stripe's signed webhook.
export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const deliveryId = params.get("deliveryId");
  const [state, setState] = useState("checking"); // checking | paid | slow | error

  useEffect(() => {
    if (!deliveryId) {
      setState("error");
      return undefined;
    }
    let cancelled = false;
    let polls = 0;
    let timer;

    const check = async () => {
      try {
        const res = await API.get(`/payments/delivery/${deliveryId}`);
        if (cancelled) return;
        if (res.data.paymentStatus === "paid") return setState("paid");
      } catch (err) {
        if (cancelled) return;
        if (err.response && err.response.status === 404) return setState("error");
      }
      polls += 1;
      if (polls >= MAX_POLLS) return setState("slow");
      timer = setTimeout(check, POLL_MS);
    };

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deliveryId]);

  return (
    <div className="container mt-5 text-center">
      {state === "checking" && (
        <>
          <h2>Confirming your payment...</h2>
          <p>This usually takes a few seconds.</p>
        </>
      )}
      {state === "paid" && (
        <>
          <h2>Payment confirmed</h2>
          <p>Your delivery is now visible to travelers on matching routes.</p>
          <Link to="/my-deliveries" className="btn btn-primary">View my deliveries</Link>
        </>
      )}
      {state === "slow" && (
        <>
          <h2>Still processing</h2>
          <p>We have not received confirmation from the payment provider yet. Check My Deliveries in a minute; you will not be charged twice.</p>
          <Link to="/my-deliveries" className="btn btn-primary">Go to my deliveries</Link>
        </>
      )}
      {state === "error" && (
        <>
          <h2>We could not find that payment</h2>
          <Link to="/my-deliveries" className="btn btn-primary">Go to my deliveries</Link>
        </>
      )}
    </div>
  );
}
