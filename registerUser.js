const axios = require('axios');

const registerUser = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/register', {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'Admin',
    });
    console.log('User registration successful:', response.data);
  } catch (error) {
    console.error('User registration failed:', JSON.stringify(error.response ? error.response.data : error.message, null, 2));
  }
};

registerUser();