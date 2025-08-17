import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import bgImage from '../../assets/login2.jpg'

const Login = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const result = await login(data)
      if (result.success) {
        navigate(from, { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      
      {/* Glassmorphism container */}
      <div className="w-full max-w-md relative z-10">
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl overflow-hidden border border-white/20">
          {/* Glass header with subtle gradient */}
          <div className="bg-gradient-to-r from-sky-400/90 to-green-700/90 py-8 px-8 border-b border-white/10">
            <div className="text-center">
              <h2 className="mt-4 text-3xl font-extrabold text-white">
                Welcome Back
              </h2>
              <p className="mt-2 text-sky-100/90">
                Sign in to your HRMS account
              </p>
            </div>
          </div>

          {/* Glass form area */}
          <div className="p-8 backdrop-blur-sm bg-white/5">
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-5">
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={`w-full px-4 py-3 rounded-lg backdrop-blur-sm bg-white/10 border ${errors.email ? 'border-red-400/50 focus:ring-red-400 focus:border-red-400' : 'border-white/20 focus:ring-sky-300 focus:border-sky-300'} focus:ring-2 focus:outline-none transition duration-200 text-white placeholder-white/50`}
                      {...register('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^\S+@\S+$/i,
                          message: 'Invalid email address',
                        },
                      })}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={`w-full px-4 py-3 rounded-lg backdrop-blur-sm bg-white/10 border ${errors.password ? 'border-red-400/50 focus:ring-red-400 focus:border-red-400' : 'border-white/20 focus:ring-sky-300 focus:border-sky-300'} focus:ring-2 focus:outline-none transition duration-200 text-white placeholder-white/50 pr-12`}
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters',
                        },
                      })}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-300">{errors.password.message}</p>
                  )}
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-sky-400 focus:ring-sky-300 border-white/30 rounded bg-white/10 backdrop-blur-sm"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-white/80">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-sky-300 hover:text-sky-200 transition-colors">
                    Forgot password?
                  </a>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-green-500/90 to-green-600/90 hover:from-sky-600/90 hover:to-blue-700/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-sky-500/30"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2 text-white" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            {/* Glass divider */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-transparent text-white/60">
                    Or continue with
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Glass footer */}
          <div className="backdrop-blur-sm bg-white/5 px-8 py-4 border-t border-white/10">
            <p className="text-center text-sm text-sky-100/80">
              Don't have an account?{' '}
              <a href="#" className="font-medium text-sky-300 hover:text-sky-200 transition-colors">
                Get started
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login