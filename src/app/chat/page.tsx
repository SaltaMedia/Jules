import { jwtDecode } from 'jwt-decode';

function getUserIdFromToken() {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        return decoded.userId;
      } catch (e) { return null; }
    }
  }
  return null;
} 