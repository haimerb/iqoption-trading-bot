import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../store'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'
import { TrendingUp, Eye, EyeOff, Loader2 } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida')
})

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      const response = await authAPI.login(data)
      const { token, refreshToken, user, iqSession } = response.data

      login(token, refreshToken, user)

      const { setBotStore } = require('../store').useBotStore.getState()
      if (iqSession?.balance) {
        require('../store').useBotStore.getState().setBalance(
          iqSession.balance,
          iqSession.currency || 'USD'
        )
      }

      toast.success('¡Conectado exitosamente!')
      navigate('/')
    } catch (err) {
      const message = err?.error || 'Error al iniciar sesión'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <TrendingUp size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">IQ Option Bot</h1>
          <p className="text-gray-400 mt-2">Sistema de Trading Automatizado</p>
        </div>

        {/* Card de login */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Iniciar Sesión</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                className="input"
                placeholder="tu@email.com"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Conectando con IQ Option...</>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-400">
              💡 Este sistema se conecta con su cuenta de IQ Option usando las credenciales configuradas durante el registro.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          IQ Option Trading Bot v1.0.0 · Solo para uso personal
        </p>
      </div>
    </div>
  )
}
