import fetch from 'node-fetch';

const registerUser = async () => {
  const url = 'http://localhost:3000/auth/register';
  const user = {
    firstName: 'Test',
    lastName: 'User',
    email: `test${Date.now()}@example.com`,
    phone: '+1234567890',
    password: 'password123',
    accountType: 'personal'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

registerUser();
