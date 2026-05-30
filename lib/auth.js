import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from '@/lib/supabase';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Upsert user into Supabase on every sign-in
      const db = supabaseAdmin();
      const { error } = await db.from('users').upsert(
        {
          email: user.email,
          name: user.name,
          avatar_url: user.image,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
      if (error) console.error('[NextAuth] upsert user error:', error.message);
      return true;
    },
    async session({ session }) {
      // Attach Supabase user id to session
      const db = supabaseAdmin();
      const { data } = await db
        .from('users')
        .select('id, onboarded')
        .eq('email', session.user.email)
        .single();
      if (data) {
        session.user.id = data.id;
        session.user.onboarded = data.onboarded;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
};

export default NextAuth(authOptions);
