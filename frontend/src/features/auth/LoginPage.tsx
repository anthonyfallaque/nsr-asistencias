import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button, Field, Input, describedBy } from '@/shared/ui';
import { ApiError } from '@/shared/lib/http';
import { useAuth, useEstaAutenticado, useUsuario } from './store';
import { rutaInicial } from '@/config/navigation';

export default function LoginPage() {
  const login = useAuth((s) => s.login);
  const autenticado = useEstaAutenticado();
  const usuario = useUsuario();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  useEffect(() => {
    document.title = 'Iniciar sesión · Asistencias NSR';
  }, []);

  // Redirección declarativa. Antes se llamaba a navigate() durante el
  // render: un efecto secundario en fase de render, que React 18 ejecuta
  // dos veces en StrictMode y puede reordenar en modo concurrente.
  if (autenticado) {
    const destino = (location.state as { from?: string } | null)?.from;
    return <Navigate to={destino ?? rutaInicial(usuario?.rol)} replace />;
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setEnviando(true);

    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (fallo) {
      setError(
        fallo instanceof ApiError
          ? fallo.message
          : 'No se pudo iniciar sesión. Inténtalo de nuevo.'
      );
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center mb-7">
          <img
            src="/logo.png"
            alt=""
            className="h-12 w-12 rounded-lg object-contain mb-3"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="text-lg font-semibold text-content">Asistencias</h1>
          <p className="text-sm text-content-muted mt-0.5">I. E. Nuestra Señora del Rosario</p>
        </div>

        <div className="bg-surface border border-border rounded-lg shadow-sm p-6">
          <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
            <Field htmlFor={emailId} label="Correo electrónico">
              <Input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                // El único contenido de esta pantalla es este formulario, así
                // que enfocarlo no desorienta a nadie y ahorra un toque diario
                // a quien entra cada mañana desde el móvil.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@nsr.edu.pe"
                className="h-9"
              />
            </Field>

            <Field htmlFor={passwordId} label="Contraseña">
              <Input
                id={passwordId}
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9"
                aria-describedby={describedBy(passwordId, undefined, undefined)}
                addonRight={
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => setVerPassword((v) => !v)}
                    aria-label={verPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                    aria-pressed={verPassword}
                    icon={
                      verPassword ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )
                    }
                  />
                }
              />
            </Field>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-danger-soft border border-danger-border rounded-md px-3 py-2.5"
              >
                <AlertCircle
                  className="h-4 w-4 text-danger shrink-0 mt-px"
                  aria-hidden="true"
                />
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={enviando}
              className="mt-1"
            >
              {enviando ? 'Comprobando…' : 'Ingresar'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-content-muted mt-6">
          © {new Date().getFullYear()} I. E. Nuestra Señora del Rosario · Chiclayo, Perú
        </p>
      </div>
    </div>
  );
}
