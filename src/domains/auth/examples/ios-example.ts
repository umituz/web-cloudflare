/**
 * iOS / React Native Integration Example
 * @description Example implementation for iOS app with device-based authentication
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ============================================================
// Device ID Service (iOS)
// ============================================================

interface DeviceInfo {
  deviceId: string;
  model: string;
  os: string;
  osVersion: string;
  appVersion: string;
}

class DeviceInfoService {
  /**
   * Get device ID from iOS
   * Uses UIDevice.current.identifierForVendor on iOS
   */
  async getDeviceId(): Promise<string> {
    if (Platform.OS === 'ios') {
      // For React Native, you'd use a native module
      // For example, using react-native-device-info:
      // import DeviceInfo from 'react-native-device-info';
      // return await DeviceInfo.getUniqueId();

      // For Swift, this would be:
      // UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString

      return 'ios-device-id-12345'; // Placeholder
    }

    // Android fallback
    return 'android-device-id-67890';
  }

  /**
   * Get complete device info
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const deviceId = await this.getDeviceId();

    return {
      deviceId,
      model: Platform.OS === 'ios' ? 'iPhone' : 'Android',
      os: Platform.OS,
      osVersion: Platform.Version as string,
      appVersion: '1.0.0', // Get from app config
    };
  }
}

// ============================================================
// Auth Service (React Native)
// ============================================================

interface AuthResponse {
  user: {
    id: string;
    email: string | null;
    display_name: string | null;
    is_anonymous: boolean;
    credits_remaining: number;
  };
  session_token: string;
  expires_at: number;
}

interface AuthState {
  user: AuthResponse['user'] | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

class AuthService {
  private baseURL: string;
  private deviceInfoService: DeviceInfoService;
  private state: AuthState;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.deviceInfoService = new DeviceInfoService();
    this.state = {
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }

  // ============================================================
  // Device-Based Authentication
  // ============================================================

  /**
   * Register device and get anonymous user session
   * Call this when app first launches
   */
  async registerDevice(): Promise<AuthResponse> {
    try {
      this.state.isLoading = true;

      const deviceInfo = await this.deviceInfoService.getDeviceInfo();

      const response = await fetch(`${this.baseURL}/api/auth/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: deviceInfo.deviceId,
          device_info: {
            model: deviceInfo.model,
            os: deviceInfo.os,
            os_version: deviceInfo.osVersion,
            app_version: deviceInfo.appVersion,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Device registration failed');
      }

      const data: AuthResponse = await response.json();

      // Update state
      this.state.user = data.user;
      this.state.sessionToken = data.session_token;
      this.state.isAuthenticated = true;

      // Save to secure storage (Keychain on iOS)
      await this.saveCredentials(data);

      return data;
    } catch (error) {
      this.state.isLoading = false;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  // ============================================================
  // Account Upgrade
  // ============================================================

  /**
   * Upgrade anonymous user to real user with email/password
   */
  async upgradeAccount(params: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthResponse> {
    if (!this.state.sessionToken) {
      throw new Error('No active session. Please register device first.');
    }

    try {
      this.state.isLoading = true;

      const response = await fetch(`${this.baseURL}/api/auth/upgrade-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.sessionToken}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Account upgrade failed');
      }

      const data: AuthResponse = await response.json();

      // Update state
      this.state.user = data.user;
      this.state.sessionToken = data.session_token;

      // Update saved credentials
      await this.saveCredentials(data);

      return data;
    } finally {
      this.state.isLoading = false;
    }
  }

  // ============================================================
  // Traditional Authentication
  // ============================================================

  /**
   * Sign up new real user
   */
  async signUp(params: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthResponse> {
    try {
      this.state.isLoading = true;

      const response = await fetch(`${this.baseURL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Signup failed');
      }

      const data: AuthResponse = await response.json();

      // Update state
      this.state.user = data.user;
      this.state.sessionToken = data.session_token;
      this.state.isAuthenticated = true;

      // Save credentials
      await this.saveCredentials(data);

      return data;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Login with email/password
   */
  async login(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      this.state.isLoading = true;

      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data: AuthResponse = await response.json();

      // Update state
      this.state.user = data.user;
      this.state.sessionToken = data.session_token;
      this.state.isAuthenticated = true;

      // Save credentials
      await this.saveCredentials(data);

      return data;
    } finally {
      this.state.isLoading = false;
    }
  }

  // ============================================================
  // Session Management
  // ============================================================

  /**
   * Get current user info
   */
  async getMe(): Promise<AuthResponse['user'] | null> {
    if (!this.state.sessionToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.state.sessionToken}`,
        },
      });

      if (!response.ok) {
        // Session might be expired, clear credentials
        await this.clearCredentials();
        return null;
      }

      const data = await response.json();
      return data.user;
    } catch {
      return null;
    }
  }

  /**
   * Refresh session token
   */
  async refreshSession(): Promise<AuthResponse | null> {
    if (!this.state.sessionToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.state.sessionToken}`,
        },
      });

      if (!response.ok) {
        await this.clearCredentials();
        return null;
      }

      const data: AuthResponse = await response.json();

      // Update state
      this.state.user = data.user;
      this.state.sessionToken = data.session_token;

      // Update saved credentials
      await this.saveCredentials(data);

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    if (this.state.sessionToken) {
      try {
        await fetch(`${this.baseURL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.state.sessionToken}`,
          },
        });
      } catch {
        // Ignore logout errors
      }
    }

    // Clear local state
    await this.clearCredentials();
  }

  // ============================================================
  // Credits
  // ============================================================

  /**
   * Get credit balance
   */
  async getCreditBalance(): Promise<{
    remaining: number;
    totalGranted: number;
    totalConsumed: number;
  } | null> {
    if (!this.state.sessionToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/credits`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.state.sessionToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Consume credits
   */
  async consumeCredits(params: {
    amount: number;
    description: string;
  }): Promise<void> {
    if (!this.state.sessionToken) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.baseURL}/api/auth/credits/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.state.sessionToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to consume credits');
    }
  }

  // ============================================================
  // Storage Helpers
  // ============================================================

  /**
   * Save credentials to secure storage (Keychain on iOS)
   */
  private async saveCredentials(data: AuthResponse): Promise<void> {
    // For React Native, use react-native-keychain
    // import * as Keychain from 'react-native-keychain';

    const credentials = JSON.stringify({
      userId: data.user.id,
      sessionToken: data.session_token,
      expiresAt: data.expires_at,
    });

    // Example with react-native-keychain:
    // await Keychain.setGenericPassword(credentials, 'auth_credentials');

    // For demo purposes, use AsyncStorage (NOT SECURE for production)
    // import AsyncStorage from '@react-native-async-storage/async-storage';
    // await AsyncStorage.setItem('auth_credentials', credentials);

    console.log('Credentials saved:', credentials);
  }

  /**
   * Load credentials from secure storage
   */
  async loadCredentials(): Promise<AuthResponse | null> {
    // Example with react-native-keychain:
    // const credentials = await Keychain.getGenericPassword();
    // if (credentials) {
    //   return JSON.parse(credentials.password);
    // }

    // For demo purposes:
    // const credentials = await AsyncStorage.getItem('auth_credentials');
    // if (credentials) {
    //   return JSON.parse(credentials);
    // }

    return null;
  }

  /**
   * Clear credentials from secure storage
   */
  private async clearCredentials(): Promise<void> {
    this.state.user = null;
    this.state.sessionToken = null;
    this.state.isAuthenticated = false;

    // Example with react-native-keychain:
    // await Keychain.resetGenericPassword();

    // For demo purposes:
    // await AsyncStorage.removeItem('auth_credentials');
  }

  // ============================================================
  // Getters
  // ============================================================

  getState(): AuthState {
    return { ...this.state };
  }

  getUser(): AuthResponse['user'] | null {
    return this.state.user;
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }
}

// ============================================================
// Usage Example in React Native App
// ============================================================

/*
import React, { useEffect, useState } from 'react';
import { View, Text, Button, TextInput } from 'react-native';

const authService = new AuthService('https://your-worker.workers.dev');

function App() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(null);

  // App launch - register device
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Try to load existing credentials
      const saved = await authService.loadCredentials();

      if (saved) {
        setUser(saved.user);
      } else {
        // Register new device (anonymous user)
        const response = await authService.registerDevice();
        setUser(response.user);
        console.log('Anonymous user created with 10 free credits!');
      }
    } catch (error) {
      console.error('Auth init failed:', error);
    }
  };

  const handleUpgradeAccount = async (email: string, password: string) => {
    try {
      const response = await authService.upgradeAccount({
        email,
        password,
        displayName: 'John Doe',
      });
      setUser(response.user);
      console.log('Account upgraded successfully!');
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };

  const handleGetCredits = async () => {
    const balance = await authService.getCreditBalance();
    setCredits(balance);
  };

  return (
    <View>
      <Text>Welcome, {user?.display_name || 'Anonymous User'}!</Text>
      <Text>Credits: {user?.credits_remaining || 0}</Text>
      {user?.is_anonymous && (
        <Text>Upgrade your account to save your progress!</Text>
      )}
      <Button
        title="Get Credit Balance"
        onPress={handleGetCredits}
      />
    </View>
  );
}

export default App;
*/

export { AuthService, DeviceInfoService };
export type { AuthResponse, AuthState, DeviceInfo };
