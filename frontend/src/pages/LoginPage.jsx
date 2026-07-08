import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Paper, Typography, TextField,
  FormControlLabel, Checkbox, Button, Avatar, Alert, CircularProgress
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      doLoginWithToken(token);
      return;
    }
    const urlEmail = searchParams.get('email');
    const urlPassword = searchParams.get('password');
    if (urlEmail && urlPassword) {
      setEmail(urlEmail);
      setPassword(urlPassword);
      doFormLogin(urlEmail, urlPassword);
    }
  }, []);

  async function doLoginWithToken(loginToken) {
    setLoading(true);
    try {
      const response = await authAPI.loginWithToken(loginToken);
      login(response.data.token, response.data.refreshToken, response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.error || 'Token inválido o expirado');
      setLoading(false);
    }
  }

  async function doFormLogin(emailValue, passwordValue) {
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login({ email: emailValue, password: passwordValue });
      login(response.data.token, response.data.refreshToken, response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.error || 'Error al iniciar sesión');
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login({ email, password });
      login(response.data.token, remember ? response.data.refreshToken : null, response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.error || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 'bold' }}>
          Iniciar Sesión
        </Typography>
        <Paper elevation={3} sx={{ p: 4, mt: 3, width: '100%' }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {loading && <Alert severity="info" sx={{ mb: 2 }}>Iniciando sesión...</Alert>}
          <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Dirección de Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Contraseña"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormControlLabel
              control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} color="primary" />}
              label="Recordarme"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ mt: 3, mb: 2, fontWeight: 'bold' }}
            >
              {loading ? <CircularProgress size={24} /> : 'Ingresar'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
