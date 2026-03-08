
import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button
} from '@mui/material';
import {
  AccountBalanceWallet, TrendingUp, TrendingDown,
  PieChart, BarChart, MoreVert, StopCircle
} from '@mui/icons-material';

// Datos de ejemplo
const kpiData = [
  {
    title: 'Balance Actual',
    value: '$10,523.50',
    icon: <AccountBalanceWallet color="primary" />,
    color: 'primary.main',
  },
  {
    title: 'G/P Hoy',
    value: '+$150.25',
    icon: <TrendingUp color="success" />,
    color: 'success.main',
  },
  {
    title: 'Trades Hoy',
    value: '25',
    icon: <BarChart color="secondary" />,
    color: 'secondary.main',
  },
  {
    title: 'Winrate',
    value: '75%',
    icon: <PieChart color="warning" />,
    color: 'warning.main',
  },
];

const activeStrategies = [
    { id: 1, name: 'MACD Crossover #1', asset: 'EUR/USD', timeframe: '1M', pnl: 50.70, status: 'Activa' },
    { id: 2, name: 'RSI Over-Under', asset: 'GBP/JPY', timeframe: '5M', pnl: -12.30, status: 'Activa' },
    { id: 3, name: 'Momentum Scalp', asset: 'BTC/USD', timeframe: '1M', pnl: 120.45, status: 'Activa' },
];

const KpiCard = ({ title, value, icon, color }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        {icon}
        <Typography sx={{ ml: 1, fontWeight: 'bold' }} variant="body1">{title}</Typography>
      </Box>
      <Typography variant="h4" sx={{ color: color, fontWeight: 'bold' }}>{value}</Typography>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>
        Dashboard
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3}>
        {kpiData.map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.title}>
            <KpiCard {...item} />
          </Grid>
        ))}

        {/* Gráfico de Rendimiento */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Evolución del Balance</Typography>
                {/* Placeholder para filtros de fecha */}
                <Button size="small">Últimos 30 días</Button>
              </Box>
              <Box
                sx={{
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  mt: 2
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  [Placeholder para el gráfico de rendimiento]
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Tabla de Estrategias Activas */}
        <Grid item xs={12}>
            <Card>
                <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Estrategias Activas</Typography>
                    <TableContainer component={Paper}>
                        <Table sx={{ minWidth: 650 }} aria-label="simple table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Estrategia</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Activo</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Timeframe</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>G/P Acumulada</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {activeStrategies.map((strategy) => (
                                <TableRow key={strategy.id}>
                                    <TableCell>{strategy.name}</TableCell>
                                    <TableCell>{strategy.asset}</TableCell>
                                    <TableCell>{strategy.timeframe}</TableCell>
                                    <TableCell sx={{ color: strategy.pnl >= 0 ? 'success.main' : 'error.main' }}>
                                        {strategy.pnl >= 0 ? `+$${strategy.pnl.toFixed(2)}` : `-$${Math.abs(strategy.pnl).toFixed(2)}`}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={strategy.status} color="success" size="small" />
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="outlined" color="error" size="small" startIcon={<StopCircle />}>
                                            Parar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
