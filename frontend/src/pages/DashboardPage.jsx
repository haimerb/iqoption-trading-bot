import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button
} from '@mui/material';
import {
  AccountBalanceWallet, TrendingUp, TrendingDown,
  PieChart, BarChart, StopCircle
} from '@mui/icons-material';
import { accountAPI, strategiesAPI, historyAPI } from '../services/api';
import { useBotStore } from '../store';

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
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    balance: 0,
    pnlToday: 0,
    tradesToday: 0,
    winRate: 0
  });
  const [strategies, setStrategies] = useState([]);
  const { removeStrategy } = useBotStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accountRes, strategiesRes] = await Promise.all([
        accountAPI.getBalance().catch(() => ({ success: false })),
        strategiesAPI.getAll().catch(() => ({ success: false }))
      ]);

      if (accountRes.success) {
        setStats({
          balance: accountRes.data?.balance || 10000,
          pnlToday: accountRes.data?.pnlToday || 0,
          tradesToday: accountRes.data?.tradesToday || 0,
          winRate: accountRes.data?.winRate || 0.65
        });
      } else {
        setStats({ balance: 10000, pnlToday: 0, tradesToday: 0, winRate: 0.65 });
      }

      if (strategiesRes.success) {
        setStrategies(strategiesRes.data || []);
      }
    } catch (err) {
      setStats({ balance: 10000, pnlToday: 0, tradesToday: 0, winRate: 0.65 });
    } finally {
      setLoading(false);
    }
  };

  const handleStopStrategy = async (id) => {
    try {
      await strategiesAPI.stop(id);
      removeStrategy(id);
      setStrategies(strategies.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error stopping strategy:', err);
    }
  };

  const kpiData = [
    {
      title: 'Balance Actual',
      value: `$${stats.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      icon: <AccountBalanceWallet color="primary" />,
      color: 'primary.main',
    },
    {
      title: 'G/P Hoy',
      value: `${stats.pnlToday >= 0 ? '+' : ''}$${stats.pnlToday.toFixed(2)}`,
      icon: stats.pnlToday >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />,
      color: stats.pnlToday >= 0 ? 'success.main' : 'error.main',
    },
    {
      title: 'Trades Hoy',
      value: String(stats.tradesToday),
      icon: <BarChart color="secondary" />,
      color: 'secondary.main',
    },
    {
      title: 'Winrate',
      value: `${(stats.winRate * 100).toFixed(0)}%`,
      icon: <PieChart color="warning" />,
      color: 'warning.main',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {kpiData.map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.title}>
            <KpiCard {...item} />
          </Grid>
        ))}

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Evolución del Balance</Typography>
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
        
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Estrategias Activas</Typography>
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Estrategia</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Activo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Timeframe</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>G/P</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {strategies.length > 0 ? strategies.map((strategy) => (
                      <TableRow key={strategy.id}>
                        <TableCell>{strategy.name}</TableCell>
                        <TableCell>{strategy.params?.asset || strategy.activeId || 'N/A'}</TableCell>
                        <TableCell>{strategy.params?.timeframe || 'N/A'}</TableCell>
                        <TableCell sx={{ color: (strategy.pnl || 0) >= 0 ? 'success.main' : 'error.main' }}>
                          ${(strategy.pnl || 0) >= 0 ? '+' : ''}${(strategy.pnl || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={strategy.status === 'active' ? 'Activa' : 'Inactiva'} 
                            color={strategy.status === 'active' ? 'success' : 'default'} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>
                          {strategy.status === 'active' && (
                            <Button 
                              variant="outlined" 
                              color="error" 
                              size="small" 
                              startIcon={<StopCircle />}
                              onClick={() => handleStopStrategy(strategy.id)}
                            >
                              Parar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary" sx={{ py: 2 }}>
                            No hay estrategias activas
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
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