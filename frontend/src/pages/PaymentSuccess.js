import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const deliveryId = params.get("deliveryId");

  useEffect(() => {
    // You can also mark delivery as 'paid' via an API call or let webhook handle it
    setTimeout(() => {
      navigate("/dashboard");
    }, 3000);
  }, [navigate]);

  return (
    <div className="container mt-5 text-center">
      <h2>🎉 Payment Successful!</h2>
      <p>Thank you for your payment. Delivery ID: {deliveryId}</p>
      <p>Redirecting you to dashboard...</p>
    </div>
  );
}
