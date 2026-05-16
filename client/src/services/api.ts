export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  // We use credentials 'include' to pass the HTTP-only cookie automatically
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // We assume the demo login set a cookie, but we still need x-business-id for multi-tenancy.
    // In a real app, this might come from a context/store. For MVP/Sim, we will pass it dynamically if needed.
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { message: 'An unknown error occurred' };
    }
    throw new Error(error.error || error.message);
  }

  // Handle 204 No Content
  if (response.status === 204) return null;

  return response.json();
};
