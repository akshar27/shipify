import useCurrentUser from "../services/useCurrentUser";
import { useState, useRef, useEffect } from "react";
import API from "../services/api";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getRules, money } from "../services/legal";
import { loadStripe } from "@stripe/stripe-js";
import {
  GoogleMap,
  LoadScript,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";

// Initialize Stripe
// Only when a key is set: loadStripe(undefined) throws at import time and takes the whole app down.
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

const mapStyle = { height: "300px", width: "100%" };
const defaultCenter = { lat: 37.7749, lng: -122.4194 };

export default function CreateDelivery() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    itemType: "",
    size: "",
    weight: "",
    declaredValue: "",
  });
  const [contentsConfirmed, setContentsConfirmed] = useState(false);
  const [rules, setRules] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getRules().then(setRules).catch(() => {});
  }, []);

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLatLng, setPickupLatLng] = useState(null);
  const [dropoffLatLng, setDropoffLatLng] = useState(null);

  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);

  const { user, loading: userLoading } = useCurrentUser();
  if (userLoading) return <div className="container mt-5"><p>Loading...</p></div>;
  if (!user?.isVerified) {
    return <Navigate to="/upload-doc" />;
  }

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Travelers are matched by where the package is, so both places must be real points, not just typed text.
    if (!pickupAddress.trim() || !dropoffAddress.trim()) return setError("Enter both the pickup and the dropoff address.");
    if (!pickupLatLng || !dropoffLatLng) return setError("Pick each address from the suggestions (or click its spot on the map), so travelers can find your package.");
    try {
      const payload = {
        ...form,
        contentsConfirmed,
        pickup: pickupAddress,
        dropoff: dropoffAddress,
        pickupLat: pickupLatLng?.lat,
        pickupLng: pickupLatLng?.lng,
        dropoffLat: dropoffLatLng?.lat,
        dropoffLng: dropoffLatLng?.lng,
      };

      const res = await API.post("/deliveries", payload);
      const deliveryId = res.data.id; // the API returns the delivery itself, not { deliveryId }

      try {
        if (stripePromise) await stripePromise;
        // The server decides the price; the browser only says which delivery to pay for.
        const session = await API.post("/payments/create-checkout-session", { deliveryId });
        window.location.href = session.data.url;
      } catch (payErr) {
        // The delivery exists but is unpaid: it can be paid from My Deliveries.
        // Not an alert(): it blocks the page. Keep the message and take them to the delivery they can pay for.
        navigate("/my-deliveries", { state: { notice: (payErr.response?.data?.msg || "Payment could not be started") + " Your delivery was saved; press Pay now when you are ready." } });
      }
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to create delivery");
    }
  };

  const handlePlaceChanged = (type) => {
    const autocomplete = type === "pickup" ? pickupRef.current : dropoffRef.current;
    const place = autocomplete.getPlace();
    if (place.geometry) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      if (type === "pickup") {
        setPickupAddress(place.formatted_address);
        setPickupLatLng({ lat, lng });
      } else {
        setDropoffAddress(place.formatted_address);
        setDropoffLatLng({ lat, lng });
      }
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Create Delivery Request</h2>
      <form onSubmit={handleSubmit}>
        <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY} libraries={["places"]}>
        <div className="mb-3">
          <label><strong>Pickup Address:</strong></label>
            <Autocomplete onLoad={(a) => (pickupRef.current = a)} onPlaceChanged={() => handlePlaceChanged("pickup")}>
              <input
                className="form-control"
                placeholder="Enter pickup location"
                value={pickupAddress}
                onChange={(e) => { setPickupAddress(e.target.value); setPickupLatLng(null); }}
              />
            </Autocomplete>

            <GoogleMap
              mapContainerStyle={mapStyle}
              center={pickupLatLng || defaultCenter}
              zoom={pickupLatLng ? 13 : 11}
              onClick={(e) => {
                setPickupLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            >
              {pickupLatLng && <Marker position={pickupLatLng} />}
            </GoogleMap>
        </div>

        <div className="mb-3">
          <label><strong>Dropoff Address:</strong></label>
            <Autocomplete onLoad={(a) => (dropoffRef.current = a)} onPlaceChanged={() => handlePlaceChanged("dropoff")}>
              <input
                className="form-control"
                placeholder="Enter dropoff location"
                value={dropoffAddress}
                onChange={(e) => { setDropoffAddress(e.target.value); setDropoffLatLng(null); }}
              />
            </Autocomplete>

            <GoogleMap
              mapContainerStyle={mapStyle}
              center={dropoffLatLng || defaultCenter}
              zoom={dropoffLatLng ? 13 : 11}
              onClick={(e) => {
                setDropoffLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            >
              {dropoffLatLng && <Marker position={dropoffLatLng} />}
            </GoogleMap>
        </div>
        </LoadScript>

        <div className="mb-3">
          <input className="form-control" name="itemType" placeholder="Item Type (e.g. Laptop)" onChange={handleFormChange} required />
        </div>
        <div className="mb-3">
          <input className="form-control" name="size" placeholder="Size (e.g. Small/Medium/Large)" onChange={handleFormChange} required />
        </div>
        <div className="mb-3">
          <input className="form-control" name="weight" type="number" step="0.1" placeholder="Weight (kg)" onChange={handleFormChange} required />
        </div>

        <div className="mb-3">
          <label className="form-label">Declared value{rules ? ` (up to ${money(rules.maxItemValueCents, rules.currency)})` : ""}</label>
          <input className="form-control" name="declaredValue" type="number" min="1" step="0.01" placeholder="What the item is worth" onChange={handleFormChange} required />
        </div>

        <div className="form-check mb-3">
          <input className="form-check-input" type="checkbox" id="contents" checked={contentsConfirmed} onChange={(e) => setContentsConfirmed(e.target.checked)} />
          <label className="form-check-label" htmlFor="contents">
            I confirm this package contains nothing on the <Link to="/prohibited-items" target="_blank">prohibited items list</Link> and that the
            declared value is accurate.
          </label>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        <button type="submit" className="btn btn-primary w-100" disabled={!contentsConfirmed}>Create & Pay</button>
      </form>
    </div>
  );
}
