import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let transporter: Transporter | null = null;

/**
 * SMTP real se SMTP_HOST estiver configurado; caso contrário, usa o
 * transporte `json` (não envia nada) e registra o link no log — assim o
 * fluxo de recuperação funciona em dev sem servidor de e-mail.
 */
function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (env.SMTP_HOST) {
    const port = env.SMTP_PORT ?? 587;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

export interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const firstName = params.name.split(' ')[0] ?? params.name;

  const subject = 'TechSearch — redefinição de senha';
  const text = [
    `Olá, ${firstName}!`,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no TechSearch.',
    `Acesse o link abaixo (válido por ${params.expiresInMinutes} minutos):`,
    '',
    params.resetUrl,
    '',
    'Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma.',
    '',
    'Equipe TechSearch',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;color:#111827">
      <h2 style="color:#111827">Redefinição de senha</h2>
      <p>Olá, ${escapeHtml(firstName)}!</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no <strong>TechSearch</strong>.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(params.resetUrl)}"
           style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Criar nova senha
        </a>
      </p>
      <p style="color:#4b5563;font-size:14px">O link expira em ${params.expiresInMinutes} minutos.</p>
      <p style="color:#4b5563;font-size:14px">Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma.</p>
    </div>
  `;

  const info = await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: params.to,
    subject,
    text,
    html,
  });

  if (!env.SMTP_HOST) {
    // Dev: expõe o link para facilitar testes manuais.
    logger.info('E-mail de recuperação não enviado (SMTP_HOST ausente) — link disponível abaixo', {
      to: params.to,
      resetUrl: params.resetUrl,
      messageId: info.messageId,
    });
  }
}

export interface PriceAlertEmailParams {
  to: string;
  name: string;
  productName: string;
  price: number;
  targetPrice: number;
  storeName: string;
  productUrl: string;
}

export async function sendPriceAlertEmail(params: PriceAlertEmailParams): Promise<void> {
  const firstName = params.name.split(' ')[0] ?? params.name;
  const formattedPrice = formatBrl(params.price);
  const formattedTarget = formatBrl(params.targetPrice);
  const subject = `TechSearch — preço atingido: ${params.productName}`;
  const text = [
    `Olá, ${firstName}!`,
    '',
    `O produto ${params.productName} atingiu o preço desejado.`,
    `Preço encontrado: ${formattedPrice}`,
    `Preço alvo: ${formattedTarget}`,
    `Loja: ${params.storeName}`,
    '',
    `Confira a oferta: ${params.productUrl}`,
    '',
    'Este é o único aviso enviado para este produto nos próximos 7 dias.',
    '',
    'Equipe TechSearch',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111827">
      <h2 style="color:#166534">Preço alvo atingido</h2>
      <p>Olá, ${escapeHtml(firstName)}!</p>
      <p><strong>${escapeHtml(params.productName)}</strong> atingiu o preço que você definiu.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:20px 0">
        <p style="margin:4px 0"><strong>Preço encontrado:</strong> ${formattedPrice}</p>
        <p style="margin:4px 0"><strong>Preço alvo:</strong> ${formattedTarget}</p>
        <p style="margin:4px 0"><strong>Loja:</strong> ${escapeHtml(params.storeName)}</p>
      </div>
      <p style="margin:24px 0">
        <a href="${escapeHtml(params.productUrl)}"
           style="background:#166534;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Ver oferta
        </a>
      </p>
      <p style="color:#4b5563;font-size:14px">Para evitar repetição, um novo aviso deste produto só será enviado após 7 dias.</p>
    </div>
  `;

  const info = await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: params.to,
    subject,
    text,
    html,
  });

  if (!env.SMTP_HOST) {
    logger.info('Alerta de preço registrado (SMTP_HOST ausente)', {
      to: params.to,
      productName: params.productName,
      price: formattedPrice,
      storeName: params.storeName,
      productUrl: params.productUrl,
      messageId: info.messageId,
    });
  }
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
