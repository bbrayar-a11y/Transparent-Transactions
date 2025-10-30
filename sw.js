```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Transparent Transaction</title>
  <link rel="manifest" href="manifest.json">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial; background: #f0f4f8; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
    header { background: #1976d2; color: white; width: 100%; text-align: center; padding: 1.2rem; }
    .container { width: 90%; max-width: 420px; background: white; margin: 1rem; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    input, button { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
    button { background: #1976d2; color: white; border: none; font-weight: bold; cursor: pointer; }
    button:hover { background: #1565c0; }
    .hidden { display: none; }
    ul { list-style: none; margin-top: 15px; }
    li { background: #e3f2fd; padding: 10px; margin: 6px 0; border-radius: 8px; font-size: 0.95rem; }
    .logout { background: #d32f2f; margin-top: 15px; }
    .status { font-size: 0.9rem; color: #666; margin: 10px 0; }
  </style>
</head>
<body>
  <header>
    <h2>Transparent Transaction</h2>
    <p>One-tap debt transfer</p>
  </header>

  <div class="container">
    <!-- Login -->
    <div id="login">
      <p class="status">Enter phone to get OTP via SMS</p>
      <input id="phone" placeholder="Phone (10 digits)" maxlength="10" inputmode="numeric">
      <button onclick="sendLocalOTP()">Send OTP via SMS</button>
      <input id="otp" class="hidden" placeholder="Enter 6-digit OTP" maxlength="6" inputmode="numeric">
      <button id="verifyBtn" class="hidden" onclick="verifyLocalOTP()">Verify OTP</button>
      <p id="otpStatus" class="status hidden"></p>
    </div>

    <!-- App -->
    <div id="app" class="hidden">
      <p><strong id="userPhone"></strong></p>
      <input id="name" placeholder="Name">
      <input id="amount" type="number" placeholder="Amount (₹)" inputmode="numeric">
      <button onclick="addEntry()">Add Transaction</button>
      <ul id="ledger"></ul>
      <button class="logout" onclick="logout()">Logout</button>
    </div>
  </div>

  <script>
    let currentUserPhone = '';
    let generatedOTP = '';

    // Generate 6-digit OTP
    function generateOTP() {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Open phone's SMS app
    function sendLocalOTP() {
      const phone = document.getElementById('phone').value.trim();
      if (!/^\d{10}$/.test(phone)) return alert('Enter 10-digit phone');

      currentUserPhone = '+91' + phone;
      generatedOTP = generateOTP();

      const message = `Your OTP for Transparent Transaction is ${generatedOTP}. Do not share.`;
      const smsUrl = `sms:${currentUserPhone}?body=${encodeURIComponent(message)}`;

      // Open SMS app
      window.location.href = smsUrl;

      // Show OTP input after 2 sec
      setTimeout(() => {
        document.getElementById('otp').classList.remove('hidden');
        document.getElementById('verifyBtn').classList.remove('hidden');
        document.getElementById('otpStatus').textContent = 'SMS opened! Send it.';
        document.getElementById('otpStatus').classList.remove('hidden');
      }, 2000);
    }

    // Verify OTP (user types it)
    function verifyLocalOTP() {
      const otp = document.getElementById('otp').value.trim();
      if (otp === generatedOTP) {
        document.getElementById('login').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('userPhone').textContent = currentUserPhone;
        loadLedger();
      } else {
        alert('Wrong OTP! Try again.');
      }
    }

    // Load Ledger
    function loadLedger() {
      const key = 'ledger_' + currentUserPhone;
      const saved = localStorage.getItem(key);
      const list = document.getElementById('ledger');
      list.innerHTML = saved ? JSON.parse(saved).map(e => `<li>${e.name}: ₹${e.amount}</li>`).join('') : '';
    }

    // Add Entry
    function addEntry() {
      const name = document.getElementById('name').value.trim();
      const amount = parseFloat(document.getElementById('amount').value);
      if (!name || !amount) return alert('Enter name and amount');

      const entry = { name, amount };
      const key = 'ledger_' + currentUserPhone;
      const ledger = JSON.parse(localStorage.getItem(key) || '[]');
      ledger.push(entry);
      localStorage.setItem(key, JSON.stringify(ledger));
      loadLedger();

      document.getElementById('name').value = '';
      document.getElementById('amount').value = '';
    }

    // Logout
    function logout() {
      document.getElementById('app').classList.add('hidden');
      document.getElementById('login').classList.remove('hidden');
      document.getElementById('phone').value = '';
      document.getElementById('otp').value = '';
      document.getElementById('otp').classList.add('hidden');
      document.getElementById('verifyBtn').classList.add('hidden');
      document.getElementById('otpStatus').classList.add('hidden');
      currentUserPhone = '';
      generatedOTP = '';
    }

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js');
    }
  </script>
</body>
</html>
```