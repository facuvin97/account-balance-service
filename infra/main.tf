data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

# ── Red: VPC, subredes, VPC Endpoints, security groups ───────

module "network" {
  source = "./modules/network"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = local.azs
  container_port       = var.container_port
  db_port              = var.db_port
}

# ── Secretos: Secrets Manager + SSM Parameter Store ──────────

module "secrets" {
  source = "./modules/secrets"

  project_name = var.project_name
  environment  = var.environment
  db_name      = var.db_name
  db_port      = var.db_port
}

# ── Base de datos: RDS PostgreSQL Multi-AZ ───────────────────

module "database" {
  source = "./modules/database"

  project_name      = var.project_name
  environment       = var.environment
  db_instance_class = var.db_instance_class
  db_name           = var.db_name
  db_port           = var.db_port
  allocated_storage = var.db_allocated_storage

  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.rds_security_group_id

  # Credenciales referenciadas desde Secrets Manager — no viajan como texto plano
  db_credentials_secret_arn = module.secrets.db_credentials_secret_arn
}

# ── SSM db-host: se crea en raíz porque depende del output de database ──

resource "aws_ssm_parameter" "db_host" {
  name        = "/${var.project_name}/${var.environment}/db-host"
  description = "Hostname de RDS — resuelto desde el output del módulo database"
  type        = "String"
  value       = module.database.db_address
}

# ── Cómputo: ECR, ECS Fargate, ALB ──────────────────────────

module "compute" {
  source = "./modules/compute"

  project_name   = var.project_name
  environment    = var.environment
  aws_region     = var.aws_region
  container_port = var.container_port
  fargate_cpu    = var.fargate_cpu
  fargate_memory = var.fargate_memory
  desired_count  = var.desired_count

  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  private_subnet_ids    = module.network.private_subnet_ids
  alb_security_group_id = module.network.alb_security_group_id
  ecs_security_group_id = module.network.ecs_security_group_id
  acm_certificate_arn   = var.acm_certificate_arn

  # ARNs de secretos — ECS los inyecta en el contenedor en runtime
  jwt_secret_arn            = module.secrets.jwt_secret_arn
  db_credentials_secret_arn = module.secrets.db_credentials_secret_arn

  # Parámetros no sensibles desde SSM
  ssm_db_host_arn = aws_ssm_parameter.db_host.arn
  ssm_db_port_arn = module.secrets.ssm_db_port_arn
  ssm_db_name_arn = module.secrets.ssm_db_name_arn
}
