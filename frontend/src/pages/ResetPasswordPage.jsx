import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import AuthImagePattern from '../components/AuthImagePattern';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link');
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const validateForm = () => {
    if (!formData.password) {
      toast.error('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await axiosInstance.post('/auth/reset-password', {
        token,
        password: formData.password,
      });
      
      toast.success('Password reset successfully!');
      setIsSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className='h-screen grid lg:grid-cols-2'>
        <div className="flex flex-col justify-center items-center p-6 sm:p-12">
          <div className='w-full max-w-md space-y-8'>
            <div className='text-center mb-8'>
              <div className='flex flex-col items-center gap-2'>
                <div className='w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center'>
                  <MessageSquare className="w-6 h-6 text-success"/>
                </div>
                <h1 className='text-2xl font-bold mt-2'>Password Reset Successful!</h1>
                <p className='text-base-content/60'>
                  Your password has been changed successfully. Redirecting to login...
                </p>
              </div>
            </div>
            <Link to="/login" className='btn btn-primary w-full'>
              Go to Login
            </Link>
          </div>
        </div>
        <AuthImagePattern 
          title="All Set!"
          subtitle="You can now login with your new password."
        />
      </div>
    );
  }

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
              <h1 className='text-2xl font-bold mt-2'>Reset Password</h1>
              <p className='text-base-content/60'>Enter your new password</p>
            </div>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className='space-y-6'>
            <div className='form-control'>
              <label className='label'>
                <span className='label-text font-medium'>New Password</span>
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Lock className="h-5 w-5 text-base-content/40"/>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className='input input-bordered w-full pl-10'
                  placeholder='Enter new password'
                  disabled={isLoading}
                />
                <button 
                  type='button' 
                  onClick={() => setShowPassword(!showPassword)} 
                  className='absolute inset-y-0 right-0 pr-3 flex items-center'
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-base-content/40" />
                  ) : (
                    <Eye className="h-5 w-5 text-base-content/40" />  
                  )}
                </button>
              </div>
            </div>

            <div className='form-control'>
              <label className='label'>
                <span className='label-text font-medium'>Confirm Password</span>
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Lock className="h-5 w-5 text-base-content/40"/>
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className='input input-bordered w-full pl-10'
                  placeholder='Confirm new password'
                  disabled={isLoading}
                />
                <button 
                  type='button' 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                  className='absolute inset-y-0 right-0 pr-3 flex items-center'
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-base-content/40" />
                  ) : (
                    <Eye className="h-5 w-5 text-base-content/40" />  
                  )}
                </button>
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
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>

          <div className='text-center'>
            <Link to="/login" className='link link-primary flex items-center justify-center gap-2'>
              <ArrowLeft className='w-4 h-4' />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
      {/* Right Side - Image */}
      <AuthImagePattern 
        title="Set New Password"
        subtitle="Choose a strong password to secure your account."
      />
    </div>
  );
};

export default ResetPasswordPage;

