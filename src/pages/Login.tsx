import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, Camera, User } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = React.useState(true);
  const [formData, setFormData] = React.useState({ email: '', password: '', name: '' });
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  // Avatar states
  const [profilePicUrl, setProfilePicUrl] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dffkrlv1k';
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'relateos_uploads';

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: uploadData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image to Cloudinary');
      }

      const data = await response.json();
      setProfilePicUrl(data.secure_url);
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setUploadError('Failed to upload option. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        // If skipped, assign a clean, aesthetic letter-initial avatar background placeholder based on their Full Name.
        const finalProfilePic = profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'User')}&background=10b981&color=fff&size=256&bold=true`;

        await setDoc(doc(db, 'users', user.uid), {
          id: user.uid,
          email: formData.email,
          name: formData.name,
          profile_picture_url: finalProfilePic,
          notification_time: '09:00',
          notification_settings: {
            birthdays: true,
            tasks: true,
            groups: true
          },
          created_at: new Date().toISOString()
        });
      }
      const redirectTo = (location.state as any)?.redirectTo || '/';
      navigate(redirectTo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      const redirectTo = (location.state as any)?.redirectTo || '/';
      navigate(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 pt-[var(--sat)]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 mb-4">
            <Heart size={32} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">RelateOS</h1>
          <p className="text-zinc-500">Relationship Intelligence Platform</p>
        </div>

        <div className="space-y-4 bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-4">
                {/* Upload Profile Picture section */}
                <div className="flex flex-col items-center space-y-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Upload Profile Picture</span>
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center transition-all duration-300 relative shadow-inner">
                      {profilePicUrl ? (
                        <img src={profilePicUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : formData.name ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-500 text-white text-3xl font-black uppercase">
                          {formData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      ) : (
                        <User size={40} className="text-zinc-400 animate-pulse" />
                      )}
                      
                      {isUploading && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 flex items-center justify-center text-white text-[9px] font-bold">
                          <span>Uploading...</span>
                        </div>
                      )}
                    </div>
                    
                    <label className="absolute bottom-0 right-0 p-2 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-full shadow-md cursor-pointer hover:scale-110 transition-transform">
                      <Camera size={14} />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleAvatarUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                  
                  {uploadError && <p className="text-red-500 text-[10px] font-medium">{uploadError}</p>}
                  {profilePicUrl && (
                    <button 
                      type="button" 
                      onClick={() => setProfilePicUrl('')}
                      className="text-[10px] uppercase font-bold tracking-wider text-red-500 hover:underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Smayan Sri"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-400">Email Address</label>
              <input
                type="email"
                required
                className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-400">Password</label>
              <input
                type="password"
                required
                className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
            <span className="text-xs font-bold text-zinc-400 uppercase">or</span>
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
            )}
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>

        <p className="text-center text-sm text-zinc-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-emerald-500 font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
