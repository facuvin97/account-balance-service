# ── Secrets Manager ──────────────────────────────────────────
# Valores sensibles — se inyectan en la Task Definition por ARN, nunca como texto plano

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.project_name}/${var.environment}/jwt-secret"
  description = "JWT signing secret para autenticación del backend"

  tags = {
    Name = "${var.project_name}-${var.environment}-jwt-secret"
  }
}

# Placeholder — el valor real se establece manualmente o via CI/CD, no en Terraform
resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = "REPLACE_ME_BEFORE_DEPLOY"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/${var.environment}/db-credentials"
  description = "Credenciales de conexion a PostgreSQL (username + password)"

  tags = {
    Name = "${var.project_name}-${var.environment}-db-credentials"
  }
}

# Placeholder — estructura JSON esperada por la app
resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "app_user"
    password = "REPLACE_ME_BEFORE_DEPLOY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── SSM Parameter Store ─────────────────────────────────────
# Configuración no sensible — visible en la consola, sin costo de Secrets Manager

resource "aws_ssm_parameter" "db_port" {
  name  = "/${var.project_name}/${var.environment}/db-port"
  type  = "String"
  value = tostring(var.db_port)

  tags = {
    Name = "${var.project_name}-${var.environment}-db-port"
  }
}

resource "aws_ssm_parameter" "db_name" {
  name  = "/${var.project_name}/${var.environment}/db-name"
  type  = "String"
  value = var.db_name

  tags = {
    Name = "${var.project_name}-${var.environment}-db-name"
  }
}
