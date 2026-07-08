
import React, { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, FormControl, InputLabel, Select, Tooltip, Alert
} from '@mui/material';
import { Add, TrendingUp, TrendingDown, Close } from '@mui/icons-material';
import { ordersAPI } from '../services/api';
import { useBotStore } from '../store';

export default function OrdersPage() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [orderForm, setOrderForm] = useState({
    asset: 'EURUSD',
    direction: 'call',
    amount: 10,
    expiration: 60
  });
  const { openPositions, setOpenPositions, removePosition, addToHistory } = useBotStore();

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    try {
      const response = await ordersAPI.getOpenPositions();
      if (response.success) {
        setOpenPositions(response.data || []);
      }
    } catch (err) {
      console.error('Error loading positions:', err);
    }
  };

  const handleOpenOrder = async () => {
    setLoading(true);
    try {
      const response = await ordersAPI.openOrder(orderForm);
      if (response.success) {
        setNotification({ type: 'success', message: 'Orden colocada exitosamente' });
        setOpen(false);
        loadPositions();
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.error || 'Error al colocar orden' });
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (positionId) => {
    try {
      const response = await ordersAPI.closePosition(positionId);
      if (response.success) {
        removePosition(positionId);
        if (response.data) {
          addToHistory(response.data);
        }
        setNotification({ type: 'success', message: 'Posición cerrada' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.error || 'Error al cerrar posición' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Órdenes Abiertas
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpen(true)}
        >
          Nueva Orden Manual
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

      {/* Tabla de Órdenes Abiertas */}
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="open positions table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Activo</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Monto ($)</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Precio Apertura</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">G/P Actual ($)</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {openPositions.map((pos) => (
              <TableRow
                key={pos.id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {pos.asset}
                </TableCell>
                <TableCell>
                  <Chip
                    icon={pos.direction === 'call' ? <TrendingUp /> : <TrendingDown />}
                    label={pos.direction.toUpperCase()}
                    color={pos.direction === 'call' ? 'success' : 'error'}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">${pos.amount.toFixed(2)}</TableCell>
                <TableCell align="right">{pos.openQuote}</TableCell>
                <TableCell align="right" sx={{ color: pos.currentPnl >= 0 ? 'success.main' : 'error.main' }}>
                  {pos.currentPnl >= 0 ? `+${pos.currentPnl.toFixed(2)}` : pos.currentPnl.toFixed(2)}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Cerrar Posición">
                    <IconButton 
                      color="error" 
                      size="small"
                      onClick={() => handleClosePosition(pos.id)}
                    >
                      <Close />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {openPositions.length === 0 && (
          <Paper sx={{py: 4, textAlign: 'center', mt: 2}}>
              <Typography color="text.secondary">No hay posiciones abiertas en este momento.</Typography>
          </Paper>
      )}

      {/* Dialog para nueva orden */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Nueva Orden Manual</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Activo</InputLabel>
              <Select 
                value={orderForm.asset}
                label="Activo"
                onChange={(e) => setOrderForm({...orderForm, asset: e.target.value})}
              >
                <MenuItem value="EURUSD">EUR/USD</MenuItem>
                <MenuItem value="GBPUSD">GBP/USD</MenuItem>
                <MenuItem value="BTCUSD">BTC/USD</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Dirección</InputLabel>
              <Select 
                value={orderForm.direction}
                label="Dirección"
                onChange={(e) => setOrderForm({...orderForm, direction: e.target.value})}
              >
                <MenuItem value="call">CALL (Sube)</MenuItem>
                <MenuItem value="put">PUT (Baja)</MenuItem>
              </Select>
            </FormControl>
            <TextField 
              fullWidth 
              label="Monto ($)" 
              type="number" 
              value={orderForm.amount}
              onChange={(e) => setOrderForm({...orderForm, amount: parseFloat(e.target.value)})}
            />
            <FormControl fullWidth>
              <InputLabel>Expiración</InputLabel>
              <Select 
                value={orderForm.expiration}
                label="Expiración"
                onChange={(e) => setOrderForm({...orderForm, expiration: e.target.value})}
              >
                <MenuItem value={60}>1 Minuto</MenuItem>
                <MenuItem value={300}>5 Minutos</MenuItem>
                <MenuItem value={900}>15 Minutos</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button 
            onClick={handleOpenOrder} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Colocando...' : 'Colocar Orden'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
