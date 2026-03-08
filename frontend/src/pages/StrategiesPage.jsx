
import React, { useState } from 'react';
import {
  Box, Button, Typography, Grid, Card, CardContent, CardActions, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, FormControl, InputLabel, Select, IconButton
} from '@mui/material';
import { Add, PlayArrow, Stop, Settings, Delete } from '@mui/icons-material';

// Datos de ejemplo
const strategies = [
  { id: 1, name: 'MACD Crossover #1', asset: 'EUR/USD', timeframe: '1M', pnl: 50.70, status: 'Activa' },
  { id: 2, name: 'RSI Over-Under', asset: 'GBP/JPY', timeframe: '5M', pnl: -12.30, status: 'Inactiva' },
  { id: 3, name: 'Momentum Scalp', asset: 'BTC/USD', timeframe: '1M', pnl: 0, status: 'Inactiva' },
];

const StrategyCard = ({ strategy }) => {
  const { name, status, asset, timeframe, pnl } = strategy;
  const isActive = status === 'Activa';

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{name}</Typography>
          <Chip label={status} color={isActive ? "success" : "default"} size="small" />
        </Box>
        <Typography variant="body2" color="text.secondary">Activo: {asset}</Typography>
        <Typography variant="body2" color="text.secondary">Timeframe: {timeframe}</Typography>
        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">G/P Acumulada</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: pnl >= 0 ? 'success.main' : 'error.main' }}>
                {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
            </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between' }}>
        <Box>
            {isActive ? (
                <Button variant="outlined" color="error" size="small" startIcon={<Stop />}>
                    Parar
                </Button>
            ) : (
                <Button variant="contained" color="success" size="small" startIcon={<PlayArrow />}>
                    Iniciar
                </Button>
            )}
        </Box>
        <Box>
            <IconButton size="small"><Settings /></IconButton>
            <IconButton size="small"><Delete /></IconButton>
        </Box>
      </CardActions>
    </Card>
  );
};


export default function StrategiesPage() {
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
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
          onClick={handleClickOpen}
        >
          Añadir Nueva Estrategia
        </Button>
      </Box>

      {/* Grid de Estrategias */}
      <Grid container spacing={3}>
        {strategies.map((strategy) => (
          <Grid item xs={12} md={6} lg={4} key={strategy.id}>
            <StrategyCard strategy={strategy} />
          </Grid>
        ))}
      </Grid>
      
      {/* Dialog para añadir estrategia */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Configurar Nueva Estrategia</DialogTitle>
        <DialogContent>
            <Grid container spacing={3} sx={{ pt: 1 }}>
                <Grid item xs={12}>
                    <FormControl fullWidth>
                        <InputLabel>Tipo de Estrategia</InputLabel>
                        <Select label="Tipo de Estrategia" defaultValue="MACD">
                            <MenuItem value="MACD">MACD Crossover</MenuItem>
                            <MenuItem value="RSI">RSI Over-Under</MenuItem>
                            <MenuItem value="BB">Bollinger Bands</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                        <InputLabel>Activo</InputLabel>
                        <Select label="Activo" defaultValue="EUR/USD">
                            <MenuItem value="EUR/USD">EUR/USD</MenuItem>
                            <MenuItem value="GBP/JPY">GBP/JPY</MenuItem>
                            <MenuItem value="BTC/USD">BTC/USD</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                        <InputLabel>Timeframe</InputLabel>
                        <Select label="Timeframe" defaultValue="5M">
                            <MenuItem value="1M">1 Minuto</MenuItem>
                            <MenuItem value="5M">5 Minutos</MenuItem>
                            <MenuItem value="15M">15 Minutos</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>Parámetros de la Estrategia</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Periodo Rápido" type="number" defaultValue="12" />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Periodo Lento" type="number" defaultValue="26" />
                </Grid>
                 <Grid item xs={12}>
                    <TextField fullWidth label="Monto por Operación ($)" type="number" defaultValue="10" />
                </Grid>
            </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleClose} variant="contained">Guardar y Activar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
