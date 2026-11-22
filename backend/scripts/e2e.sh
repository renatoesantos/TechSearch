#!/usr/bin/env bash
set -u
API=http://localhost:3333
PASS=0
FAIL=0

check() { # nome esperado recebido
  if [ "$2" = "$3" ]; then
    echo "PASS  $1  [$3]"
    PASS=$((PASS+1))
  else
    echo "FAIL  $1  esperado=$2 recebido=$3  body=$(cat /tmp/body.json | head -c 300)"
    FAIL=$((FAIL+1))
  fi
}

req() { # método path body token
  local method=$1 path=$2 data=${3:-} token=${4:-}
  local args=(-s -o /tmp/body.json -w '%{http_code}' -X "$method" "$API$path" -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-d "$data")
  curl "${args[@]}"
}

json() { python3 -c "import json,sys;d=json.load(open('/tmp/body.json'));print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

EMAIL="ana.$(date +%s)@example.com"

# 1. health
check "GET /health" 200 "$(req GET /health)"

# 2. cadastro
check "POST /register" 201 "$(req POST /api/auth/register "{\"name\":\"Ana Souza\",\"email\":\"$EMAIL\",\"password\":\"SenhaForte123\"}")"
TOKEN=$(json "d['token']")
EXPIRES=$(json "d['expiresIn']")
check "token expira em 86400s" 86400 "$EXPIRES"
check "payload do token tem exatamente 24h" 86400 "$(python3 - "$TOKEN" <<'PY'
import base64, json, sys
p = sys.argv[1].split('.')[1]
p += '=' * (-len(p) % 4)
c = json.loads(base64.urlsafe_b64decode(p))
print(c['exp'] - c['iat'])
PY
)"

# 3. e-mail duplicado
check "POST /register (e-mail duplicado)" 409 "$(req POST /api/auth/register "{\"name\":\"Outra\",\"email\":\"$EMAIL\",\"password\":\"SenhaForte123\"}")"
check "  código EMAIL_IN_USE" EMAIL_IN_USE "$(json "d['error']['code']")"

# 4. validação
check "POST /register (senha fraca)" 422 "$(req POST /api/auth/register '{"name":"X","email":"nao-e-email","password":"123"}')"
check "  VALIDATION_ERROR" VALIDATION_ERROR "$(json "d['error']['code']")"

# 5. login errado
check "POST /login (senha errada)" 401 "$(req POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"errada123\"}")"
check "  mensagem genérica" "E-mail ou senha inválidos." "$(json "d['error']['message']")"

# 6. login certo (e-mail com maiúsculas/espaços deve normalizar)
UPPER=$(echo "$EMAIL" | tr 'a-z' 'A-Z')
check "POST /login (normaliza e-mail)" 200 "$(req POST /api/auth/login "{\"email\":\"  $UPPER  \",\"password\":\"SenhaForte123\"}")"
TOKEN=$(json "d['token']")

# 7. /me
check "GET /me (com token)" 200 "$(req GET /api/auth/me '' "$TOKEN")"
check "  não expõe passwordHash" None "$(json "d['user'].get('passwordHash')")"
check "GET /me (sem token)" 401 "$(req GET /api/auth/me)"
check "  TOKEN ausente" "Token de acesso ausente." "$(json "d['error']['message']")"
check "GET /me (token inválido)" 401 "$(req GET /api/auth/me '' 'abc.def.ghi')"

# 8. recuperação de senha — e-mail existente
check "POST /forgot-password (existente)" 202 "$(req POST /api/auth/forgot-password "{\"email\":\"$EMAIL\"}")"
# e-mail inexistente deve responder igual (anti-enumeração)
check "POST /forgot-password (inexistente)" 202 "$(req POST /api/auth/forgot-password '{"email":"ninguem@example.com"}')"

RESET_TOKEN=$(grep -o 'redefinir-senha?token=[A-Za-z0-9_-]*' /tmp/techsearch-api.log | tail -1 | cut -d= -f2)
if [ -z "$RESET_TOKEN" ]; then echo "FAIL  token de reset não encontrado no log"; FAIL=$((FAIL+1)); else echo "PASS  link de reset gerado  [${#RESET_TOKEN} chars]"; PASS=$((PASS+1)); fi

# token inválido
check "POST /reset-password (token inválido)" 400 "$(req POST /api/auth/reset-password '{"token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","password":"NovaSenha456"}')"

# 9. reset válido
check "POST /reset-password (válido)" 200 "$(req POST /api/auth/reset-password "{\"token\":\"$RESET_TOKEN\",\"password\":\"NovaSenha456\"}")"
# token é de uso único
check "POST /reset-password (reuso do token)" 400 "$(req POST /api/auth/reset-password "{\"token\":\"$RESET_TOKEN\",\"password\":\"OutraSenha789\"}")"

# 10. token antigo invalidado pela troca de senha
check "GET /me (token anterior à troca)" 401 "$(req GET /api/auth/me '' "$TOKEN")"
check "  PASSWORD_CHANGED" PASSWORD_CHANGED "$(json "d['error']['code']")"

# 11. senha antiga não funciona / nova funciona
check "POST /login (senha antiga)" 401 "$(req POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"SenhaForte123\"}")"
check "POST /login (senha nova)" 200 "$(req POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"NovaSenha456\"}")"
TOKEN2=$(json "d['token']")

# 12. logout revoga o token
check "POST /logout" 204 "$(req POST /api/auth/logout '' "$TOKEN2")"
check "GET /me (após logout)" 401 "$(req GET /api/auth/me '' "$TOKEN2")"
check "  TOKEN_REVOKED" TOKEN_REVOKED "$(json "d['error']['code']")"

# 13. rota inexistente
check "GET /api/nao-existe" 404 "$(req GET /api/nao-existe)"

# 14. rate limit de login (10 falhas/15min) — já houve 2 falhas acima
CODES=""
for i in $(seq 1 12); do CODES="$CODES $(req POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"errada$i\"}")"; done
if echo "$CODES" | grep -q 429; then echo "PASS  rate limit de login bloqueia após 10 falhas  [$(echo $CODES | tr ' ' '\n' | sort | uniq -c | tr '\n' ' ')]"; PASS=$((PASS+1)); else echo "FAIL  rate limit de login não bloqueou: $CODES"; FAIL=$((FAIL+1)); fi

# 15. JSON malformado
check "POST /login (JSON malformado)" 400 "$(curl -s -o /tmp/body.json -w '%{http_code}' -X POST $API/api/auth/login -H 'Content-Type: application/json' -d '{name:')"
check "  INVALID_JSON" INVALID_JSON "$(json "d['error']['code']")"

echo
echo "RESULTADO: $PASS passaram, $FAIL falharam"
[ "$FAIL" -eq 0 ]
