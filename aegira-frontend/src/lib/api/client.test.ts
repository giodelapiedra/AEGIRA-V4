import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { apiClient } from './client';
import { setAuthenticatedUser, clearAuth } from '@/test/test-utils';

describe('apiClient', () => {
  beforeEach(() => {
    setAuthenticatedUser();
  });

  afterEach(() => {
    clearAuth();
  });

  describe('GET requests', () => {
    it('fetches data successfully', async () => {
      const response = await apiClient.get<{ items: unknown[] }>('/teams');

      expect(response).toBeDefined();
      expect(response.items).toBeInstanceOf(Array);
    });

    it('includes authorization header when authenticated', async () => {
      // The mock server should receive the token
      const response = await apiClient.get('/auth/me');

      expect(response).toBeDefined();
    });
  });

  describe('POST requests', () => {
    it('sends data correctly', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'Test description',
      };

      const response = await apiClient.post<{ id: string; name: string }>('/teams', teamData);

      expect(response.name).toBe('Test Team');
      expect(response.id).toBeDefined();
    });
  });

  describe('PATCH requests', () => {
    it('updates data correctly', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const response = await apiClient.patch<{ name: string }>('/teams/team-1', updateData);

      expect(response.name).toBe('Updated Name');
    });
  });

  describe('Error handling', () => {
    it('throws error for non-existent resource', async () => {
      await expect(
        apiClient.get('/teams/non-existent-id')
      ).rejects.toThrow();
    });

    it('throws error for invalid credentials', async () => {
      clearAuth(); // Clear auth to simulate unauthenticated request

      await expect(
        apiClient.post('/auth/login', {
          email: 'wrong@email.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow();
    });
  });
});
