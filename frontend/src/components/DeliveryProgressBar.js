// components/DeliveryProgressBar.jsx
export default function DeliveryProgressBar({ status }) {
    const steps = ["pending", "accepted", "in-transit", "delivered"];
    const currentStep = steps.indexOf(status);
  
    return (
      <div className="progress" style={{ height: "22px", fontSize: "12px" }}>
        {steps.map((step, index) => (
          <div
            key={step}
            className={`progress-bar ${index <= currentStep ? "bg-success" : "bg-light text-dark"}`}
            style={{ width: `${100 / steps.length}%` }}
            role="progressbar"
          >
            {step.replace("-", " ")}
          </div>
        ))}
      </div>
    );
  }
  