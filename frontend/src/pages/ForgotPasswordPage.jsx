import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Mail, Loader2, ArrowLeft } from 'lucide-react';
import AuthImagePattern from '../components/AuthImagePattern';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      return toast.error('Email is required');
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return toast.error('Invalid email format');
    }

    setIsLoading(true);
    try {
      const response = await axiosInstance.post('/auth/forgot-password', { email });
      toast.success(response.data.message);
      setIsSubmitted(true);
      
      // In development, show the reset token if provided
      if (response.data.resetToken) {
        console.log('Reset Token:', response.data.resetToken);
        console.log('Reset URL:', response.data.resetUrl);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='h-screen grid lg:grid-cols-2'>
      {/* Left Side - form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12">
        <div className='w-full max-w-md space-y-8'>
          {/* Logo */}
          <div className='text-center mb-8'>
            <div className='flex flex-col items-center gap-2 group'>
              <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors'>
                <MessageSquare className="w-6 h-6 text-primary"/>
              </div>
              <h1 className='text-2xl font-bold mt-2'>Forgot Password</h1>
              <p className='text-base-content/60'>
                {isSubmitted 
                  ? 'Check your email for reset instructions' 
                  : 'Enter your email to reset your password'}
              </p>
            </div>
          </div>

          {!isSubmitted ? (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className='space-y-6'>
                <div className='form-control'>
                  <label className='label'>
                    <span className='label-text font-medium'>Email</span>
                  </label>
                  <div className='relative'>
                    <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                      <Mail className="h-5 w-5 text-base-content/40"/>
                    </div>
                    <input
                      type='email'
                      className='input input-bordered w-full pl-10'
                      placeholder='you@example.com'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <button 
                  type='submit' 
                  className='btn btn-primary w-full' 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className='h-5 w-5 animate-spin' />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className='text-center space-y-4'>
              <div className='alert alert-success'>
                <Mail className='w-5 h-5' />
                <span>Password reset link has been sent to your email!</span>
              </div>
              <p className='text-base-content/60 text-sm'>
                Please check your inbox and follow the instructions to reset your password.
                The link will expire in 10 minutes.
              </p>
            </div>
          )}

          <div className='text-center space-y-2'>
            <Link to="/login" className='link link-primary flex items-center justify-center gap-2'>
              <ArrowLeft className='w-4 h-4' />
              Back to Login
            </Link>
            <p className='text-base-content/60 text-sm'>
              Remember your password?{" "}
              <Link to="/login" className="link link-primary">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
      {/* Right Side - Image */}
      <AuthImagePattern 
        title="Reset Your Password"
        subtitle="Enter your email and we'll send you a link to reset your password."
      />
    </div>
  );
};

export default ForgotPasswordPage;

