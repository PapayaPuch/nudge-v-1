const api = {
  token: localStorage.getItem('nudgeToken') || '',
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`/api${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  setToken(token) {
    this.token = token;
    localStorage.setItem('nudgeToken', token);
  },
};
