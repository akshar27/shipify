import { Link } from "react-router-dom";
import LegalPage from "../components/LegalPage";
import { money } from "../services/legal";

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      {({ company, email, rules }) => (
        <>
          <h4>1. What this is</h4>
          <p>
            {company} runs a marketplace that connects people who want to send a small package (senders) with people already travelling that way
            (travelers). We are not a courier or a carrier. We provide the platform; the delivery itself is between the sender and the traveler.
          </p>

          <h4>2. Accounts and identity checks</h4>
          <p>
            You must be 18 or older and give accurate information. To create deliveries or take them you must pass an identity check: you upload a
            government ID, and an administrator reviews it. Keep your login private; you are responsible for what happens under your account.
          </p>

          <h4>3. What you may and may not send</h4>
          <p>
            You may only send items that are allowed. The full list of <Link to="/prohibited-items">prohibited items</Link> is part of these Terms.
            Items worth more than {rules ? money(rules.maxItemValueCents, rules.currency) : "the declared-value limit"} are not allowed. When you create a delivery you declare the item's
            value and confirm it is not prohibited. Declaring something falsely is a breach of these Terms and may be a crime.
          </p>

          <h4>4. Travelers' responsibilities</h4>
          <p>
            Travelers may refuse any package. You must not open a package, must not carry a prohibited item, and must hand the package over only to
            the person who gives you the handover code. You are responsible for the package while you carry it.
          </p>

          <h4>5. Payments and payouts</h4>
          <p>
            The sender pays the delivery fee shown at checkout through our payment provider (Stripe). We hold the fee until the delivery is
            completed. After the traveler enters the handover code the sender has 72 hours to confirm the delivery or report a problem; if they do
            neither it counts as confirmed. We then pay the traveler the fee minus the platform's share. Payouts are arranged by us and may take a
            few days.
          </p>

          <h4>6. Problems and refunds</h4>
          <p>
            If something goes wrong, the sender can report a problem in the app. We will review it and decide whether the fee is paid to the
            traveler or refunded to the sender. [Describe your refund policy and any compensation limits here.]
          </p>

          <h4>7. Our responsibility</h4>
          <p>
            [Have a lawyer write this section: what the service promises, what it does not, and how far your liability for lost or damaged packages
            goes.] Do not send anything you cannot afford to lose.
          </p>

          <h4>8. Ending your account</h4>
          <p>We may suspend or close accounts that break these Terms or put others at risk. You can ask us to close yours at any time.</p>

          <h4>9. Changes</h4>
          <p>
            When we change these Terms or the prohibited-items list we will ask you to accept the new version before you can create or take a delivery.
          </p>

          <h4>10. Contact</h4>
          <p>Questions or reports: {email}.</p>
        </>
      )}
    </LegalPage>
  );
}
