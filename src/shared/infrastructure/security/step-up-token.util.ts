import crypto from 'node:crypto';

const STEP_UP_TIPO = 'STEP_UP_MUTACION_5M';

export interface StepUpTokenPayload {
  sub: string;
  email: string;
  tipo: string;
  exp: number;
}

export function generarStepUpToken(
  usuarioId: string,
  email: string,
  duracionSegundos = 300,
): { token: string; expiraEnSegundos: number; expiraEn: string } {
  const secret = process.env.JWT_SECRET || 'uagrm_step_up_default_secret_fallback_key';
  const expiraTimestamp = Math.floor(Date.now() / 1000) + duracionSegundos;
  const expiraIso = new Date(expiraTimestamp * 1000).toISOString();

  const payload: StepUpTokenPayload = {
    sub: usuarioId,
    email,
    tipo: STEP_UP_TIPO,
    exp: expiraTimestamp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return {
    token: `${payloadB64}.${signature}`,
    expiraEnSegundos: duracionSegundos,
    expiraEn: expiraIso,
  };
}

export function verificarStepUpToken(token: string | undefined | null, usuarioId: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const partes = token.split('.');
  if (partes.length !== 2) {
    return false;
  }

  const [payloadB64, signature] = partes;
  if (!payloadB64 || !signature) {
    return false;
  }

  const secret = process.env.JWT_SECRET || 'uagrm_step_up_default_secret_fallback_key';

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  // Comparación en tiempo constante para mitigar ataques de temporización
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (!crypto.timingSafeEqual(a, b)) {
      return false;
    }

    const payload: StepUpTokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    );

    if (payload.sub !== usuarioId) {
      return false;
    }

    if (payload.tipo !== STEP_UP_TIPO) {
      return false;
    }

    const ahora = Math.floor(Date.now() / 1000);
    if (payload.exp < ahora) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
