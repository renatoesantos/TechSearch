import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../lib/password';

/** E-mail sempre normalizado: sem espaços e em minúsculas (evita duplicatas). */
const emailField = z
  .string({ required_error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .email('Informe um e-mail válido.')
  .max(255, 'E-mail muito longo.');

const passwordField = z
  .string({ required_error: 'Informe a senha.' })
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`)
  .regex(/[A-Za-z]/, 'A senha deve conter pelo menos uma letra.')
  .regex(/\d/, 'A senha deve conter pelo menos um número.');

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Informe seu nome.' })
    .trim()
    .min(2, 'Informe seu nome.')
    .max(120, 'Nome muito longo.'),
  email: emailField,
  password: passwordField,
});

export const loginSchema = z.object({
  email: emailField,
  // No login não aplicamos a política de senha: apenas limitamos o tamanho
  // para não gastar CPU com bcrypt em payloads absurdos.
  password: z.string().min(1, 'Informe a senha.').max(PASSWORD_MAX_LENGTH),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Informe o token.' })
    .trim()
    .min(20, 'Token inválido.')
    .max(200, 'Token inválido.'),
  password: passwordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
