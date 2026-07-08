
import React, { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Grid, Card, CardContent, CardActions, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, FormControl, InputLabel, Select, IconButton, Alert
} from '@mui/material';
import { Add, PlayArrow, Stop, Settings, Delete } from '@mui/icons-material';
import { strategiesAPI } from '../services/api';
import { useBotStore } from '../store';

export default function StrategiesPage() {
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState([]);
  const [notification, setNotification] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    type: 'rsi',
    asset: 'EURUSD',
    timeframe: '1m',
    activeId: 1,
    fastPeriod: 12,
    slowPeriod: 26,
    amount: 10
  });
  const { addStrategy, removeStrategy, updateStrategy } = useBotStore();

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const response = await strategiesAPI.getAll();
      if (response.success) {
        setStrategies(response.data || []);
      }
    } catch (err) {
      console.error('Error loading strategies:', err);
    }
  };

  const handleCreateStrategy = async () => {
    setLoading(true);
    try {
      const params = {
        ...newStrategy
      };
      delete params.type;
      delete params.asset;
      delete params.timeframe;
      delete params.activeId;
      const response = await strategiesAPI.create({
        type: newStrategy.type,
        params
      });
      if (response.success) {
        addStrategy(response.data);
        setStrategies([...strategies, response.data]);
        setNotification({ type: 'success', message: 'Estrategia creada exitosamente' });
        setDialogOpen(false);
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.error || 'Error al crear estrategia' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartStrategy = async (id) => {
    try {
      const strategy = strategies.find(s => s.id === id);
      const activeId = strategy?.activeId || 1;
      const response = await strategiesAPI.start(id, { activeId, amount: 10 });
      if (response.success) {
        updateStrategy({ id, status: 'active' });
        setStrategies(strategies.map(s => s.id === id ? { ...s, status: 'active' } : s));
        setNotification({ type: 'success', message: 'Estrategia iniciada' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.error || 'Error al iniciar estrategia' });
    }
  };

  const handleStopStrategy = async (id) => {
    try {
      const response = await strategiesAPI.pause(id);
      if (response.success) {
        updateStrategy({ id, status: 'inactive' });
        setStrategies(strategies.map(s => s.id === id ? { ...s, status: 'inactive' } : s));
        setNotification({ type: 'success', message: 'Estrategia pausada' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.error || 'Error al pausar estrategia' });
    }
  };

  const handleDeleteStrategy = async (id) => {
    try {
      const response = await strategiesAPI.stop(id);
      if (response.success) {
        removeStrategy(id);
        setStrategies(strategies.filter(s => s.id !== id));
        setNotification({ type: 'success', message: 'Estrategia eliminada' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.error || 'Error al eliminar estrategia' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Gestión de Estrategias
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          Añadir Nueva Estrategia
        </Button>
      </Box>

      {notification && (
        <Alert 
          severity={notification.type}
          onClose={() => setNotification(null)}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      )}

      {/* Grid de Estrategias */}
      <Grid container spacing={3}>
        {strategies.length > 0 ? strategies.map((strategy) => (
          <Grid item xs={12} md={6} lg={4} key={strategy.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{strategy.name}</Typography>
                  <Chip 
                    label={strategy.status === 'active' ? 'Activa' : 'Inactiva'} 
                    color={strategy.status === 'active' ? "success" : "default"} 
                    size="small" 
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">Activo: {strategy.params?.asset || strategy.activeId || 'N/A'}</Typography>
                <Typography variant="body2" color="text.secondary">Timeframe: {strategy.params?.timeframe || 'N/A'}</Typography>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">G/P Acumulada</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: (strategy.pnl || 0) >= 0 ? 'success.main' : 'error.main' }}>
                    {(strategy.pnl || 0) >= 0 ? `+$${(strategy.pnl || 0).toFixed(2)}` : `-$${Math.abs(strategy.pnl || 0).toFixed(2)}`}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Box>
                  {strategy.status === 'active' ? (
                    <Button variant="outlined" color="error" size="small" startIcon={<Stop />} onClick={() => handleStopStrategy(strategy.id)}>
                      Parar
                    </Button>
                  ) : (
                    <Button variant="contained" color="success" size="small" startIcon={<PlayArrow />} onClick={() => handleStartStrategy(strategy.id)}>
                      Iniciar
                    </Button>
                  )}
                </Box>
                <Box>
                  <IconButton size="small"><Settings /></IconButton>
                  <IconButton size="small" onClick={() => handleDeleteStrategy(strategy.id)}><Delete /></IconButton>
                </Box>
              </CardActions>
            </Card>
          </Grid>
        )) : (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No hay estrategias configuradas</Typography>
            </Box>
          </Grid>
        )}
      </Grid>
      
      {/* Dialog para añadir estrategia */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Configurar Nueva Estrategia</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Estrategia</InputLabel>
                <Select 
                  value={newStrategy.type}
                  label="Tipo de Estrategia"
                  onChange={(e) => setNewStrategy({...newStrategy, type: e.target.value})}
                >
                  <MenuItem value="ma-crossover">MA Crossover</MenuItem>
                  <MenuItem value="rsi">RSI Over-Under</MenuItem>
                  <MenuItem value="bollinger-bands">Bollinger Bands</MenuItem>
                  <MenuItem value="grid-trading">Grid Trading</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Activo</InputLabel>
                <Select 
                  value={newStrategy.asset}
                  label="Activo"
                  onChange={(e) => setNewStrategy({...newStrategy, asset: e.target.value})}
                >
                  <MenuItem value="EURUSD">EUR/USD</MenuItem>
                  <MenuItem value="GBPUSD">GBP/USD</MenuItem>
                  <MenuItem value="BTCUSD">BTC/USD</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Timeframe</InputLabel>
                <Select 
                  value={newStrategy.timeframe}
                  label="Timeframe"
                  onChange={(e) => setNewStrategy({...newStrategy, timeframe: e.target.value})}
                >
                  <MenuItem value="1m">1 Minuto</MenuItem>
                  <MenuItem value="5m">5 Minutos</MenuItem>
                  <MenuItem value="15m">15 Minutos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>Parámetros de la Estrategia</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Periodo Rápido" 
                type="number" 
                value={newStrategy.fastPeriod}
                onChange={(e) => setNewStrategy({...newStrategy, fastPeriod: parseInt(e.target.value)})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Periodo Lento" 
                type="number" 
                value={newStrategy.slowPeriod}
                onChange={(e) => setNewStrategy({...newStrategy, slowPeriod: parseInt(e.target.value)})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Monto por Operación ($)" 
                type="number" 
                value={newStrategy.amount}
                onChange={(e) => setNewStrategy({...newStrategy, amount: parseFloat(e.target.value)})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateStrategy} variant="contained" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar y Activar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
