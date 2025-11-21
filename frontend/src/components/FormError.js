export default function FormError({ message }) {
    if (!message) return null;
  
    return (
      <div className="alert alert-danger py-2">
        {message}
      </div>
    );
  }
  