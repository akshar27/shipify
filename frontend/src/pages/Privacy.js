import LegalPage from "../components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      {({ company, email }) => (
        <>
          <h4>What we collect</h4>
          <ul>
            <li>Your name and email address, and a password (stored only as a one-way hash).</li>
            <li>A government ID document and the name on it, to check who you are before you can create or take deliveries.</li>
            <li>The details of your trips and deliveries: addresses, item description, size, weight and declared value.</li>
            <li>Messages you send to the other person in a delivery.</li>
            <li>Payment information is handled by Stripe. We never see or store your card number; we keep a record that a payment was made and its amount.</li>
          </ul>

          <h4>Who sees it</h4>
          <ul>
            <li><strong>Administrators</strong> at {company} see your ID document, only to verify you. It is stored privately and is not available to other users.</li>
            <li>The <strong>other person in a delivery</strong> sees your name, email and the delivery details.</li>
            <li><strong>Stripe</strong> processes payments. <strong>Google</strong> receives addresses to plot routes and match trips with deliveries.</li>
            <li>We do not sell your data.</li>
          </ul>

          <h4>How long we keep it</h4>
          <p>[State your retention periods here: for example, ID documents deleted a set time after verification, delivery records kept for a set time for disputes and accounting.]</p>

          <h4>Your choices</h4>
          <p>You can ask to see, correct or delete your data, or to close your account, by writing to {email}. Some records (such as payments) may have to be kept for legal or accounting reasons.</p>

          <h4>What your browser stores</h4>
          <p>When you sign in, your browser keeps a login token and a small copy of your profile (name, email, role) so the site works. We do not use advertising trackers.</p>

          <h4>Contact</h4>
          <p>{company}, {email}.</p>
        </>
      )}
    </LegalPage>
  );
}
