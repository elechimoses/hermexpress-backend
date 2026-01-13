import fetch from 'node-fetch';

const verifyOtp = async () => {
  // Usage: node scripts/test-verify-otp.js <email> <code>
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node scripts/test-verify-otp.js <email> <code>');
    process.exit(1);
  }

  const email = args[0];
  const code = args[1];

  const url = 'http://localhost:3000/auth/verify-email';
  const body = { email, code };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

verifyOtp();
