# ── DB Subnet Group ─────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# ── Lectura de credenciales desde Secrets Manager ────────────

data "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = var.db_credentials_secret_arn
}

locals {
  db_creds = jsondecode(data.aws_secretsmanager_secret_version.db_credentials.secret_string)
}

# ── RDS PostgreSQL Multi-AZ ─────────────────────────────────

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}-postgres"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.db_instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 2

  db_name  = var.db_name
  port     = var.db_port
  username = local.db_creds.username
  password = local.db_creds.password

  # Multi-AZ para alta disponibilidad — failover automático entre AZs
  multi_az             = true
  db_subnet_group_name = aws_db_subnet_group.main.name

  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false

  # Backup y mantenimiento
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:30-sun:05:30"

  # Protección contra borrado accidental
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-final-snapshot"

  storage_encrypted = true

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}
