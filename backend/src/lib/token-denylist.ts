/**
 * Denylist de tokens revogados (logout).
 *
 * JWT é stateless: "deslogar" só faz sentido se a API souber recusar o token
 * antes da expiração natural. Guardamos o `jti` até o `exp` do token.
 *
 * Implementação em memória — suficiente para um único processo.
 * Em produção com múltiplas instâncias, troque por Redis (SETEX com TTL =
 * tempo restante do token) mantendo esta mesma interface.
 */
export interface TokenDenylist {
  revoke(jti: string, expiresAtMs: number): void;
  isRevoked(jti: string): boolean;
}

class MemoryTokenDenylist implements TokenDenylist {
  private readonly revoked = new Map<string, number>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    // Limpeza periódica para o Map não crescer indefinidamente.
    this.sweeper = setInterval(() => this.sweep(), 10 * 60 * 1000);
    this.sweeper.unref();
  }

  revoke(jti: string, expiresAtMs: number): void {
    if (expiresAtMs <= Date.now()) return;
    this.revoked.set(jti, expiresAtMs);
  }

  isRevoked(jti: string): boolean {
    const expiresAt = this.revoked.get(jti);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.revoked.delete(jti);
      return false;
    }
    return true;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.revoked) {
      if (expiresAt <= now) this.revoked.delete(jti);
    }
  }
}

export const tokenDenylist: TokenDenylist = new MemoryTokenDenylist();
