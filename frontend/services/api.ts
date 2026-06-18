/**
 * RNTBCI Smart Home Digital Twin - API Service Layer
 *
 * Central API client for all backend communication.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

class APIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, token } = options;
    const authToken = token || this.token;

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ access_token: string; refresh_token: string; token_type: string }>(
      '/api/v1/auth/login', { method: 'POST', body: { email, password } }
    );
  }

  async register(data: { email: string; username: string; password: string; first_name: string; last_name: string }) {
    return this.request('/api/v1/auth/register', { method: 'POST', body: data });
  }

  async refreshToken(refreshToken: string) {
    return this.request<{ access_token: string; refresh_token: string; token_type: string }>(
      '/api/v1/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken } }
    );
  }

  async logout() {
    return this.request('/api/v1/auth/logout', { method: 'POST' });
  }

  async getProfile() {
    return this.request('/api/v1/auth/me');
  }

  // Devices
  async getDevices(params?: { room_id?: string; device_type?: string; status?: string; search?: string; page?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) query.set(k, String(v)); });
    }
    return this.request(`/api/v1/devices?${query}`);
  }

  async getDevice(id: string) {
    return this.request(`/api/v1/devices/${id}`);
  }

  async createDevice(data: unknown) {
    return this.request('/api/v1/devices', { method: 'POST', body: data });
  }

  async updateDevice(id: string, data: unknown) {
    return this.request(`/api/v1/devices/${id}`, { method: 'PATCH', body: data });
  }

  async deleteDevice(id: string) {
    return this.request(`/api/v1/devices/${id}`, { method: 'DELETE' });
  }

  async controlDevice(id: string, command: string, parameters: Record<string, unknown> = {}) {
    return this.request(`/api/v1/devices/${id}/control`, { method: 'PATCH', body: { command, parameters } });
  }

  async togglePower(id: string, powerState: string) {
    return this.request(`/api/v1/devices/${id}/power`, { method: 'PATCH', body: { power_state: powerState } });
  }

  async getDeviceState(id: string) {
    return this.request(`/api/v1/devices/${id}/state`);
  }

  async getDeviceEnergy(id: string, limit = 100) {
    return this.request(`/api/v1/devices/${id}/energy?limit=${limit}`);
  }

  async getDeviceEvents(id: string, params?: { severity?: string; page?: number }) {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, String(v)); });
    return this.request(`/api/v1/devices/${id}/events?${query}`);
  }

  // Dashboard
  async getDashboard() {
    return this.request('/api/v1/dashboard/realtime');
  }

  // Energy
  async getEnergySummary(period = 'day') {
    return this.request(`/api/v1/energy/summary?period=${period}`);
  }

  // Events
  async getEvents(params?: { severity?: string; search?: string; page?: number }) {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, String(v)); });
    return this.request(`/api/v1/events?${query}`);
  }

  // Alerts
  async getAlerts(acknowledged?: boolean) {
    const query = acknowledged !== undefined ? `?acknowledged=${acknowledged}` : '';
    return this.request(`/api/v1/alerts${query}`);
  }

  async acknowledgeAlert(id: string) {
    return this.request(`/api/v1/alerts/${id}`, { method: 'PATCH', body: { acknowledged: true } });
  }

  // Rooms
  async getRooms() {
    return this.request('/api/v1/rooms');
  }

  // Simulation
  async getSimulationStatus() {
    return this.request('/api/v1/simulation/status');
  }

  async controlSimulation(action: string, speed?: number) {
    return this.request('/api/v1/simulation/control', { method: 'POST', body: { action, speed } });
  }

  async startReplay(startTime: string, endTime: string, speed = 1) {
    return this.request('/api/v1/simulation/replay', {
      method: 'POST', body: { start_time: startTime, end_time: endTime, speed },
    });
  }

  async stopReplay() {
    return this.request('/api/v1/simulation/replay/stop', { method: 'POST' });
  }

  async getSimulationMetrics() {
    return this.request('/api/v1/simulation/metrics');
  }

  // Scenarios
  async getScenarios() {
    return this.request('/api/v1/scenarios');
  }

  async activateScenario(scenarioId: string) {
    return this.request('/api/v1/scenarios/activate', { method: 'POST', body: { scenario_id: scenarioId } });
  }

  async deactivateScenario(scenarioId: string) {
    return this.request('/api/v1/scenarios/deactivate', { method: 'POST', body: { scenario_id: scenarioId } });
  }

  // HEMS
  async getHEMSStatus() {
    return this.request('/api/v1/hems/status');
  }

  async runHEMSAnalysis() {
    return this.request('/api/v1/hems/analyze');
  }

  // Time Travel
  async getTimeTravelPresets() {
    return this.request('/api/v1/timetravel/presets');
  }

  async startTimeTravel(startTime: string, endTime: string, speed = 1) {
    return this.request('/api/v1/timetravel/start', {
      method: 'POST', body: { start_time: startTime, end_time: endTime, speed },
    });
  }

  async stopTimeTravel() {
    return this.request('/api/v1/timetravel/stop', { method: 'POST' });
  }

  // Pipeline
  async runPipeline() {
    return this.request('/api/v1/pipeline/run');
  }

  async getPipelineLatest() {
    return this.request('/api/v1/pipeline/latest');
  }

  // Health
  async healthCheck() {
    return this.request('/health');
  }
}

export const api = new APIClient(API_BASE);
export default api;
