
import React from 'react';
import {
  Box, Button, Typography, Grid, Card, CardContent, CardActions,
  TextField, Switch, FormControlLabel, Divider, CardHeader
} from '@mui/material';

const SettingsSection = ({ title, subtitle, children, actions }) => (
    <Card>
      <CardHeader
        title={title}
        subheader={subtitle}
        titleTypographyProps={{ fontWeight: 'bold' }}
      />
      <CardContent>
        {children}
      </CardContent>
      {actions && (
        <>
            <Divider />
            <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                {actions}
            </CardActions>
        </>
      )}
    </Card>
);

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>
        Ajustes
      </Typography>

      <Grid container spacing={3}>
        {/* Conexión IQ Option */}
        <Grid item xs={12}>
          <SettingsSection
            title="Conexión a IQ Option"
            subtitle="Credenciales para acceder a la API"
            actions={<Button variant="contained">Guardar Credenciales</Button>}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Email" defaultValue="user@example.com" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Contraseña" type="password" defaultValue="a-secret-password" />
              </Grid>
            </Grid>
          </SettingsSection>
        </Grid>

        {/* Gestión de Riesgo */}
        <Grid item xs={12}>
          <SettingsSection
            title="Gestión de Riesgo"
            subtitle="Límites para proteger tu cuenta"
            actions={<Button variant="contained">Guardar Ajustes de Riesgo</Button>}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Pérdida Máxima Diaria ($)"
                  type="number"
                  defaultValue="100"
                  helperText="El bot se detendrá si la pérdida diaria alcanza este valor."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Monto Máximo por Orden ($)"
                  type="number"
                  defaultValue="50"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Máximo de Pérdidas Consecutivas"
                  type="number"
                  defaultValue="5"
                  helperText="Pausa temporal tras N pérdidas seguidas."
                />
              </Grid>
                 <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Cooldown tras Pérdida (segundos)"
                  type="number"
                  defaultValue="60"
                />
              </Grid>
            </Grid>
          </SettingsSection>
        </Grid>

        {/* Ajustes de Interfaz */}
        <Grid item xs={12}>
          <SettingsSection
            title="Ajustes de Interfaz"
          >
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Modo Oscuro"
            />
          </SettingsSection>
        </Grid>
      </Grid>
    </Box>
  );
}
