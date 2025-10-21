import React, { useState } from 'react';
import { ShoppingCart, CreditCard, CheckCircle, XCircle } from 'lucide-react';

export default function PayMongoOrderingSystem() {
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const products = [
    { id: 1, name: 'Adobo Meal', price: 150, image: '🍗' },
    { id: 2, name: 'Sinigang na Baboy', price: 180, image: '🍲' },
    { id: 3, name: 'Lechon Kawali', price: 200, image: '🥓' },
    { id: 4, name: 'Pancit Canton', price: 120, image: '🍜' },
    { id: 5, name: 'Halo-Halo', price: 80, image: '🍧' },
    { id: 6, name: 'Sisig', price: 160, image: '🍳' }
  ];

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity === 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const createPayMongoPayment = async () => {
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      alert('Please fill in all customer information');
      return;
    }

    setLoading(true);
    setPaymentStatus(null);

    try {
      // STEP 1: Create Payment Intent
      const amount = getTotalAmount() * 100; // Convert to centavos
      
      const paymentIntentResponse = await fetch('https://api.paymongo.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('pk_test_YOUR_PUBLIC_KEY_HERE:')
        },
        body: JSON.stringify({
          data: {
            attributes: {
              amount: amount,
              payment_method_allowed: ['card', 'gcash', 'paymaya'],
              payment_method_options: {
                card: { request_three_d_secure: 'any' }
              },
              currency: 'PHP',
              description: `Order from ${customerInfo.name}`,
              statement_descriptor: 'ORDERING SYSTEM'
            }
          }
        })
      });

      const paymentIntentData = await paymentIntentResponse.json();
      
      if (!paymentIntentResponse.ok) {
        throw new Error(paymentIntentData.errors?.[0]?.detail || 'Payment intent creation failed');
      }

      const clientKey = paymentIntentData.data.attributes.client_key;
      const paymentIntentId = paymentIntentData.data.id;

      // STEP 2: Create Payment Method (Card)
      const paymentMethodResponse = await fetch('https://api.paymongo.com/v1/payment_methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('pk_test_YOUR_PUBLIC_KEY_HERE:')
        },
        body: JSON.stringify({
          data: {
            attributes: {
              type: 'card',
              details: {
                card_number: '4343434343434345', // Test card
                exp_month: 12,
                exp_year: 25,
                cvc: '123'
              },
              billing: {
                name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone
              }
            }
          }
        })
      });

      const paymentMethodData = await paymentMethodResponse.json();
      
      if (!paymentMethodResponse.ok) {
        throw new Error(paymentMethodData.errors?.[0]?.detail || 'Payment method creation failed');
      }

      const paymentMethodId = paymentMethodData.data.id;

      // STEP 3: Attach Payment Method to Payment Intent
      const attachResponse = await fetch(`https://api.paymongo.com/v1/payment_intents/${paymentIntentId}/attach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('pk_test_YOUR_PUBLIC_KEY_HERE:')
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: paymentMethodId,
              client_key: clientKey,
              return_url: window.location.href
            }
          }
        })
      });

      const attachData = await attachResponse.json();
      
      if (!attachResponse.ok) {
        throw new Error(attachData.errors?.[0]?.detail || 'Payment attachment failed');
      }

      // Check payment status
      const status = attachData.data.attributes.status;
      
      if (status === 'succeeded') {
        setPaymentStatus('success');
        setCart([]);
        setCustomerInfo({ name: '', email: '', phone: '' });
        setShowCheckout(false);
      } else if (status === 'awaiting_next_action') {
        // Handle 3D Secure - redirect to next_action URL
        const nextActionUrl = attachData.data.attributes.next_action?.redirect?.url;
        if (nextActionUrl) {
          window.location.href = nextActionUrl;
        }
      } else {
        setPaymentStatus('failed');
      }

    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-orange-600">🍴 Pinoy Food Ordering</h1>
              <p className="text-gray-600 mt-1">PayMongo Test Mode Integration</p>
            </div>
            <div className="flex items-center gap-2 bg-orange-100 px-4 py-2 rounded-full">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
              <span className="font-bold text-orange-600">{cart.length}</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Products */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Menu</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {products.map(product => (
                  <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="text-6xl text-center mb-3">{product.image}</div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-orange-600 font-bold text-xl mb-3">₱{product.price}</p>
                    <button
                      onClick={() => addToCart(product)}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Your Order</h2>
              
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Walang order pa</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between border-b pb-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-600">₱{item.price} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span className="text-orange-600">₱{getTotalAmount()}</span>
                    </div>
                  </div>

                  {!showCheckout ? (
                    <button
                      onClick={() => setShowCheckout(true)}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition"
                    >
                      <CreditCard className="w-5 h-5" />
                      Proceed to Checkout
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      
                      <button
                        onClick={createPayMongoPayment}
                        disabled={loading}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold transition"
                      >
                        {loading ? 'Processing...' : 'Pay with PayMongo'}
                      </button>
                      
                      <button
                        onClick={() => setShowCheckout(false)}
                        className="w-full text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Payment Status */}
              {paymentStatus === 'success' && (
                <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Payment successful!</span>
                </div>
              )}
              
              {(paymentStatus === 'failed' || paymentStatus === 'error') && (
                <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  <span>Payment failed. Please try again.</span>
                </div>
              )}

              {/* Test Mode Notice */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-semibold text-yellow-800 mb-2">🧪 TEST MODE</p>
                <p className="text-xs text-yellow-700">
                  Using test card: 4343434343434345
                  <br />CVC: 123, Exp: 12/25
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-3">📝 Setup Instructions:</h3>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Mag-sign up sa <a href="https://dashboard.paymongo.com/signup" target="_blank" rel="noopener noreferrer" className="underline">PayMongo Dashboard</a></li>
            <li>Kumuha ng Test API Keys (Public at Secret)</li>
            <li>Palitan ang "pk_test_YOUR_PUBLIC_KEY_HERE" sa code ng actual public test key</li>
            <li>Para sa production, gumamit ng Secret Key sa backend (hindi sa frontend!)</li>
            <li>Test cards: 4343434343434345 (success), 4571736000000075 (3D Secure)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}