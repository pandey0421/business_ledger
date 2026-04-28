import { supabase } from '../supabaseClient';

let cachedUser = null;

export const authService = {
  /**
   * Listen for Auth State changes
   */
  onAuthStateChanged(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        cachedUser = session?.user || null;
        callback(session?.user || null);
      }
    );
    return () => subscription.unsubscribe();
  },

  /**
   * Login with email and password
   */
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw this._mapError(error);
    cachedUser = data?.user || null;
    return data;
  },

  /**
   * Signup new user
   */
  async signup(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) throw this._mapError(error);
    cachedUser = data?.user || null;
    return data;
  },

  /**
   * Password Reset
   */
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw this._mapError(error);
  },

  /**
   * Resend Verification
   */
  async sendVerification(email) {
    // Supabase handles this automatically on signup.
    // If needed: await supabase.auth.resend({ type: 'signup', email })
  },

  _mapError(error) {
     // Map Supabase errors to Firebase-like error codes so Login UI doesn't break
     const msg = error.message.toLowerCase();
     if (msg.includes('invalid login credentials')) return { code: 'auth/wrong-password', message: error.message };
     if (msg.includes('user already registered')) return { code: 'auth/email-already-in-use', message: error.message };
     if (msg.includes('password should be')) return { code: 'auth/weak-password', message: error.message };
     return { code: 'auth/unknown', message: error.message };
  },

  /**
   * Logout the current user
   */
  async logout() {
    cachedUser = null;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current synced user
   */
  async getCurrentUser() {
    if (cachedUser) {
      return { data: { user: cachedUser }, error: null };
    }
    const result = await supabase.auth.getUser();
    cachedUser = result.data?.user || null;
    return result;
  }
};
