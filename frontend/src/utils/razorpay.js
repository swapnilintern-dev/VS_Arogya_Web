// =============================================================================
// Razorpay Checkout (web). Loads checkout.js on demand and opens the sheet for
// an order the SERVER minted (POST /create-payment/:id). Resolves with the
// three fields POST /verify-payment needs; the server checks the signature.
// =============================================================================

const SDK_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let sdkPromise = null;

function loadSdk() {
  if (window.Razorpay) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => { sdkPromise = null; reject(new Error('Could not load Razorpay. Check your connection and try again.')); };
      document.body.appendChild(script);
    });
  }
  return sdkPromise;
}

/**
 * Opens the Razorpay sheet. Resolves { razorpay_order_id, razorpay_payment_id,
 * razorpay_signature } on success; rejects when the user closes the sheet or
 * the payment fails.
 */
export async function openRazorpayCheckout({ key, amount, currency = 'INR', orderId, name, description, prefill = {} }) {
  if (!key || !orderId) throw new Error('Payment could not be started.');
  await loadSdk();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key,
      amount,
      currency,
      order_id: orderId,
      name,
      description,
      prefill,
      theme: { color: '#2E7D5E' },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment window closed before completing.')) },
    });
    rzp.on('payment.failed', (e) => reject(new Error(e?.error?.description || 'Payment failed.')));
    rzp.open();
  });
}
