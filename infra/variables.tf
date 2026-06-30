# ──────────────────────────────────────────────────────────────
# Variables raíz — valores ilustrativos, NO pensados para aplicar sin revisión.
# Tamaño de instancia, rango CIDR, cantidad de tareas, etc. son decisiones
# de costo/capacidad que dependen del contexto real de despliegue.
# ──────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "Región de AWS donde se despliegan los recursos"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nombre del proyecto — se usa como prefijo en nombres de recursos"
  type        = string
  default     = "account-balance-service"
}

variable "environment" {
  description = "Entorno de despliegue (dev, staging, prod)"
  type        = string
  default     = "production"
}

# ── Network ──────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subredes públicas (una por AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDRs de las subredes privadas (una por AZ)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24"]
}

# ── Database ─────────────────────────────────────────────────

variable "db_instance_class" {
  description = "Clase de instancia RDS — ejemplo ilustrativo, ajustar según carga real"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Nombre de la base de datos PostgreSQL"
  type        = string
  default     = "account_balance_db"
}

variable "db_port" {
  description = "Puerto de PostgreSQL"
  type        = number
  default     = 5432
}

variable "db_allocated_storage" {
  description = "Almacenamiento inicial en GB para RDS"
  type        = number
  default     = 20
}

# ── Compute ──────────────────────────────────────────────────

variable "container_port" {
  description = "Puerto que expone el contenedor del backend"
  type        = number
  default     = 3000
}

variable "fargate_cpu" {
  description = "Unidades de CPU para la tarea Fargate (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "fargate_memory" {
  description = "Memoria en MB para la tarea Fargate"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Cantidad deseada de tareas Fargate — ajustar según carga esperada"
  type        = number
  default     = 2
}

variable "image_tag" {
  description = "Tag de la imagen Docker (usar git SHA para deploys inmutables)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN del certificado ACM para HTTPS en el ALB — debe crearse previamente"
  type        = string
  default     = "arn:aws:acm:us-east-1:123456789012:certificate/example-cert-id"
}
