
import React, { useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, TablePagination,
  Grid, TextField, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

// Datos de ejemplo para el historial
const historyData = Array.from({ length: 100 }, (_, i) => ({
  id: `trade_${12345 + i}`,
  closeDate: new Date(Date.now() - i * 3600000).toISOString(),
  asset: ['EUR/USD', 'GBP/JPY', 'BTC/USD', 'ETH/USD'][i % 4],
  direction: i % 3 === 0 ? 'put' : 'call',
  amount: 10 + (i % 10),
  result: (Math.random() - 0.4) * (10 + (i % 10)),
  strategy: ['MACD Crossover', 'RSI Over-Under', 'Momentum Scalp'][i % 3]
}));

export default function HistoryPage() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedData = historyData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>
        Historial de Operaciones
      </Typography>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              label="Fecha de Inicio"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Fecha de Fin"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Activo</InputLabel>
              <Select label="Activo" defaultValue="all">
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="EUR/USD">EUR/USD</MenuItem>
                <MenuItem value="GBP/JPY">GBP/JPY</MenuItem>
                <MenuItem value="BTC/USD">BTC/USD</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="contained" fullWidth sx={{ height: '100%' }}>Buscar</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabla de Historial */}
      <Paper>
        <TableContainer>
          <Table sx={{ minWidth: 650 }} aria-label="history table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Fecha Cierre</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Activo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Monto ($)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Resultado ($)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estrategia</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.closeDate).toLocaleString()}</TableCell>
                  <TableCell>{row.asset}</TableCell>
                  <TableCell>
                    <Chip
                      icon={row.direction === 'call' ? <TrendingUp /> : <TrendingDown />}
                      label={row.direction.toUpperCase()}
                      color={row.direction === 'call' ? 'success' : 'error'}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">${row.amount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: row.result >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                    {row.result >= 0 ? `+${row.result.toFixed(2)}` : row.result.toFixed(2)}
                  </TableCell>
                  <TableCell>{row.strategy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={historyData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Filas por página:"
        />
      </Paper>
    </Box>
  );
}
