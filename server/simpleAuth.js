import jwt from 'jsonwebtoken';

// Simple in-memory user store
const users = [
  {
    id: 1,
    username: 'trauma admin',
    password: 'JHiidj12££',
    isAdmin: true
  }
];

const JWT_SECRET = 'your-secret-key';

export const authenticate = (username, password) => {
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return null;
  
  const token = jwt.sign(
    { id: user.id, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  
  const { password: _, ...userWithoutPassword } = user;
  return { token, user: userWithoutPassword };
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const getUserById = (id) => {
  const user = users.find(u => u.id === id);
  if (!user) return null;
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};
