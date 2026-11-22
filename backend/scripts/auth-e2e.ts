
import http from 'node:http';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const suffix = Date.now().toString();
const email = `auth-${suffix}@example.com`;

const oldPassword = 'StrongPass123!';
const newPassword = 'NewStrongPass456!';

const server = http.createServer(createApp());

let serverStarted = false;
let checks = 0;

async function request(path: string, options: RequestInit = {}) {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Servidor de teste não está disponível.');
  }

  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }

  checks++;
  console.log(`PASS ${checks}: ${message}`);
}

function jsonHeaders(token?: string) {
  return {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function captureResetUrl(): Promise<string> {
  let resetUrl: string | undefined;

  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string') {
      try {
        const entry = JSON.parse(args[0]) as {
          resetUrl?: string;
          to?: string;
        };

        if (entry.to === email && entry.resetUrl) {
          resetUrl = entry.resetUrl;
        }
      } catch {
        // Ignora mensagens que não sejam JSON.
      }
    }

    originalLog(...args);
  };

  try {
    const response = await request('/api/auth/forgot-password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email }),
    });

    assert(
      response.status === 202,
      'Solicitação de recuperação retorna 202',
    );
  } finally {
    console.log = originalLog;
  }

  assert(
    Boolean(resetUrl),
    'Link de recuperação registrado no log',
  );

  return resetUrl!;
}

async function main() {
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    serverStarted = true;

    // 1. Cadastro
    const register = await request('/api/auth/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: 'Auth Tester',
        email,
        password: oldPassword,
      }),
    });

    assert(register.status === 201, 'Cadastro realizado');

    const registered = await register.json() as {
      token: string;
      user: { email: string };
    };

    assert(Boolean(registered.token), 'Cadastro retorna JWT');
    assert(registered.user.email === email, 'Cadastro retorna usuário correto');

    // 2. Cadastro duplicado
    const duplicate = await request('/api/auth/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: 'Auth Tester',
        email,
        password: oldPassword,
      }),
    });

    assert(duplicate.status === 409, 'Bloqueia e-mail duplicado');

    // 3. Validação de senha
    const invalidPassword = await request('/api/auth/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: 'Invalid Tester',
        email: `invalid-${suffix}@example.com`,
        password: '12345678',
      }),
    });

    assert(
      invalidPassword.status === 422,
      'Rejeita senha sem letras',
    );

    // 4. Login incorreto
    const wrongLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        email,
        password: 'WrongPassword123!',
      }),
    });

    assert(wrongLogin.status === 401, 'Rejeita senha incorreta');

    // 5. Login correto
    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: ` ${email.toUpperCase()} `,
        password: oldPassword,
      }),
    });

    assert(login.status === 200, 'Login aceita e-mail normalizado');

    const logged = await login.json() as { token: string };

    // 6. Consulta autenticada
    const me = await request('/api/auth/me', {
      headers: jsonHeaders(logged.token),
    });

    assert(me.status === 200, 'Consulta /me autenticada');

    const meData = await me.json() as {
      user: Record<string, unknown>;
    };

    assert(
      meData.user.email === email &&
      !('passwordHash' in meData.user),
      'Resposta /me não expõe hash da senha',
    );

    // 7. Consulta sem autenticação
    const noToken = await request('/api/auth/me');

    assert(noToken.status === 401, 'Bloqueia /me sem token');

    // 8. Recuperação de e-mail inexistente
    const unknownEmail = await request('/api/auth/forgot-password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: `unknown-${suffix}@example.com`,
      }),
    });

    assert(
      unknownEmail.status === 202,
      'Recuperação de e-mail inexistente também retorna 202',
    );

    // 9. Primeiro pedido de recuperação
    const firstResetUrl = await captureResetUrl();
    const firstToken = new URL(firstResetUrl).searchParams.get('token');

    assert(Boolean(firstToken), 'Primeiro token extraído do link');

    // 10. Segundo pedido invalida o primeiro
    const secondResetUrl = await captureResetUrl();
    const secondToken = new URL(secondResetUrl).searchParams.get('token');

    assert(Boolean(secondToken), 'Segundo token extraído do link');

    assert(
      firstToken !== secondToken,
      'Cada solicitação gera um token diferente',
    );

    const invalidatedReset = await request('/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        token: firstToken,
        password: newPassword,
      }),
    });

    assert(
      invalidatedReset.status === 400,
      'Token anterior é invalidado',
    );

    // 11. Impede reutilizar a senha atual
    const samePassword = await request('/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        token: secondToken,
        password: oldPassword,
      }),
    });

    assert(
      samePassword.status === 422,
      'Rejeita reutilização da senha atual',
    );

    // 12. Redefinição válida
    const reset = await request('/api/auth/reset-password', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
        token: secondToken,
        password: newPassword,
        }),
    });

    const resetBody = await reset.text();

    assert(
    reset.status === 200,
    `Redefinição de senha realizada (HTTP ${reset.status})`,
    );

    // 13. Token de recuperação não pode ser reutilizado
    const reusedReset = await request('/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        token: secondToken,
        password: 'AnotherPassword789!',
      }),
    });

    assert(reusedReset.status === 400, 'Impede reutilização do link');

    // Aguarda a tolerância de 1 segundo do middleware JWT.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // 14. Sessão anterior à troca de senha
    const oldSession = await request('/api/auth/me', {
      headers: jsonHeaders(logged.token),
    });

    assert(
      oldSession.status === 401,
      'Invalida sessão anterior à troca de senha',
    );

    // 15. Senha antiga não funciona
    const oldLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        email,
        password: oldPassword,
      }),
    });

    assert(oldLogin.status === 401, 'Senha antiga não funciona');

    // 16. Nova senha funciona
    const newLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        email,
        password: newPassword,
      }),
    });

    assert(newLogin.status === 200, 'Nova senha permite login');

    const newAuth = await newLogin.json() as { token: string };

    // 17. Logout
    const logout = await request('/api/auth/logout', {
      method: 'POST',
      headers: jsonHeaders(newAuth.token),
    });

    assert(logout.status === 204, 'Logout realizado');

    // 18. Token revogado
    const revokedSession = await request('/api/auth/me', {
      headers: jsonHeaders(newAuth.token),
    });

    assert(
      revokedSession.status === 401,
      'Token rejeitado depois do logout',
    );

    console.log(
      'AUTH_E2E_OK',
      JSON.stringify({ checks }),
    );
  } finally {
    // Exclui usuário e tokens de recuperação relacionados.
    try {
      await prisma.user.deleteMany({
        where: { email },
      });
    } catch (error) {
      console.error('Erro ao limpar usuário de teste:', error);
    }

    if (serverStarted) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }
}

main()
  .catch((error) => {
    console.error('Falha no teste de autenticação:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
