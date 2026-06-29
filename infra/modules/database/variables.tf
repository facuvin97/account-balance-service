variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "db_instance_class" {
  type = string
}

variable "db_name" {
  type = string
}

variable "db_port" {
  type = number
}

variable "allocated_storage" {
  type = number
}

variable "subnet_ids" {
  description = "IDs de subredes privadas para el DB subnet group"
  type        = list(string)
}

variable "security_group_id" {
  description = "ID del security group que permite conexiones desde Fargate"
  type        = string
}

variable "db_credentials_secret_arn" {
  description = "ARN del secreto en Secrets Manager con username y password"
  type        = string
}
