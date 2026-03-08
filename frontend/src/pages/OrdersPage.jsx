
import React, { useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, FormControl, InputLabel, Select
} from '@mui/material';
import { Add, TrendingUp, TrendingDown, Close } from '@mui/icons-material';

// Datos de ejemplo para órdenes abiertas
const openPositions = [
  { id: 'pos_123', asset: 'EUR/USD', direction: 'call', amount: 10, openQuote: 1.0854, currentPnl: 2.50 },
  { id: 'pos_124', asset: 'GBP/JPY', direction: 'put', amount: 15, openQuote: 198.23, currentPnl: -5.75 },
  { id: 'pos_125', asset: 'BTC/USD', direction: 'call', amount: 50, openQuote: 68123.45, currentPnl: 120.10 },
];

export default function OrdersPage() {
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
          Órdenes Abiertas
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleClickOpen}
        >
          Nueva Orden Manual
        </Button>
      </Box>

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
                    <IconButton color="error" size="small">
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
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Nueva Orden Manual</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Activo</InputLabel>
              <Select label="Activo" defaultValue="EUR/USD">
                <MenuItem value="EUR/USD">EUR/USD</MenuItem>
                <MenuItem value="GBP/JPY">GBP/JPY</MenuItem>
                <MenuItem value="BTC/USD">BTC/USD</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Dirección</InputLabel>
              <Select label="Dirección" defaultValue="call">
                <MenuItem value="call">CALL (Sube)</MenuItem>
                <MenuItem value="put">PUT (Baja)</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth label="Monto ($)" type="number" defaultValue="10" />
            <FormControl fullWidth>
              <InputLabel>Expiración</InputLabel>
              <Select label="Expiración" defaultValue={60}>
                <MenuItem value={60}>1 Minuto</MenuItem>
                <MenuItem value={300}>5 Minutos</MenuItem>
                <MenuItem value={900}>15 Minutos</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleClose} variant="contained">Colocar Orden</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
